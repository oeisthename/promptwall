import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policies, policyVersions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import * as yaml from 'js-yaml';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const envFilter = url.searchParams.get("environment") || "production";
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    let allPolicies;
    if (orgId) {
      allPolicies = await db.select().from(policies).where(and(eq(policies.organizationId, orgId), eq(policies.environment, envFilter))).orderBy(policies.priority);
    } else {
      allPolicies = await db.select().from(policies).where(and(eq(policies.userId, userId), eq(policies.organizationId, 'personal'), eq(policies.environment, envFilter))).orderBy(policies.priority);
    }
    
    return NextResponse.json(allPolicies);
  } catch (error) {
    console.error('Policies GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    const body = await req.json();
    const { id, name, content, isActive, environment = "production" } = body;
    
    // Parse YAML to extract metadata if possible
    let action = 'block';
    let priority = 0;
    try {
      const parsed = yaml.load(content) as any;
      if (parsed?.action) action = parsed.action;
      if (parsed?.priority) priority = parsed.priority;
    } catch (e) {
      console.warn("Failed to parse YAML policy for metadata extraction", e);
    }

    let savedPolicy;
    
    if (id && id !== "new") {
      // Update existing policy
      const existing = await db.select().from(policies)
        .where(orgId ? and(eq(policies.id, id), eq(policies.organizationId, orgId)) 
                     : and(eq(policies.id, id), eq(policies.userId, userId), eq(policies.organizationId, 'personal')))
        .limit(1);
      
      if (existing.length === 0) return new NextResponse("Not Found", { status: 404 });
      
      const updated = await db.update(policies).set({
        name,
        content,
        action,
        priority,
        enabled: isActive,
        environment,
        updatedAt: new Date()
      }).where(eq(policies.id, id)).returning();
      savedPolicy = updated[0];
    } else {
      // Check if policy exists by name in this scope
      const existing = await db.select().from(policies)
        .where(orgId ? and(eq(policies.name, name), eq(policies.organizationId, orgId))
                     : and(eq(policies.name, name), eq(policies.userId, userId), eq(policies.organizationId, 'personal')))
        .limit(1);
      
      if (existing.length > 0) return new NextResponse("Policy with this name already exists", { status: 400 });

      // Insert
      const inserted = await db.insert(policies).values({
        name,
        content,
        action,
        priority,
        enabled: isActive,
        organizationId: orgId || 'personal',
        userId: userId,
        environment: environment
      }).returning();
      savedPolicy = inserted[0];
    }

    // Save to version history
    await db.insert(policyVersions).values({
      policyId: savedPolicy.id,
      content: content,
      versionMessage: 'Updated via dashboard'
    });

    return NextResponse.json(savedPolicy, { status: 201 });
  } catch (error) {
    console.error('Policies POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify it belongs to scope
    const existing = await db.select().from(policies)
      .where(orgId ? and(eq(policies.id, id), eq(policies.organizationId, orgId))
                   : and(eq(policies.id, id), eq(policies.userId, userId), eq(policies.organizationId, 'personal')))
      .limit(1);
    
    if (existing.length === 0) return new NextResponse("Not Found", { status: 404 });

    // Delete policy versions first (foreign key cascade might not be set up)
    await db.delete(policyVersions).where(eq(policyVersions.policyId, id));
    
    // Delete policy
    await db.delete(policies).where(eq(policies.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Policies DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
