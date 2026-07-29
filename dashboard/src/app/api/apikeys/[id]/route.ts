import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;
    if (!orgId) {
      return new NextResponse("Organization required", { status: 400 });
    }

    const { id } = await params;

    if (!id) {
      return new NextResponse("Key ID is required", { status: 400 });
    }

    // Ensure the key belongs to the current organization before deleting
    const [deleted] = await db.delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, orgId)))
      .returning();

    if (!deleted) {
      return new NextResponse("Key not found or unauthorized", { status: 404 });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[API_KEYS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;
    if (!orgId) {
      return new NextResponse("Organization required", { status: 400 });
    }

    const { id } = await params;

    if (!id) {
      return new NextResponse("Key ID is required", { status: 400 });
    }

    const body = await req.json();
    const { rateLimit, budget } = body;

    const [updated] = await db.update(apiKeys)
      .set({
        rateLimit: rateLimit ? parseInt(rateLimit) : null,
        budget: budget ? parseInt(budget) : null
      })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, orgId)))
      .returning();

    if (!updated) {
      return new NextResponse("Key not found or unauthorized", { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[API_KEYS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
