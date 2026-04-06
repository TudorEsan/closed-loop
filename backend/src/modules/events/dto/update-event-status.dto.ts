import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const VALID_STATUSES = [
  'draft',
  'setup',
  'active',
  'settlement',
  'closed',
] as const;

export class UpdateEventStatusDto {
  @ApiProperty({
    description: 'New event status',
    enum: VALID_STATUSES,
  })
  @IsIn(VALID_STATUSES)
  status: (typeof VALID_STATUSES)[number];
}
