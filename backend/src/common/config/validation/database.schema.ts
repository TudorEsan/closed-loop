import Joi from 'joi';

export const databaseValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL is required',
    'string.uri': 'DATABASE_URL must be a valid database connection string',
  }),
});
