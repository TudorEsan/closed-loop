import { registerAs } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SwaggerConfig } from '@app/common/types/swagger.type';

export default registerAs(
  'swagger',
  (): SwaggerConfig => ({
    title: process.env.SWAGGER_TITLE || 'Financial API',
    description:
      process.env.SWAGGER_DESCRIPTION || 'Personal finance management API',
    version: process.env.SWAGGER_VERSION || '1.0',
    path: process.env.SWAGGER_PATH || 'api-docs',
    enabled: process.env.SWAGGER_ENABLED !== 'false',
  }),
);

export const swaggerHelpers = {
  createConfig: (
    configService: ConfigService<SwaggerConfig>,
  ): Omit<OpenAPIObject, 'paths'> => {
    const swaggerConfig: SwaggerConfig = configService.get<SwaggerConfig>(
      'swagger',
      { infer: true },
    ) as SwaggerConfig;

    if (!swaggerConfig) {
      throw new Error('Swagger configuration not found');
    }

    return new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .build();
  },

  getPath: (configService: ConfigService<SwaggerConfig>) => {
    const path = configService.get<string>('swagger.path', { infer: true });
    if (!path) {
      throw new Error('Swagger path not found');
    }
    return path;
  },
};
