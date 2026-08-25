import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, multiSession, twoFactor } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

const socialProviders: any = {};
const trustedProviders: string[] = [];

if (process.env.GITHUB_CLIENT_ID) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  };
  trustedProviders.push("github");
}

if (process.env.GOOGLE_CLIENT_ID) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  };
  trustedProviders.push("google");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: trustedProviders.length > 0 ? trustedProviders : undefined,
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    updateAge: 60 * 60 * 24,       // refresh daily
  },
  plugins: [
    organization(),
    multiSession({
      maximumSessions: 10
    }),
    twoFactor({
      issuer: "PromptWall",
    }),
  ]
});
