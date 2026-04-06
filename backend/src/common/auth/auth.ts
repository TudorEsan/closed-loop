import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Resend } from 'resend';
import * as schema from '../database/schemas';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client, schema });

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: false },
      role: { type: 'string', defaultValue: 'attendee', required: false },
      isActive: { type: 'boolean', defaultValue: true, required: false },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await resend.emails.send({
          from: 'ClosedLoop <noreply@pulsar.money>',
          to: email,
          subject:
            type === 'sign-in'
              ? `Your login code: ${otp}`
              : type === 'email-verification'
                ? `Verify your email: ${otp}`
                : `Your verification code: ${otp}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Your verification code</h2>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">${otp}</p>
              <p>This code expires in 10 minutes.</p>
              <p style="color: #666; font-size: 12px;">If you did not request this, ignore this email.</p>
            </div>
          `,
        });
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
    }),
  ],
  trustedOrigins: [process.env.ALLOWED_ORIGINS || 'http://localhost:5173'],
});

export type Session = typeof auth.$Infer.Session;
