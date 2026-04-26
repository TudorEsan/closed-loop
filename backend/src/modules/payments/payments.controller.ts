import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

import { PaymentsService } from './payments.service';
import { CreateTopupIntentDto } from './dto/create-topup-intent.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  // Mobile app calls this with the bracelet it is wearing and the desired
  // amount, gets back a client secret that the Stripe SDK can use to present
  // the PaymentSheet. The credit lands on that exact bracelet, balance is
  // event-scoped now.
  @Post('bracelets/topup/intent')
  @ApiOperation({
    summary: 'Create a topup payment intent for a bracelet the caller owns',
  })
  async createTopupIntent(
    @Body() dto: CreateTopupIntentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.createTopupIntent(
      user.id,
      dto.eventBraceletId,
      dto.amount,
    );
  }

  // Webhook from the payment provider. Public so the provider can reach it,
  // signature is verified inside parseWebhook so forged events are rejected.
  // The route uses the raw request body (configured in main.ts) so the
  // signature check works against the exact bytes the provider sent.
  @Public()
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider webhook (Stripe today)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Webhook raw body missing');
    }
    if (!signature) {
      throw new BadRequestException('Missing provider signature header');
    }

    const event = this.provider.parseWebhook(req.rawBody, signature);
    await this.paymentsService.handleWebhookEvent(event);
    return { received: true };
  }
}
