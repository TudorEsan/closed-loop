import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const VALID_ROLES = ['super_admin', 'user'] as const;

export class UpdateRoleDto {
  @ApiProperty({
    description: 'New role to assign',
    enum: VALID_ROLES,
  })
  @IsIn(VALID_ROLES)
  role: (typeof VALID_ROLES)[number];
}
