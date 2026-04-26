import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueTicketDto {
  @ApiProperty({ description: 'Email address that will receive the ticket' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description:
      'Optional display name to greet the recipient with in the email',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
