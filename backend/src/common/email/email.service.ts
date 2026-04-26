import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
};

// Thin wrapper over Resend so the rest of the codebase does not need to
// know about the SDK. The API key comes from the environment, same as
// in better-auth's email-otp configuration.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client = new Resend(process.env.RESEND_API_KEY);
  private readonly from = process.env.EMAIL_FROM ||
    'ClosedLoop <noreply@pulsar.money>';

  async send(args: SendArgs): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      this.logger.warn(
        `RESEND_API_KEY missing, skipping email to ${args.to} (${args.subject})`,
      );
      return;
    }
    const { error } = await this.client.emails.send({
      from: this.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: args.attachments,
    });
    if (error) {
      this.logger.error(
        `Failed to send email to ${args.to}: ${JSON.stringify(error)}`,
      );
      throw new Error('Failed to send email');
    }
  }
}
