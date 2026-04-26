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
import { PaymentsModule } from './modules/payments/payments.module';
import { BraceletsModule } from './modules/bracelets/bracelets.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { EmailModule } from '@common/email/email.module';
import { ScopeModule } from '@common/auth/scope.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    ScopeModule,
    EmailModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    AuthModule,
    UsersModule,
    EventsModule,
    VendorsModule,
    PaymentsModule,
    BraceletsModule,
    TicketsModule,
    ReconciliationModule,
    TransactionsModule,
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
