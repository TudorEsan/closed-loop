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
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('events/:eventId/vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @Roles('super_admin', 'admin', 'vendor')
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.create(eventId, user.id, user.role, dto);
  }

  @Get()
  @Roles('super_admin', 'admin', 'operator', 'vendor')
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
  @Roles('super_admin', 'admin', 'operator', 'vendor')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.findById(eventId, id, user.id, user.role);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'vendor')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.update(eventId, id, user.id, user.role, dto);
  }

  @Patch(':id/status')
  @Roles('super_admin', 'admin')
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
  @Roles('super_admin', 'admin')
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
  @Roles('super_admin', 'admin')
  async remove(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.remove(eventId, id, user.id, user.role);
  }

  // ---- Vendor Members ----

  @Get(':vendorId/members')
  @Roles('super_admin', 'admin', 'vendor')
  async findMembers(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.findMembers(eventId, vendorId, user.id, user.role);
  }

  @Post(':vendorId/members/invite')
  @Roles('super_admin', 'admin', 'vendor')
  async inviteMember(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.inviteMember(eventId, vendorId, user.id, user.role, dto);
  }

  @Patch(':vendorId/members/:memberId')
  @Roles('super_admin', 'admin', 'vendor')
  async updateMemberRole(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.updateMemberRole(
      eventId, vendorId, memberId, user.id, user.role, dto.role,
    );
  }

  @Delete(':vendorId/members/:memberId')
  @Roles('super_admin', 'admin', 'vendor')
  async removeMember(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.removeMember(eventId, vendorId, memberId, user.id, user.role);
  }
}

// Separate controller for invitation acceptance (not nested under events)
@ApiTags('Vendor Invitations')
@ApiBearerAuth()
@Controller('vendor-invitations')
export class VendorInvitationsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post(':token/accept')
  @Roles('super_admin', 'admin', 'vendor', 'attendee')
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.vendorsService.acceptInvitation(token, user.id);
  }
}
