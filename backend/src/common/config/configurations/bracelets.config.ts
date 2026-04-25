import { registerAs } from '@nestjs/config';
import { BraceletsConfig } from '@app/common/types/bracelets.types';

// Settings for the bracelet linking module. The signing key is used to
// produce HMAC tokens that SoftPOS devices can verify offline. Generate
// a fresh value with `openssl rand -base64 32` and store it as
// BRACELET_SIGNING_KEY in .env. The grace period extends a token's
// validity past event end so reconciliation has room to breathe.
export default registerAs(
  'bracelets',
  (): BraceletsConfig => ({
    signingKey: process.env.BRACELET_SIGNING_KEY || '',
    tokenGraceHours: Number(process.env.BRACELET_TOKEN_GRACE_HOURS) || 48,
  }),
);
