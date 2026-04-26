import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BraceletsService } from './bracelets.service';
import { LinkBraceletDto } from './dto/link-bracelet.dto';
import { ListBraceletsDto } from './dto/list-bracelets.dto';
import { ReplaceBraceletDto } from './dto/replace-bracelet.dto';
import { RevokeBraceletDto } from './dto/revoke-bracelet.dto';

const ipFromRequest = (req: Request): string | null =>
  req.ip || req.socket.remoteAddress || null;

// Authorization for these endpoints lives in BraceletsService via ScopeService.
// We don't gate on a global role here because event/vendor authority comes
// from membership rows, not from `users.role`.
@ApiTags('Bracelets')
@ApiBearerAuth()
@Controller()
export class BraceletsController {
  constructor(private readonly bracelets: BraceletsService) {}

  @Get('me/events')
  async myEvents(@CurrentUser() user: { id: string }) {
    return this.bracelets.myEvents(user.id);
  }

  @Get('me/bracelets')
  async myBracelets(@CurrentUser() user: { id: string }) {
    return this.bracelets.myBracelets(user.id);
  }

  @Get('me/bracelets/:id/transactions')
  async myBraceletTransactions(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bracelets.myBraceletTransactions(user.id, id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Post('events/:eventId/bracelets')
  async link(
    @Param('eventId') eventId: string,
    @Body() dto: LinkBraceletDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.bracelets.link(
      eventId,
      user.id,
      user.role,
      dto,
      ipFromRequest(req),
    );
  }

  @Get('events/:eventId/bracelets')
  async list(
    @Param('eventId') eventId: string,
    @Query() query: ListBraceletsDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.list(eventId, user.id, user.role, query);
  }

  @Get('events/:eventId/bracelets/sync-bundle')
  async syncBundle(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.syncBundle(eventId, user.id, user.role);
  }

  @Get('events/:eventId/bracelets/by-uid/:uid')
  async findByUid(
    @Param('eventId') eventId: string,
    @Param('uid') uid: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.findByUid(eventId, uid, user.id, user.role);
  }

  @Get('events/:eventId/bracelets/:id')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.findOne(eventId, id, user.id, user.role);
  }

  @Patch('events/:eventId/bracelets/:id/revoke')
  async revoke(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: RevokeBraceletDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.bracelets.revoke(
      eventId,
      id,
      user.id,
      user.role,
      dto,
      ipFromRequest(req),
    );
  }

  @Post('events/:eventId/bracelets/:id/replace')
  async replace(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: ReplaceBraceletDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.bracelets.replace(
      eventId,
      id,
      user.id,
      user.role,
      dto,
      ipFromRequest(req),
    );
  }
}
