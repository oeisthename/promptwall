import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policyDeletionRequests, policies, policyVersions, user } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // Admins fetch pending requests
    const session = await auth.api.getSession({
        headers: req.headers
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allRequests = await db
      .select({
        id: policyDeletionRequests.id,
        policyId: policyDeletionRequests.policyId,
        requestedBy: policyDeletionRequests.requestedBy,
        status: policyDeletionRequests.status,
        createdAt: policyDeletionRequests.createdAt,
        policyName: policies.name,
        requesterName: user.name,
        requesterEmail: user.email,
      })
      .from(policyDeletionRequests)
      .leftJoin(policies, eq(policyDeletionRequests.policyId, policies.id))
      .leftJoin(user, eq(policyDeletionRequests.requestedBy, user.id))
      .where(eq(policyDeletionRequests.status, 'pending'))
      .orderBy(desc(policyDeletionRequests.createdAt));

    return NextResponse.json(allRequests);
  } catch (error) {
    console.error('Requests GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({
        headers: req.headers
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { policyId } = await req.json();

    if (!policyId) {
      return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
    }

    // Check if request already exists
    const existing = await db
      .select()
      .from(policyDeletionRequests)
      .where(eq(policyDeletionRequests.policyId, policyId))
      .limit(1);

    if (existing.length > 0 && existing[0].status === 'pending') {
      return NextResponse.json({ error: 'Deletion request already pending for this policy' }, { status: 400 });
    }

    const inserted = await db.insert(policyDeletionRequests).values({
      policyId,
      requestedBy: session.user.id,
      status: 'pending'
    }).returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    console.error('Requests POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth.api.getSession({
        headers: req.headers
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, status } = await req.json(); // status can be 'approved' or 'denied'

    if (!requestId || !status || !['approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Update the request status
    const updated = await db.update(policyDeletionRequests)
      .set({ status })
      .where(eq(policyDeletionRequests.id, requestId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // If approved, delete the policy
    if (status === 'approved') {
      const policyId = updated[0].policyId;
      
      // Delete policy versions first (foreign key cascade might not be set up)
      await db.delete(policyVersions).where(eq(policyVersions.policyId, policyId));
      
      // Delete policy
      await db.delete(policies).where(eq(policies.id, policyId));
    }

    return NextResponse.json(updated[0], { status: 200 });
  } catch (error) {
    console.error('Requests PATCH error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
