import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VendorResponseDto {
  @ApiProperty({ description: 'Vendor ID' })
  id: string;

  @ApiProperty({ description: 'User ID of the vendor' })
  userId: string;

  @ApiProperty({ description: 'Event ID the vendor belongs to' })
  eventId: string;

  @ApiProperty({ description: 'Business name' })
  businessName: string;

  @ApiProperty({ description: 'Contact person name' })
  contactPerson: string;

  @ApiPropertyOptional({ description: 'Contact email', nullable: true })
  contactEmail: string | null;

  @ApiPropertyOptional({ description: 'Contact phone', nullable: true })
  contactPhone: string | null;

  @ApiPropertyOptional({ description: 'Product type', nullable: true })
  productType: string | null;

  @ApiPropertyOptional({ description: 'Vendor description', nullable: true })
  description: string | null;

  @ApiProperty({
    description: 'Vendor status',
    enum: ['pending', 'approved', 'rejected', 'suspended'],
  })
  status: string;

  @ApiPropertyOptional({ description: 'Commission rate percentage', nullable: true })
  commissionRate: string | null;

  @ApiPropertyOptional({ description: 'ID of user who approved the vendor', nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ description: 'Date of approval', nullable: true })
  approvedAt: Date | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
