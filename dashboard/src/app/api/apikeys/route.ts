import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;
    
    // If we have an active org, fetch keys for that org. If not, maybe fallback to user's keys?
    // Let's enforce organization level keys
    if (!orgId) {
      // Return empty if no active organization
      return NextResponse.json([]);
    }

    const keys = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        key: apiKeys.key,
        environment: apiKeys.environment,
        budget: apiKeys.budget,
        spend: apiKeys.spend,
        rateLimit: apiKeys.rateLimit,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt
    }).from(apiKeys).where(eq(apiKeys.organizationId, orgId as string));
    
    return NextResponse.json(keys);
  } catch (error) {
    console.error("[API_KEYS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireRole(["admin", "owner"]);
    if (!authCheck.isAuthorized) {
      return authCheck.response;
    }
    
    const { session, orgId } = authCheck;

    const body = await req.json();
    const { name, environment, budget, rateLimit } = body;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    // Check for existing key with the same name in this organization
    const existingKey = await db.select().from(apiKeys).where(
      and(
        eq(apiKeys.organizationId, orgId as string),
        eq(apiKeys.name, name)
      )
    );

    if (existingKey.length > 0) {
      return new NextResponse("An API key with this name already exists", { status: 400 });
    }

    // Generate a secure API key: pw_ + 32 random hex chars
    const rawKey = crypto.randomBytes(16).toString("hex");
    const apiKeyStr = `pw_${environment === 'production' ? 'live' : 'test'}_${rawKey}`;

    const [newKey] = await db.insert(apiKeys).values({
      name,
      key: apiKeyStr,
      environment: environment || 'production',
      budget: budget ? parseInt(budget) : null,
      rateLimit: rateLimit ? parseInt(rateLimit) : 60,
      organizationId: orgId,
      userId: session!.user.id
    }).returning();

    return NextResponse.json(newKey);
  } catch (error) {
    console.error("[API_KEYS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
