import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class AddVendorMemberDto {
  @ApiPropertyOptional({ description: 'Existing user ID to add as a member' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Email of the user to add (creates a user if missing)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  email?: string;

  @ApiProperty({ enum: ['manager', 'cashier'] })
  @IsString()
  @IsIn(['manager', 'cashier'])
  role: 'manager' | 'cashier';
}
