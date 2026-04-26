import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { UpdateEventStatusDto } from './dto/update-event-status.dto.js';
import { EventQueryDto } from './dto/event-query.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  create(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List events with optional filters' })
  findAll(
    @CurrentUser() user: { id: string; role: string },
    @Query() query: EventQueryDto,
  ) {
    return this.eventsService.findAll(user.id, user.role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details by ID' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.findById(id, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event details' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, user.id, user.role, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition event lifecycle status' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.eventsService.updateStatus(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event (draft only)' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.delete(id, user.id, user.role);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a team member to the event' })
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: AddMemberDto,
  ) {
    return this.eventsService.addMember(id, user.id, user.role, dto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List event team members' })
  getMembers(@Param('id') id: string) {
    return this.eventsService.getMembers(id);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a team member from the event' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.removeMember(id, memberId, user.id, user.role);
  }
}
