import { Module } from '@nestjs/common';
import { BraceletsController } from './bracelets.controller';
import { BraceletsService } from './bracelets.service';
import { BraceletTokenService } from './bracelet-token.service';

@Module({
  controllers: [BraceletsController],
  providers: [BraceletsService, BraceletTokenService],
  exports: [BraceletsService, BraceletTokenService],
})
export class BraceletsModule {}
