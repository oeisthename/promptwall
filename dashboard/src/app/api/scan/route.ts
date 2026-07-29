import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policies, auditLogs } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { dispatchToSIEM } from '@/lib/siem-dispatcher';
import { checkRateLimit } from '@/lib/redis';
import { apiKeys } from '@/lib/db/schema';
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

    const apiKey = keyRecord[0];
    
    // Check Rate Limit
    const rateLimitResult = await checkRateLimit(apiKey.id, apiKey.rateLimit || 60);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        error: 'Too Many Requests', 
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset
      }, { status: 429 });
    }

    const body = await req.json();
    const { prompt, model, system_prompt, messages, agent } = body;
    const payloadStr = JSON.stringify(body).toLowerCase();
    
    // Estimate tokens (roughly 4 characters per token)
    const estimatedTokens = Math.ceil(payloadStr.length / 4);

    // Check Token Budget
    if (apiKey.budget !== null && apiKey.spend !== null) {
      if (apiKey.spend + estimatedTokens > apiKey.budget) {
        return NextResponse.json({ 
          error: 'Token Budget Exceeded',
          spend: apiKey.spend,
          budget: apiKey.budget
        }, { status: 429 });
      }
      
      // Update spend
      await db.update(apiKeys)
        .set({ spend: sql`${apiKeys.spend} + ${estimatedTokens}` })
        .where(eq(apiKeys.id, apiKey.id));
    }
    
    // Fetch active policies
    const activePolicies = await db.select().from(policies).where(eq(policies.enabled, true));
    
    // Simple evaluation engine mock
    // In a real scenario, this would parse the `match` string and evaluate it against the payload
    let action = 'allow';
    let reason = 'Passed all policies';
    let policyId: string | null = null;
    let severity: string | null = 'low';

    // Simple keyword match for demonstration
    for (const policy of activePolicies) {
      if (policy.action === 'block' && policy.match && payloadStr.includes('passwd')) {
        action = 'block';
        reason = `Matched block policy: ${policy.name}`;
        policyId = policy.id;
        severity = policy.severity;
        break;
      }
      if (policy.action === 'redact' && payloadStr.includes('phone')) {
        action = 'redact';
        reason = `Matched redact policy: ${policy.name}`;
        policyId = policy.id;
        severity = policy.severity;
        // Don't break, keep evaluating but we have a redact action
      }
    }

    // Calculate parent hash for audit log chain
    const lastLog = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(1);
    const parentHash = lastLog.length > 0 ? lastLog[0].hash : null;
    
    const logData = JSON.stringify({ action, reason, payload: body, parentHash, timestamp: Date.now() });
    const hash = crypto.createHash('sha256').update(logData).digest('hex');

    await db.insert(auditLogs).values({
      decision: action,
      matchedRule: policyId ? policyId.toString() : 'None',
      prompt: prompt || JSON.stringify(body),
      sanitized: prompt || JSON.stringify(body),
      score: 0.0,
      latency: 42,
      hash,
      parentHash,
      severity,
      plane: 'input'
    });

    // Dispatch to external SIEMs asynchronously without blocking the response
    dispatchToSIEM({
      action,
      reason,
      hash,
      severity,
      prompt: prompt || JSON.stringify(body),
      timestamp: Date.now()
    });

    return NextResponse.json({ action, reason, hash });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
