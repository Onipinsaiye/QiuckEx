import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export class CreateTeamDto {
  @ApiProperty({ description: 'Team name', example: 'Payments Team' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ description: 'Team description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address of the invitee', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Role to assign', enum: ['admin', 'member', 'viewer'] })
  @IsEnum(['admin', 'member', 'viewer'])
  role!: Exclude<TeamRole, 'owner'>;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'New role', enum: ['admin', 'member', 'viewer'] })
  @IsEnum(['admin', 'member', 'viewer'])
  role!: Exclude<TeamRole, 'owner'>;
}

export class TeamMemberResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: TeamRole;
  @ApiProperty() joinedAt!: string;
  @ApiProperty() lastActiveAt!: string | null;
  @ApiProperty() status!: 'active' | 'pending';
}

export class TeamResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() ownerPublicKey!: string;
  @ApiProperty({ type: [TeamMemberResponseDto] }) members!: TeamMemberResponseDto[];
  @ApiProperty() createdAt!: string;
}

export class InviteLinkResponseDto {
  @ApiProperty() inviteToken!: string;
  @ApiProperty() inviteUrl!: string;
  @ApiProperty() expiresAt!: string;
}
