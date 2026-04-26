import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ReconciliationService } from './reconciliation.service';
import { SyncRequestDto } from './dto/sync.dto';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@Controller('events/:eventId/wristbands/:wristbandUid')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('sync')
  @ApiOperation({
    summary:
      'Apply a batch of offline debits and return the chip-write directive',
  })
  async sync(
    @Param('eventId') eventId: string,
    @Param('wristbandUid') wristbandUid: string,
    @Body() body: SyncRequestDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.reconciliation.sync(
      eventId,
      wristbandUid,
      user.id,
      user.role,
      body,
    );
  }
}
