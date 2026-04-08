import Joi from 'joi';

export const paymentsValidationSchema = Joi.object({
  PAYMENTS_PROVIDER: Joi.string().valid('stripe').default('stripe'),
  PAYMENTS_CURRENCY: Joi.string().length(3).lowercase().default('eur'),
  STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').default(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').default(''),
});
