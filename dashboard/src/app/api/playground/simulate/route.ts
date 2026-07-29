import { db } from "@/lib/db";
import { policies } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    const body = await req.json();
    const { prompt, environment } = body;

    if (!prompt) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Fetch active policies for this scope
    const activePolicies = await db.select().from(policies).where(
      orgId ? and(
        eq(policies.organizationId, orgId),
        eq(policies.enabled, true),
        eq(policies.environment, environment || 'production')
      ) : and(
        eq(policies.userId, userId),
        eq(policies.organizationId, 'personal'),
        eq(policies.enabled, true),
        eq(policies.environment, environment || 'production')
      )
    );

    // Mock Simulation Logic
    // In a real scenario, this might call out to the Rust/Python policy engine's dry-run API.
    let decision = "allow";
    let matchedRule = null;
    let redactedPrompt = prompt;

    for (const policy of activePolicies) {
      // Very basic regex mock based on policy.match or policy.name
      // Assuming policy.match might contain comma separated words or regex
      if (policy.match) {
        const keywords = policy.match.split(',').map((k: string) => k.trim().toLowerCase());
        const promptLower = prompt.toLowerCase();
        
        for (const keyword of keywords) {
          if (promptLower.includes(keyword)) {
            matchedRule = policy.name;
            if (policy.action === 'block') {
              decision = 'block';
              break;
            } else if (policy.action === 'redact') {
              decision = 'redact';
              // Simple mock redaction
              const regex = new RegExp(keyword, 'gi');
              redactedPrompt = redactedPrompt.replace(regex, '[REDACTED]');
            }
          }
        }
      }
      if (decision === 'block') break; // stop evaluating if blocked
    }

    return NextResponse.json({
      decision,
      matchedRule,
      originalPrompt: prompt,
      sanitizedPrompt: redactedPrompt,
      latency: Math.floor(Math.random() * 20) + 10, // Mock latency 10-30ms
    });

  } catch (error) {
    console.error("[PLAYGROUND_SIMULATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
