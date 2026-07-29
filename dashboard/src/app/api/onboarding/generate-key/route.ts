import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, policies } from '@/lib/db/schema';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    // Generate a secure API key
    const prefix = "pw_";
    const keyBytes = randomBytes(24).toString('hex');
    const newKey = `${prefix}${keyBytes}`;

    // 1. Create Default API Key
    const insertedKey = await db.insert(apiKeys).values({
      name: "Default Key",
      key: newKey,
      organizationId: orgId || 'personal',
      userId: userId,
      environment: 'production'
    }).returning();

    // 2. Create Default Prompt Injection Policy
    const defaultPolicyContent = `# Default PromptWall Policy\n\nversion: "1.0"\npolicies:\n  - name: "Block Prompt Injection"\n    type: "regex"\n    match: "(?i)(ignore all previous instructions|system prompt|bypass)"\n    action: "block"`;
    
    await db.insert(policies).values({
      name: "Default Prompt Injection Guard",
      content: defaultPolicyContent,
      action: "block",
      priority: 10,
      enabled: true,
      organizationId: orgId || 'personal',
      userId: userId,
      environment: 'production'
    });

    return NextResponse.json({ key: newKey }, { status: 201 });
  } catch (error) {
    console.error('Onboarding generate-key error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
