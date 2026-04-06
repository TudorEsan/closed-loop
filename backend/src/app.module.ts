import { Module } from '@nestjs/common';
import { ConfigModule } from '@common/config/config.module';
import { DrizzleModule } from '@common/database/drizzle.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerConfigService } from '@common/config/services/throttler-config.service';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
