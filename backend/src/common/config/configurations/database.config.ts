import { DatabaseConfig } from '@app/common/types/database.types';
import { registerAs } from '@nestjs/config';

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL || '',
  }),
);
