/**
 * Centralized, typed access to environment variables.
 *
 * Integrations read their keys through these helpers so that "is this feature
 * configured?" is a single, testable question. Nothing here throws at import
 * time — missing keys cause graceful degradation (Phase 3), not crashes.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  databaseUrl: () => read("DATABASE_URL"),
  anthropicApiKey: () => read("ANTHROPIC_API_KEY"),
  nextAuthSecret: () => read("NEXTAUTH_SECRET"),
  googleClientId: () => read("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => read("GOOGLE_CLIENT_SECRET"),
  cronSecret: () => read("CRON_SECRET"),
} as const;

/** True when the Anthropic-backed decision engine can be used (else heuristic). */
export const hasAnthropic = (): boolean => env.anthropicApiKey() !== undefined;

/** True when Google OAuth (sign-in + Calendar) is configured. */
export const hasGoogle = (): boolean =>
  env.googleClientId() !== undefined && env.googleClientSecret() !== undefined;
