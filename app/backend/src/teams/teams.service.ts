import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateTeamDto,
  InviteLinkResponseDto,
  InviteMemberDto,
  TeamMemberResponseDto,
  TeamResponseDto,
  TeamRole,
  UpdateMemberRoleDto,
} from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------------------
  // Team CRUD
  // ---------------------------------------------------------------------------

  async createTeam(
    ownerPublicKey: string,
    dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    const teamId = randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const { data: team, error: teamError } = await this.supabase
      .getClient()
      .from('teams')
      .insert({
        id: teamId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        owner_public_key: ownerPublicKey,
        created_at: now,
      })
      .select('id, name, description, owner_public_key, created_at')
      .single();

    if (teamError) throw teamError;

    // Auto-add owner as owner role
    await this.supabase.getClient().from('team_members').insert({
      id: randomBytes(16).toString('hex'),
      team_id: teamId,
      email: ownerPublicKey,
      role: 'owner' as TeamRole,
      status: 'active',
      joined_at: now,
      last_active_at: now,
    });

    return {
      id: team.id as string,
      name: team.name as string,
      description: team.description as string | undefined,
      ownerPublicKey: team.owner_public_key as string,
      members: [],
      createdAt: team.created_at as string,
    };
  }

  async getTeam(
    ownerPublicKey: string,
    teamId: string,
  ): Promise<TeamResponseDto> {
    const { data: team, error } = await this.supabase
      .getClient()
      .from('teams')
      .select('id, name, description, owner_public_key, created_at')
      .eq('id', teamId)
      .maybeSingle();

    if (error) throw error;
    if (!team) throw new NotFoundException('Team not found');

    await this.assertMember(teamId, ownerPublicKey);

    const members = await this.getMembers(teamId);
    return {
      id: team.id as string,
      name: team.name as string,
      description: team.description as string | undefined,
      ownerPublicKey: team.owner_public_key as string,
      members,
      createdAt: team.created_at as string,
    };
  }

  async listTeams(ownerPublicKey: string): Promise<TeamResponseDto[]> {
    // Return teams where the user is a member
    const { data: memberships, error } = await this.supabase
      .getClient()
      .from('team_members')
      .select('team_id')
      .eq('email', ownerPublicKey)
      .eq('status', 'active');

    if (error) throw error;

    const teamIds = (memberships ?? []).map((m: Record<string, unknown>) => m.team_id as string);
    if (teamIds.length === 0) return [];

    const { data: teams, error: teamsError } = await this.supabase
      .getClient()
      .from('teams')
      .select('id, name, description, owner_public_key, created_at')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    return await Promise.all(
      (teams ?? []).map(async (team: Record<string, unknown>) => {
        const members = await this.getMembers(team.id as string);
        return {
          id: team.id as string,
          name: team.name as string,
          description: team.description as string | undefined,
          ownerPublicKey: team.owner_public_key as string,
          members,
          createdAt: team.created_at as string,
        };
      }),
    );
  }

  async deleteTeam(ownerPublicKey: string, teamId: string): Promise<void> {
    await this.assertRole(teamId, ownerPublicKey, 'owner');

    await this.supabase.getClient().from('team_members').delete().eq('team_id', teamId);

    const { error } = await this.supabase
      .getClient()
      .from('teams')
      .delete()
      .eq('id', teamId)
      .eq('owner_public_key', ownerPublicKey);

    if (error) throw error;
  }

  // ---------------------------------------------------------------------------
  // Member management
  // ---------------------------------------------------------------------------

  async inviteMember(
    actorPublicKey: string,
    teamId: string,
    dto: InviteMemberDto,
  ): Promise<TeamMemberResponseDto> {
    await this.assertRole(teamId, actorPublicKey, 'admin');

    const existing = await this.findMember(teamId, dto.email);
    if (existing) {
      throw new BadRequestException('Member already exists in the team');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('team_members')
      .insert({
        id: randomBytes(16).toString('hex'),
        team_id: teamId,
        email: dto.email.toLowerCase().trim(),
        role: dto.role,
        status: 'pending',
        joined_at: now,
        last_active_at: null,
      })
      .select('id, email, role, status, joined_at, last_active_at')
      .single();

    if (error) throw error;
    return this.toMemberDto(data as Record<string, unknown>);
  }

  async updateMemberRole(
    actorPublicKey: string,
    teamId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<TeamMemberResponseDto> {
    await this.assertRole(teamId, actorPublicKey, 'owner');

    const { data, error } = await this.supabase
      .getClient()
      .from('team_members')
      .update({ role: dto.role })
      .eq('id', memberId)
      .eq('team_id', teamId)
      .select('id, email, role, status, joined_at, last_active_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Member not found');
    return this.toMemberDto(data as Record<string, unknown>);
  }

  async removeMember(
    actorPublicKey: string,
    teamId: string,
    memberId: string,
  ): Promise<void> {
    await this.assertRole(teamId, actorPublicKey, 'owner');

    // Cannot remove the owner
    const { data: member } = await this.supabase
      .getClient()
      .from('team_members')
      .select('role')
      .eq('id', memberId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (!member) throw new NotFoundException('Member not found');
    if ((member as Record<string, unknown>).role === 'owner') {
      throw new ForbiddenException('Cannot remove the team owner');
    }

    await this.supabase
      .getClient()
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);
  }

  // ---------------------------------------------------------------------------
  // Invite links
  // ---------------------------------------------------------------------------

  async generateInviteLink(
    actorPublicKey: string,
    teamId: string,
  ): Promise<InviteLinkResponseDto> {
    await this.assertRole(teamId, actorPublicKey, 'admin');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await this.supabase.getClient().from('team_invites').insert({
      id: randomBytes(16).toString('hex'),
      team_id: teamId,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quickex.to';
    return {
      inviteToken: token,
      inviteUrl: `${baseUrl}/teams/join/${token}`,
      expiresAt,
    };
  }

  async acceptInvite(
    memberEmail: string,
    teamId: string,
    token: string,
  ): Promise<void> {
    const { data: invite, error } = await this.supabase
      .getClient()
      .from('team_invites')
      .select('id, expires_at')
      .eq('team_id', teamId)
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    if (!invite) throw new NotFoundException('Invite not found or already used');

    const expiresAt = new Date((invite as Record<string, unknown>).expires_at as string);
    if (expiresAt < new Date()) {
      throw new BadRequestException('Invite link has expired');
    }

    const now = new Date().toISOString();
    await this.supabase.getClient().from('team_members').upsert(
      {
        id: randomBytes(16).toString('hex'),
        team_id: teamId,
        email: memberEmail.toLowerCase().trim(),
        role: 'member' as TeamRole,
        status: 'active',
        joined_at: now,
        last_active_at: now,
      },
      { onConflict: 'team_id,email' },
    );

    // Consume the invite
    await this.supabase
      .getClient()
      .from('team_invites')
      .delete()
      .eq('id', (invite as Record<string, unknown>).id as string);
  }

  async transferOwnership(
    ownerPublicKey: string,
    teamId: string,
    newOwnerMemberId: string,
  ): Promise<void> {
    await this.assertRole(teamId, ownerPublicKey, 'owner');

    const { data: newOwnerMember } = await this.supabase
      .getClient()
      .from('team_members')
      .select('id, email')
      .eq('id', newOwnerMemberId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (!newOwnerMember) throw new NotFoundException('Member not found');

    // Demote current owner to admin
    await this.supabase
      .getClient()
      .from('team_members')
      .update({ role: 'admin' as TeamRole })
      .eq('team_id', teamId)
      .eq('email', ownerPublicKey);

    // Promote new owner
    await this.supabase
      .getClient()
      .from('team_members')
      .update({ role: 'owner' as TeamRole })
      .eq('id', newOwnerMemberId)
      .eq('team_id', teamId);

    // Update the teams table
    await this.supabase
      .getClient()
      .from('teams')
      .update({
        owner_public_key: (newOwnerMember as Record<string, unknown>).email as string,
      })
      .eq('id', teamId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getMembers(teamId: string): Promise<TeamMemberResponseDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('team_members')
      .select('id, email, role, status, joined_at, last_active_at')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((m: Record<string, unknown>) => this.toMemberDto(m));
  }

  private async findMember(
    teamId: string,
    email: string,
  ): Promise<TeamMemberResponseDto | null> {
    const { data } = await this.supabase
      .getClient()
      .from('team_members')
      .select('id, email, role, status, joined_at, last_active_at')
      .eq('team_id', teamId)
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    return data ? this.toMemberDto(data as Record<string, unknown>) : null;
  }

  private async assertMember(
    teamId: string,
    publicKey: string,
  ): Promise<void> {
    const member = await this.findMember(teamId, publicKey);
    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }

  /**
   * Assert that the actor has at least the required role.
   * Role hierarchy: owner > admin > member > viewer
   */
  private async assertRole(
    teamId: string,
    publicKey: string,
    requiredRole: 'owner' | 'admin',
  ): Promise<void> {
    const member = await this.findMember(teamId, publicKey);
    if (!member) throw new ForbiddenException('Not a team member');

    const hierarchy: TeamRole[] = ['viewer', 'member', 'admin', 'owner'];
    const actorLevel = hierarchy.indexOf(member.role);
    const requiredLevel = hierarchy.indexOf(requiredRole);

    if (actorLevel < requiredLevel) {
      throw new ForbiddenException(
        `This action requires ${requiredRole} role or higher`,
      );
    }
  }

  private toMemberDto(row: Record<string, unknown>): TeamMemberResponseDto {
    return {
      id: row.id as string,
      email: row.email as string,
      role: row.role as TeamRole,
      status: row.status as 'active' | 'pending',
      joinedAt: row.joined_at as string,
      lastActiveAt: (row.last_active_at as string | null) ?? null,
    };
  }
}
