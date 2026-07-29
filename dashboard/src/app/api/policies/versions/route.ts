import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policyVersions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const policyId = searchParams.get('policyId');
    
    if (!policyId) {
      return NextResponse.json({ error: 'policyId is required' }, { status: 400 });
    }

    const versions = await db.select()
                             .from(policyVersions)
                             .where(eq(policyVersions.policyId, policyId))
                             .orderBy(desc(policyVersions.createdAt));
                             
    return NextResponse.json(versions);
  } catch (error) {
    console.error('Versions GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
