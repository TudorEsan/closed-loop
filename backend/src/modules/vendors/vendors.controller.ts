import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AddVendorMemberDto } from './dto/add-member.dto';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('events/:eventId/vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.create(eventId, user.id, user.role, dto);
  }

  @Get()
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: VendorQueryDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.findAllByEvent(
      eventId,
      user.id,
      user.role,
      query,
    );
  }

  @Get(':id')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.findById(eventId, id, user.id, user.role);
  }

  @Patch(':id')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.update(eventId, id, user.id, user.role, dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorStatusDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.updateStatus(
      eventId,
      id,
      user.id,
      user.role,
      dto,
    );
  }

  @Patch(':id/commission')
  async updateCommission(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.updateCommission(
      eventId,
      id,
      user.id,
      user.role,
      dto,
    );
  }

  @Delete(':id')
  async remove(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.remove(eventId, id, user.id, user.role);
  }

  // ---- Vendor Members ----

  @Get(':vendorId/members')
  async findMembers(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.findMembers(
      eventId,
      vendorId,
      user.id,
      user.role,
    );
  }

  @Post(':vendorId/members')
  async addMember(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: AddVendorMemberDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.addMember(
      eventId,
      vendorId,
      user.id,
      user.role,
      dto,
    );
  }

  @Patch(':vendorId/members/:memberId')
  async updateMemberRole(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.updateMemberRole(
      eventId,
      vendorId,
      memberId,
      user.id,
      user.role,
      dto.role,
    );
  }

  @Delete(':vendorId/members/:memberId')
  async removeMember(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.removeMember(
      eventId,
      vendorId,
      memberId,
      user.id,
      user.role,
    );
  }
}
