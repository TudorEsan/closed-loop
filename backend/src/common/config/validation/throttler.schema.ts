import Joi from 'joi';

export const throttlerValidationSchema = Joi.object({
  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
});
