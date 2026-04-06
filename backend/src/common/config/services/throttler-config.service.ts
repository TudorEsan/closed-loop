import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerOptionsFactory,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ThrottlerConfig } from '@common/config/configurations/throttler.config';

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(
    private readonly configService: ConfigService<{
      throttler: ThrottlerConfig;
    }>,
  ) {}

  createThrottlerOptions():
    | ThrottlerModuleOptions
    | Promise<ThrottlerModuleOptions> {
    const { ttl, limit } = this.configService.get('throttler', {
      infer: true,
    }) as ThrottlerConfig;
    return [{ ttl, limit }];
  }
}
