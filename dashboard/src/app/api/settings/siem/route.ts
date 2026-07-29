import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { siemIntegrations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const integrations = await db.select().from(siemIntegrations);
    return NextResponse.json(integrations);
  } catch (error) {
    console.error('SIEM GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, endpoint, apiKey, enabled } = body;

    // Check if integration for provider exists
    const existing = await db.select().from(siemIntegrations).where(eq(siemIntegrations.provider, provider)).limit(1);

    let saved;
    if (existing.length > 0) {
      const updated = await db.update(siemIntegrations).set({
        endpoint,
        apiKey,
        enabled
      }).where(eq(siemIntegrations.id, existing[0].id)).returning();
      saved = updated[0];
    } else {
      const inserted = await db.insert(siemIntegrations).values({
        id: uuidv4(),
        provider,
        endpoint,
        apiKey,
        enabled
      }).returning();
      saved = inserted[0];
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('SIEM POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
