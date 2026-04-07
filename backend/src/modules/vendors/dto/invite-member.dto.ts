import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address to invite' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Role to assign', enum: ['manager', 'cashier'] })
  @IsString()
  @IsIn(['manager', 'cashier'])
  role: 'manager' | 'cashier';
}
