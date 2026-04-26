import { Module } from '@nestjs/common';
import { ConfigModule } from '@common/config/config.module';
import { DrizzleModule } from '@common/database/drizzle.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerConfigService } from '@common/config/services/throttler-config.service';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuthGuard } from '@common/guards/auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { VendorsModule } from './modules/vendors/vendors.module';
import { EventsModule } from './modules/events/events.module';
import { DevicesModule } from './modules/devices/devices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { BraceletsModule } from './modules/bracelets/bracelets.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { EmailModule } from '@common/email/email.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    EmailModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    AuthModule,
    UsersModule,
    EventsModule,
    VendorsModule,
    DevicesModule,
    WalletsModule,
    PaymentsModule,
    BraceletsModule,
    TicketsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
