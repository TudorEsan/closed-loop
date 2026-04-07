import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignOperatorDto {
  @ApiProperty({ description: 'User ID to assign as device operator' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
