import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MaxLength,
} from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Unique device identifier (hardware ID)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceIdentifier: string;

  @ApiPropertyOptional({ description: 'Friendly device name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;

  @ApiProperty({ description: 'Device model (e.g. Samsung Galaxy A54)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceModel: string;

  @ApiProperty({ description: 'Operating system name (e.g. Android, iOS)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  osName: string;

  @ApiProperty({ description: 'OS version (e.g. 14.0)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  osVersion: string;

  @ApiProperty({ description: 'POS app version (e.g. 1.2.3)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  appVersion: string;

  @ApiPropertyOptional({ description: 'Screen width in pixels' })
  @IsOptional()
  @IsNumber()
  screenWidth?: number;

  @ApiPropertyOptional({ description: 'Screen height in pixels' })
  @IsOptional()
  @IsNumber()
  screenHeight?: number;

  @ApiPropertyOptional({ description: 'GPS latitude at registration' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS longitude at registration' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    description: 'Registration token provided by admin or vendor owner',
  })
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @ApiPropertyOptional({ description: 'Device fingerprint hash' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  deviceFingerprint?: string;
}
