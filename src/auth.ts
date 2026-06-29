import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { env, hasGoogle } from "@/lib/env";

/**
 * Auth.js v5 configuration. Google provides both sign-in and the Calendar OAuth
 * scopes. Degrades gracefully: if Google credentials are absent the provider
 * list is empty and the app runs on mock calendar data (Phase 2 behaviour).
 */

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const config: NextAuthConfig = {
  secret: env.nextAuthSecret(),
  trustHost: true,
  providers: hasGoogle()
    ? [
        Google({
          clientId: env.googleClientId()!,
          clientSecret: env.googleClientSecret()!,
          authorization: {
            params: {
              scope: GOOGLE_SCOPES,
              access_type: "offline",
              prompt: "consent",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    jwt({ token, account }) {
      // First sign-in: capture the tokens. The Calendar layer refreshes as needed.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
