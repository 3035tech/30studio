import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

// Schema-only configuration for the official Better Auth Drizzle generator.
// The runtime roles are configured in lib/server/better-auth.ts.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [organization()],
});
