import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsNotEmpty } from 'class-validator';

const VALID_ROLES = ['organizer', 'admin', 'operator'] as const;

export class AddMemberDto {
  @ApiProperty({ description: 'User ID to add as event member' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Role to assign within the event',
    enum: VALID_ROLES,
  })
  @IsIn(VALID_ROLES)
  role: (typeof VALID_ROLES)[number];
}
