import { Injectable } from '@nestjs/common';
import { auth, Session } from '@common/auth/auth';

@Injectable()
export class AuthService {
  async getSession(headers: Headers): Promise<Session | null> {
    const session = await auth.api.getSession({ headers });
    return session;
  }

  async getUser(userId: string) {
    // Use drizzle directly if needed for custom queries
    return null; // placeholder
  }
}
