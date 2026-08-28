import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import {
  CreateTeamDto,
  InviteLinkResponseDto,
  InviteMemberDto,
  TeamMemberResponseDto,
  TeamResponseDto,
  UpdateMemberRoleDto,
} from './dto/teams.dto';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, type: TeamResponseDto })
  @ApiQuery({ name: 'ownerPublicKey', required: true, description: 'Stellar public key of the creator' })
  async createTeam(
    @Query('ownerPublicKey') ownerPublicKey: string,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teams.createTeam(ownerPublicKey, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List teams for a user' })
  @ApiResponse({ status: 200, type: [TeamResponseDto] })
  @ApiQuery({ name: 'ownerPublicKey', required: true })
  async listTeams(
    @Query('ownerPublicKey') ownerPublicKey: string,
  ): Promise<{ teams: TeamResponseDto[] }> {
    const teams = await this.teams.listTeams(ownerPublicKey);
    return { teams };
  }

  @Get(':teamId')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiResponse({ status: 200, type: TeamResponseDto })
  @ApiParam({ name: 'teamId' })
  async getTeam(
    @Query('ownerPublicKey') ownerPublicKey: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamResponseDto> {
    return this.teams.getTeam(ownerPublicKey, teamId);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a team (owner only)' })
  @ApiParam({ name: 'teamId' })
  async deleteTeam(
    @Query('ownerPublicKey') ownerPublicKey: string,
    @Param('teamId') teamId: string,
  ): Promise<void> {
    return this.teams.deleteTeam(ownerPublicKey, teamId);
  }

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------

  @Post(':teamId/members')
  @ApiOperation({ summary: 'Invite a member to the team' })
  @ApiResponse({ status: 201, type: TeamMemberResponseDto })
  async inviteMember(
    @Query('actorPublicKey') actorPublicKey: string,
    @Param('teamId') teamId: string,
    @Body() dto: InviteMemberDto,
  ): Promise<TeamMemberResponseDto> {
    return this.teams.inviteMember(actorPublicKey, teamId, dto);
  }

  @Patch(':teamId/members/:memberId/role')
  @ApiOperation({ summary: 'Update a member role (owner only)' })
  @ApiResponse({ status: 200, type: TeamMemberResponseDto })
  async updateMemberRole(
    @Query('actorPublicKey') actorPublicKey: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<TeamMemberResponseDto> {
    return this.teams.updateMemberRole(actorPublicKey, teamId, memberId, dto);
  }

  @Delete(':teamId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the team (owner only)' })
  async removeMember(
    @Query('actorPublicKey') actorPublicKey: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    return this.teams.removeMember(actorPublicKey, teamId, memberId);
  }

  // ---------------------------------------------------------------------------
  // Invite links
  // ---------------------------------------------------------------------------

  @Post(':teamId/invite-link')
  @ApiOperation({ summary: 'Generate a 7-day invite link for the team' })
  @ApiResponse({ status: 201, type: InviteLinkResponseDto })
  async generateInviteLink(
    @Query('actorPublicKey') actorPublicKey: string,
    @Param('teamId') teamId: string,
  ): Promise<InviteLinkResponseDto> {
    return this.teams.generateInviteLink(actorPublicKey, teamId);
  }

  @Post(':teamId/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept a team invite via token' })
  async acceptInvite(
    @Query('memberEmail') memberEmail: string,
    @Param('teamId') teamId: string,
    @Body('token') token: string,
  ): Promise<void> {
    return this.teams.acceptInvite(memberEmail, teamId, token);
  }

  @Post(':teamId/transfer-ownership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Transfer team ownership to another member (owner only)' })
  async transferOwnership(
    @Query('ownerPublicKey') ownerPublicKey: string,
    @Param('teamId') teamId: string,
    @Body('newOwnerMemberId') newOwnerMemberId: string,
  ): Promise<void> {
    return this.teams.transferOwnership(ownerPublicKey, teamId, newOwnerMemberId);
  }
}
