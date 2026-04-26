import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  IsOptional,
  IsEmail,
  ValidateIf,
} from 'class-validator';

const VALID_ROLES = ['organizer', 'admin', 'operator'] as const;

export class AddMemberDto {
  @ApiProperty({
    description: 'User ID to add as event member (omit to invite by email)',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.email)
  @IsString()
  userId?: string;

  @ApiProperty({
    description:
      'Email of the user to add. If no account exists with this email, one will be created and invited.',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.userId)
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Role to assign within the event',
    enum: VALID_ROLES,
  })
  @IsIn(VALID_ROLES)
  role: (typeof VALID_ROLES)[number];
}
