import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { BraceletsConfig } from '@app/common/types/bracelets.types';

// Compact token used by SoftPOS to verify offline that a wristband UID
// belongs to a given user for a given event. Format mirrors a JWT but
// without the JOSE header noise: base64url(payload).base64url(hmac).
//
// Why HMAC and not asymmetric: thesis ch4 already uses a symmetric trust
// model with a shared AES key between chip and reader. Adding HMAC here
// stays consistent and avoids shipping a second key pair to the field.

export type BraceletTokenPayload = {
  kind?: 'bundle';
  assignmentId: string;
  eventId: string;
  userId: string;
  wristbandUid: string;
  issuedAt: number;
  expiresAt: number;
  v: number;
};

const base64urlEncode = (input: Buffer | string) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64urlDecode = (input: string) => {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
};

@Injectable()
export class BraceletTokenService {
  private readonly key: Buffer;
  private readonly graceHours: number;

  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<BraceletsConfig>('bracelets');
    if (!cfg?.signingKey) {
      throw new Error('BRACELET_SIGNING_KEY is not configured');
    }
    this.key = Buffer.from(cfg.signingKey, 'utf8');
    this.graceHours = cfg.tokenGraceHours;
  }

  // Default expiry rule used when an assignment does not pin its own.
  expiryFromEventEnd(eventEnd: Date): Date {
    return new Date(eventEnd.getTime() + this.graceHours * 60 * 60 * 1000);
  }

  issue(payload: BraceletTokenPayload): string {
    const body = base64urlEncode(
      JSON.stringify({ kind: 'bundle', ...payload }),
    );
    const sig = createHmac('sha256', this.key).update(body).digest();
    return `${body}.${base64urlEncode(sig)}`;
  }

  verify(token: string, expected: { eventId: string }): BraceletTokenPayload {
    const payload = this.decodeAndVerify(token) as BraceletTokenPayload & {
      kind?: string;
    };
    if (payload.kind && payload.kind !== 'bundle') {
      throw new UnauthorizedException(
        'Wrong token kind: expected a bundle token',
      );
    }
    if (payload.eventId !== expected.eventId) {
      throw new UnauthorizedException(
        'Bracelet token does not match this event',
      );
    }
    return payload;
  }

  private decodeAndVerify(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Malformed bracelet token');
    }
    const [body, providedSig] = parts;

    const expectedSig = createHmac('sha256', this.key).update(body).digest();
    const providedSigBuf = base64urlDecode(providedSig);

    if (
      providedSigBuf.length !== expectedSig.length ||
      !timingSafeEqual(providedSigBuf, expectedSig)
    ) {
      throw new UnauthorizedException('Bracelet token signature mismatch');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(base64urlDecode(body).toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      throw new BadRequestException('Bracelet token payload is not valid JSON');
    }

    if (typeof payload.expiresAt !== 'number') {
      throw new BadRequestException('Bracelet token missing expiresAt');
    }
    if (Date.now() > (payload.expiresAt as number)) {
      throw new UnauthorizedException('Bracelet token has expired');
    }

    return payload;
  }
}
