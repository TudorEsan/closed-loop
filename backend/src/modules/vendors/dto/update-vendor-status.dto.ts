import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;

export class UpdateVendorStatusDto {
  @ApiProperty({
    description: 'New vendor status',
    enum: VALID_STATUSES,
  })
  @IsIn(VALID_STATUSES)
  status: (typeof VALID_STATUSES)[number];
}
