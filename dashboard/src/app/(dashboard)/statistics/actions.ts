"use server";

import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, desc, gte } from 'drizzle-orm';

export async function getStatisticsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  
  const orgId = session.session.activeOrganizationId;
  const userId = session.user.id;

  const conditions = [];
  if (orgId) {
    conditions.push(eq(auditLogs.organizationId, orgId));
  } else {
    conditions.push(eq(auditLogs.userId, userId));
    conditions.push(eq(auditLogs.organizationId, 'personal'));
  }

  // Fetch last 24 hours of logs
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  conditions.push(gte(auditLogs.timestamp, oneDayAgo));

  const logs = await db.select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp));

  // Process timeline data (group by 4-hour intervals for simplicity)
  const timelineMap = new Map();
  ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].forEach(time => {
    timelineMap.set(time, { time, requests: 0, blocked: 0 });
  });

  // Process severity
  let high = 0, medium = 0, low = 0;
  
  // Process rules
  const ruleCounts = new Map();

  logs.forEach(log => {
    // Timeline
    const date = log.timestamp ? new Date(log.timestamp) : new Date();
    const hours = date.getHours();
    const bucket = `${Math.floor(hours / 4) * 4}`.padStart(2, '0') + ':00';
    
    if (!timelineMap.has(bucket)) {
      timelineMap.set(bucket, { time: bucket, requests: 0, blocked: 0 });
    }
    
    const tData = timelineMap.get(bucket);
    tData.requests += 1;
    if (log.decision === 'block' || log.decision === 'redact') {
      tData.blocked += 1;
      
      // Severity
      if (log.severity === 'high' || log.severity === 'critical') high++;
      else if (log.severity === 'medium') medium++;
      else low++;
      
      // Rule
      const ruleName = log.matchedRule || 'Unknown Rule';
      ruleCounts.set(ruleName, (ruleCounts.get(ruleName) || 0) + 1);
    }
  });

  const severityData = [
    { name: 'High', value: high, color: '#ef4444' },
    { name: 'Medium', value: medium, color: '#f97316' },
    { name: 'Low', value: low, color: '#eab308' },
  ];

  const topRules = Array.from(ruleCounts.entries())
    .map(([rule, hits]) => ({ rule, hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);

  const data = Array.from(timelineMap.values()).sort((a, b) => a.time.localeCompare(b.time));

  return {
    data,
    severityData,
    topRules
  };
}
