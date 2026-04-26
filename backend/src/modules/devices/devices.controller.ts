import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RejectDeviceDto } from './dto/approve-device.dto';
import { AssignOperatorDto } from './dto/assign-operator.dto';
import { CreateRegistrationTokenDto } from './dto/create-registration-token.dto';
import { DeviceQueryDto } from './dto/device-query.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  // ---- Registration Tokens ----

  @Post('events/:eventId/vendors/:vendorId/devices/tokens')
  async createRegistrationToken(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateRegistrationTokenDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.createRegistrationToken(
      eventId,
      vendorId,
      user.id,
      user.role,
      dto,
    );
  }

  // ---- Device Registration (uses registration token for auth) ----

  @Post('events/:eventId/vendors/:vendorId/devices/register')
  async registerDevice(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: RegisterDeviceDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.devicesService.registerDevice(
      eventId,
      vendorId,
      dto,
      ipAddress,
    );
  }

  // ---- Device Listing ----

  @Get('events/:eventId/vendors/:vendorId/devices')
  async findByVendor(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Query() query: DeviceQueryDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.findByVendor(
      eventId,
      vendorId,
      user.id,
      user.role,
      query,
    );
  }

  @Get('events/:eventId/devices')
  async findAllByEvent(
    @Param('eventId') eventId: string,
    @Query() query: DeviceQueryDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.findAllByEvent(
      eventId,
      user.id,
      user.role,
      query,
    );
  }

  @Get('events/:eventId/devices/:id')
  async findById(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.findById(eventId, id, user.id, user.role);
  }

  // ---- Device Approval ----

  @Patch('events/:eventId/devices/:id/approve')
  async approveDevice(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.approveDevice(eventId, id, user.id, user.role);
  }

  @Patch('events/:eventId/devices/:id/reject')
  async rejectDevice(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: RejectDeviceDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.rejectDevice(
      eventId,
      id,
      user.id,
      user.role,
      dto,
    );
  }

  @Patch('events/:eventId/devices/:id/block')
  async blockDevice(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.blockDevice(eventId, id, user.id, user.role);
  }

  @Patch('events/:eventId/devices/:id/unblock')
  async unblockDevice(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.unblockDevice(eventId, id, user.id, user.role);
  }

  // ---- Device Operators ----

  @Post('events/:eventId/devices/:id/operators')
  async assignOperator(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: AssignOperatorDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.assignOperator(
      eventId,
      id,
      user.id,
      user.role,
      dto,
    );
  }

  @Get('events/:eventId/devices/:id/operators')
  async findOperators(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.findOperators(eventId, id, user.id, user.role);
  }

  @Delete('events/:eventId/devices/:id/operators/:operatorId')
  async revokeOperator(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Param('operatorId') operatorId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.devicesService.revokeOperator(
      eventId,
      id,
      operatorId,
      user.id,
      user.role,
    );
  }
}
