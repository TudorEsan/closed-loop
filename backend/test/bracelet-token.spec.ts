import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BraceletTokenService,
  BraceletTokenPayload,
} from '../src/modules/bracelets/bracelet-token.service';

// Pure unit tests for BraceletTokenService. No DB, no Nest module.
// We construct the service directly with a fake ConfigService that only
// returns the bracelets config block, mirroring how ConfigService.get works.

const SIGNING_KEY = 'a-very-fake-but-32-byte-key-1234';

const buildConfigService = (
  overrides: Partial<{ signingKey: string; tokenGraceHours: number }> = {},
) => {
  return {
    get: <T>(key: string): T => {
      if (key === 'bracelets') {
        return {
          signingKey: SIGNING_KEY,
          tokenGraceHours: 48,
          ...overrides,
        } as unknown as T;
      }
      return undefined as unknown as T;
    },
  } as unknown as ConfigService;
};

const buildPayload = (
  overrides: Partial<BraceletTokenPayload> = {},
): BraceletTokenPayload => ({
  assignmentId: randomUUID(),
  eventId: randomUUID(),
  userId: randomUUID(),
  wristbandUid: '04:A1:B2:C3:D4:E5:F6',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 1000,
  v: 1,
  ...overrides,
});

describe('BraceletTokenService', () => {
  describe('verify', () => {
    it('verify, given a token just issued for the same event, returns the payload', () => {
      const service = new BraceletTokenService(buildConfigService());
      const payload = buildPayload();

      const token = service.issue(payload);
      const decoded = service.verify(token, { eventId: payload.eventId });

      expect(decoded).toEqual(payload);
    });

    it('verify, when payload was tampered with, rejects with UnauthorizedException', () => {
      const service = new BraceletTokenService(buildConfigService());
      const payload = buildPayload();

      const token = service.issue(payload);
      const [body, sig] = token.split('.');
      const bodyBytes = Buffer.from(body, 'utf8');
      bodyBytes[0] = bodyBytes[0] === 65 ? 66 : 65;
      const tampered = `${bodyBytes.toString('utf8')}.${sig}`;

      expect(() =>
        service.verify(tampered, { eventId: payload.eventId }),
      ).toThrow(UnauthorizedException);
    });

    it('verify, when signature was tampered with, rejects with UnauthorizedException', () => {
      const service = new BraceletTokenService(buildConfigService());
      const payload = buildPayload();

      const token = service.issue(payload);
      const [body, sig] = token.split('.');
      const sigBytes = Buffer.from(sig, 'utf8');
      sigBytes[0] = sigBytes[0] === 65 ? 66 : 65;
      const tampered = `${body}.${sigBytes.toString('utf8')}`;

      expect(() =>
        service.verify(tampered, { eventId: payload.eventId }),
      ).toThrow(UnauthorizedException);
    });

    it('verify, when expected eventId differs from payload eventId, rejects with UnauthorizedException', () => {
      const service = new BraceletTokenService(buildConfigService());
      const payload = buildPayload();

      const token = service.issue(payload);
      const otherEventId = randomUUID();

      expect(() => service.verify(token, { eventId: otherEventId })).toThrow(
        UnauthorizedException,
      );
    });

    it('verify, when expiresAt is in the past, rejects with UnauthorizedException', () => {
      const service = new BraceletTokenService(buildConfigService());
      const payload = buildPayload({ expiresAt: Date.now() - 1000 });

      const token = service.issue(payload);

      expect(() => service.verify(token, { eventId: payload.eventId })).toThrow(
        UnauthorizedException,
      );
    });

    it('verify, when token has no dot separator, rejects with BadRequestException', () => {
      const service = new BraceletTokenService(buildConfigService());

      const malformed = 'this-is-not-a-valid-token';

      expect(() =>
        service.verify(malformed, { eventId: randomUUID() }),
      ).toThrow(BadRequestException);
    });
  });

  describe('expiryFromEventEnd', () => {
    it('expiryFromEventEnd, given event end and 48h grace, returns event end plus 48 hours', () => {
      const service = new BraceletTokenService(
        buildConfigService({ tokenGraceHours: 48 }),
      );
      const eventEnd = new Date('2030-06-15T22:00:00Z');

      const expiry = service.expiryFromEventEnd(eventEnd);

      expect(expiry.getTime()).toBe(eventEnd.getTime() + 48 * 60 * 60 * 1000);
    });
  });

  describe('constructor', () => {
    it('constructor, when signingKey is missing, throws on construction', () => {
      const cfg = {
        get: () => ({ signingKey: '', tokenGraceHours: 48 }),
      } as unknown as ConfigService;

      expect(() => new BraceletTokenService(cfg)).toThrow(
        'BRACELET_SIGNING_KEY is not configured',
      );
    });
  });
});
