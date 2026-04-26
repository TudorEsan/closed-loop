import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { IssueTicketDto } from './dto/issue-ticket.dto';
import { RedeemTicketDto } from './dto/redeem-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';

const ipFromRequest = (req: Request): string | null =>
  req.ip || req.socket.remoteAddress || null;

// Per-event authorization happens in TicketsService via ScopeService.
@ApiTags('Tickets')
@ApiBearerAuth()
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('events/:eventId/tickets')
  async issue(
    @Param('eventId') eventId: string,
    @Body() dto: IssueTicketDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.tickets.issue(
      eventId,
      user.id,
      user.role,
      dto,
      ipFromRequest(req),
    );
  }

  @Get('events/:eventId/tickets')
  async list(
    @Param('eventId') eventId: string,
    @Query() query: ListTicketsDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.tickets.list(eventId, user.id, user.role, query);
  }

  @Delete('events/:eventId/tickets/:id')
  async revoke(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.tickets.revoke(
      eventId,
      id,
      user.id,
      user.role,
      ipFromRequest(req),
    );
  }

  @Post('tickets/redeem')
  async redeem(
    @Body() dto: RedeemTicketDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.tickets.redeem(user.id, user.role, dto, ipFromRequest(req));
  }
}
