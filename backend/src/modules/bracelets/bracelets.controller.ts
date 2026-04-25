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
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BraceletsService } from './bracelets.service';
import { LinkBraceletDto } from './dto/link-bracelet.dto';
import { LinkBraceletByTokenDto } from './dto/link-bracelet-by-token.dto';
import { ListBraceletsDto } from './dto/list-bracelets.dto';
import { ReplaceBraceletDto } from './dto/replace-bracelet.dto';
import { RevokeBraceletDto } from './dto/revoke-bracelet.dto';

const ipFromRequest = (req: Request): string | null =>
  req.ip || req.socket.remoteAddress || null;

@ApiTags('Bracelets')
@ApiBearerAuth()
@Controller()
export class BraceletsController {
  constructor(private readonly bracelets: BraceletsService) {}

  @Get('me/events')
  @Roles('super_admin', 'admin', 'organizer', 'operator', 'vendor', 'attendee')
  async myEvents(@CurrentUser() user: { id: string }) {
    return this.bracelets.myEvents(user.id);
  }

  @Post('me/events/:eventId/link-token')
  @Roles('super_admin', 'admin', 'organizer', 'operator', 'vendor', 'attendee')
  async issueLinkToken(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bracelets.issueLinkToken(eventId, user.id);
  }

  @Post('events/:eventId/bracelets/link-by-token')
  @Roles('super_admin', 'admin', 'organizer', 'operator')
  async linkByToken(
    @Param('eventId') eventId: string,
    @Body() dto: LinkBraceletByTokenDto,
    @CurrentUser() user: { id: string; role: string },
    @Req() req: Request,
  ) {
    return this.bracelets.linkByToken(
      eventId,
      user.id,
      user.role,
      dto,
      ipFromRequest(req),
    );
  }

  @Post('events/:eventId/bracelets')
  @Roles('super_admin', 'admin')
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
  @Roles('super_admin', 'admin', 'operator')
  async list(
    @Param('eventId') eventId: string,
    @Query() query: ListBraceletsDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.list(eventId, user.id, user.role, query);
  }

  @Get('events/:eventId/bracelets/sync-bundle')
  @Roles('super_admin', 'admin', 'operator', 'vendor')
  async syncBundle(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.syncBundle(eventId, user.id, user.role);
  }

  @Get('events/:eventId/bracelets/by-uid/:uid')
  @Roles('super_admin', 'admin', 'operator', 'vendor')
  async findByUid(
    @Param('eventId') eventId: string,
    @Param('uid') uid: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.findByUid(eventId, uid, user.id, user.role);
  }

  @Get('events/:eventId/bracelets/:id')
  @Roles('super_admin', 'admin', 'operator')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.bracelets.findOne(eventId, id, user.id, user.role);
  }

  @Patch('events/:eventId/bracelets/:id/revoke')
  @Roles('super_admin', 'admin')
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
  @Roles('super_admin', 'admin')
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
