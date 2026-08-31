import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { desc, eq, and, ilike } from 'drizzle-orm';
import { apiKeys } from '@/lib/db/schema';
import crypto from 'crypto';
import { dispatchToSIEM } from '@/lib/siem-dispatcher';

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    
    const orgId = session.session.activeOrganizationId;
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const decision = searchParams.get('decision');
    const severity = searchParams.get('severity');
    const search = searchParams.get('search');
    const environment = searchParams.get('environment');
    
    // Build where conditions
    const conditions = [];
    
    // Scope conditions
    if (orgId) {
      conditions.push(eq(auditLogs.organizationId, orgId));
    } else {
      conditions.push(eq(auditLogs.userId, userId));
      conditions.push(eq(auditLogs.organizationId, 'personal'));
    }

    // Filter conditions
    if (environment && environment !== 'all') conditions.push(eq(auditLogs.environment, environment));
    if (decision && decision !== 'all') conditions.push(eq(auditLogs.decision, decision));
    if (severity && severity !== 'all') conditions.push(eq(auditLogs.severity, severity));
    if (search) conditions.push(ilike(auditLogs.prompt, `%${search}%`));

    const logs = await db.select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
      
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Audit Logs GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let token = req.headers.get('x-api-key');
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Missing API Key in headers' }, { status: 401 });
    }
    const keyRecord = await db.select().from(apiKeys).where(eq(apiKeys.key, token)).limit(1);
    
    if (keyRecord.length === 0) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
    }
    const orgId = keyRecord[0].organizationId;
    const environment = 'production'; // could also pull from api key or payload

    const body = await req.json();
    
    // Calculate parent hash for audit log chain
    const lastLog = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(1);
    const parentHash = lastLog.length > 0 ? lastLog[0].hash : null;
    
    const logData = JSON.stringify({ action: body.action, reason: body.reason, payload: body.fullRequest, parentHash, timestamp: Date.now() });
    const hash = crypto.createHash('sha256').update(logData).digest('hex');

    await db.insert(auditLogs).values({
      organizationId: orgId,
      environment: environment,
      decision: body.action || "allow",
      matchedRule: body.ruleName || "none",
      severity: body.severity || "low",
      prompt: typeof body.fullRequest === 'string' ? body.fullRequest : JSON.stringify(body.fullRequest),
      sanitized: body.promptPreview || "",
      score: 0.0,
      latency: Math.round(body.latencyMs || 0),
      hash: hash,
      parentHash: parentHash,
      plane: 'output'
    });

    dispatchToSIEM({
      action: body.action || "allow",
      reason: body.ruleName || "none",
      hash: hash,
      severity: body.severity || "low",
      prompt: JSON.stringify(body.fullRequest),
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true, hash });
  } catch (error) {
    console.error('Audit Logs POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

