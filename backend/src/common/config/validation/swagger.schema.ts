import Joi from 'joi';

export const swaggerValidationSchema = Joi.object({
  SWAGGER_TITLE: Joi.string().default('Financial API'),
  SWAGGER_DESCRIPTION: Joi.string().default('Personal finance management API'),
  SWAGGER_VERSION: Joi.string().default('1.0'),
  SWAGGER_PATH: Joi.string().default('api-docs'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
});
