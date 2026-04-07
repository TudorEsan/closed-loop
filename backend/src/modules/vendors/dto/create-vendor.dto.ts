import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsIn,
  MaxLength,
} from 'class-validator';

export const VENDOR_PRODUCT_TYPES = [
  'food',
  'drinks',
  'alcohol',
  'merchandise',
  'art',
  'services',
  'other',
] as const;

export type VendorProductType = (typeof VENDOR_PRODUCT_TYPES)[number];

export class CreateVendorDto {
  @ApiProperty({ description: 'Business name', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Business name is required' })
  @MaxLength(255)
  businessName: string;

  @ApiProperty({ description: 'Contact person name', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Contact person is required' })
  @MaxLength(255)
  contactPerson: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Contact email must be a valid email' })
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Type of product sold',
    enum: VENDOR_PRODUCT_TYPES,
  })
  @IsOptional()
  @IsIn(VENDOR_PRODUCT_TYPES, {
    message: `Product type must be one of: ${VENDOR_PRODUCT_TYPES.join(', ')}`,
  })
  productType?: VendorProductType;

  @ApiPropertyOptional({ description: 'Vendor description', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Target user ID to assign as vendor owner (admin only)',
  })
  @IsOptional()
  @IsString()
  targetUserId?: string;
}
