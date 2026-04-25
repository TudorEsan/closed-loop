import Joi from 'joi';

export const braceletsValidationSchema = Joi.object({
  BRACELET_SIGNING_KEY: Joi.string().min(32).required(),
  BRACELET_TOKEN_GRACE_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(720)
    .default(48),
});
