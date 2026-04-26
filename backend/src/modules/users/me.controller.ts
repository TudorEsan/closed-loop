import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { MeService } from './me.service';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('memberships')
  async memberships(@CurrentUser() user: { id: string; role: string }) {
    return this.me.getMemberships(user.id, user.role);
  }
}
