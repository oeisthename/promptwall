import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organization, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { encrypt } from "@/lib/encryption";

const MASKED_KEY = "********************";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    let routingRules: any = null;
    
    if (orgId) {
      const org = await db.select({ routingRules: organization.routingRules }).from(organization).where(eq(organization.id, orgId)).limit(1);
      if (org.length > 0) routingRules = org[0].routingRules;
    } else {
      const u = await db.select({ routingRules: user.routingRules }).from(user).where(eq(user.id, userId)).limit(1);
      if (u.length > 0) routingRules = u[0].routingRules;
    }
    
    // Default structure if null
    if (!routingRules) {
      routingRules = {
        primary: "openai",
        primaryApiKey: "",
        fallbacks: []
      };
    } else {
      // Mask keys for the frontend
      if (routingRules.primaryApiKey) {
        routingRules.primaryApiKey = MASKED_KEY;
      }
      if (routingRules.fallbacks) {
        routingRules.fallbacks = routingRules.fallbacks.map((f: any) => ({
          ...f,
          apiKey: f.apiKey ? MASKED_KEY : ""
        }));
      }
    }
    
    return NextResponse.json(routingRules);
  } catch (error) {
    console.error('Routing GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;
    
    // Check permissions if org
    if (orgId) {
       const orgData = await auth.api.getFullOrganization({
         headers: await headers(),
         query: { organizationId: orgId }
       });
       if (!orgData) return new NextResponse("Organization not found", { status: 404 });
       const member = orgData.members.find(m => m.userId === userId);
       if (!member || (member.role !== "owner" && member.role !== "admin")) {
         return new NextResponse("Forbidden - Must be admin or owner", { status: 403 });
       }
    }

    const body = await req.json();
    const { routingRules: incomingRules } = body;
    
    if (!incomingRules) {
      return new NextResponse("Missing routingRules", { status: 400 });
    }

    // Fetch existing rules to merge masked keys
    let existingRules: any = null;
    if (orgId) {
      const org = await db.select({ routingRules: organization.routingRules }).from(organization).where(eq(organization.id, orgId)).limit(1);
      if (org.length > 0) existingRules = org[0].routingRules;
    } else {
      const u = await db.select({ routingRules: user.routingRules }).from(user).where(eq(user.id, userId)).limit(1);
      if (u.length > 0) existingRules = u[0].routingRules;
    }
    
    const finalRules = { ...incomingRules };

    // Handle primary API key
    if (incomingRules.primaryApiKey === MASKED_KEY) {
      finalRules.primaryApiKey = existingRules?.primaryApiKey || "";
    } else if (incomingRules.primaryApiKey) {
      finalRules.primaryApiKey = encrypt(incomingRules.primaryApiKey);
    }

    // Handle fallback API keys
    if (finalRules.fallbacks) {
      finalRules.fallbacks = finalRules.fallbacks.map((fb: any) => {
        if (fb.apiKey === MASKED_KEY) {
          const existingFallback = existingRules?.fallbacks?.find((e: any) => e.id === fb.id);
          fb.apiKey = existingFallback?.apiKey || "";
        } else if (fb.apiKey) {
          fb.apiKey = encrypt(fb.apiKey);
        }
        return fb;
      });
    }

    if (orgId) {
      await db.update(organization).set({ routingRules: finalRules }).where(eq(organization.id, orgId));
    } else {
      await db.update(user).set({ routingRules: finalRules }).where(eq(user.id, userId));
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Routing POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
