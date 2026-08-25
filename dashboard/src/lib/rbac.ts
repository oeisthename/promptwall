import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export type Role = "owner" | "admin" | "developer" | "member"; // "member" acts as Auditor

export async function getUserRole(userId: string, orgId: string): Promise<Role | null> {
  const userMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, orgId)
    )
  });
  
  if (!userMember) return null;
  return userMember.role as Role;
}

/**
 * Checks if the current session has one of the allowed roles.
 * Returns { isAuthorized: true, session, orgId } if valid.
 * Returns { isAuthorized: false, response } if invalid (which should be returned by the route).
 */
export async function requireRole(allowedRoles: Role[]): Promise<
  | { isAuthorized: false; response: NextResponse }
  | { isAuthorized: true; session: any; orgId: string; role: Role | "owner" }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { isAuthorized: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const orgId = session.session.activeOrganizationId as string;
  if (!orgId) {
    // If no active organization, they are in their personal workspace
    // Personal workspace means they are essentially the owner of it
    return { isAuthorized: true, session, orgId: "", role: "owner" };
  }

  const role = await getUserRole(session.user.id, orgId);
  
  // 'owner' can do anything an 'admin' can do
  const effectiveRole = role === 'owner' ? 'admin' : role;
  
  if (!effectiveRole || !allowedRoles.includes(effectiveRole as Role)) {
    return { isAuthorized: false, response: new NextResponse("Forbidden: Insufficient permissions", { status: 403 }) };
  }

  return { isAuthorized: true, session, orgId, role: role as Role };
}
