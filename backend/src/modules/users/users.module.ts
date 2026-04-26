import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  controllers: [UsersController, MeController],
  providers: [UsersService, MeService],
  exports: [UsersService],
})
export class UsersModule {}
