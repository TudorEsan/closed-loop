import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role for the member',
    enum: ['manager', 'cashier'],
  })
  @IsString()
  @IsIn(['manager', 'cashier'])
  role: 'manager' | 'cashier';
}
