import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policies, apiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as yaml from 'js-yaml';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const envFilter = url.searchParams.get("environment") || "production";
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const keyRecord = await db.select().from(apiKeys).where(eq(apiKeys.key, apiKey)).limit(1);
    
    if (keyRecord.length === 0) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = keyRecord[0].organizationId || "personal";

    // Fetch all enabled policies for this org and environment
    const activePolicies = await db.select()
      .from(policies)
      .where(and(
        eq(policies.organizationId, orgId), 
        eq(policies.environment, envFilter),
        eq(policies.enabled, true)
      ))
      .orderBy(policies.priority);

    const mergedPolicy: any = {
      agent: "promptwall-sdk",
      definitions: {
        allowlist: [],
        patterns: {}
      },
      input_firewall: {
        mode: "block",
        sensitivity: "medium"
      },
      rules: []
    };

    let patternCounter = 1;

    for (const policy of activePolicies) {
      let parsed;
      try {
        parsed = yaml.load(policy.content || "") as any;
      } catch (e) {
        console.warn(`Failed to parse policy ${policy.id}`);
        continue;
      }

      if (!parsed || !parsed.policies) continue;

      for (const rule of parsed.policies) {
        const pythonRule: any = {
          name: rule.name || `Rule_${patternCounter}`,
          plane: "output", // default for now
          action: rule.action || "block",
          severity: "high" // default severity
        };

        if (rule.type === "regex" && rule.match) {
          const patternName = `pattern_${patternCounter++}`;
          mergedPolicy.definitions.patterns[patternName] = rule.match;
          pythonRule.match = `output contains pattern:${patternName}`;
          mergedPolicy.rules.push(pythonRule);
        } else if (rule.type === "dlp" && rule.match) {
          pythonRule.match = `output contains dlp:${rule.match}`;
          mergedPolicy.rules.push(pythonRule);
        } else if (rule.type === "keyword" && rule.keywords && rule.keywords.length > 0) {
          const patternName = `pattern_${patternCounter++}`;
          // Build a simple regex for keywords
          const escapedKeywords = rule.keywords.map((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          mergedPolicy.definitions.patterns[patternName] = `(?i)(${escapedKeywords.join('|')})`;
          pythonRule.match = `output contains pattern:${patternName}`;
          mergedPolicy.rules.push(pythonRule);
        }
      }
    }

    return NextResponse.json(mergedPolicy);
  } catch (error) {
    console.error('Policies Active GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
