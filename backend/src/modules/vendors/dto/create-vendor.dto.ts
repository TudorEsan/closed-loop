import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class CreateVendorDto {
  @ApiProperty({ description: 'Business name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  businessName: string;

  @ApiProperty({ description: 'Contact person name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactPerson: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Type of product sold', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  productType?: string;

  @ApiPropertyOptional({ description: 'Vendor description' })
  @IsOptional()
  @IsString()
  description?: string;
}
