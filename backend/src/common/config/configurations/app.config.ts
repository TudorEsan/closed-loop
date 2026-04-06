import { AppConfig } from '@app/common/types/app.types';
import { registerAs } from '@nestjs/config';

export default registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || '1',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
  }),
);
