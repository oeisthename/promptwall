import { db } from "@/lib/db";
import { policies, auditLogs, apiKeys } from "@/lib/db/schema";
import { count, eq, desc, sum } from "drizzle-orm";
import { DashboardClient } from "./_components/dashboard-client";

export default async function DashboardPage() {
  const [totalPoliciesResult] = await db.select({ value: count() }).from(policies);
  const totalPolicies = totalPoliciesResult.value;

  const [activePoliciesResult] = await db.select({ value: count() }).from(policies).where(eq(policies.enabled, true));
  const activePolicies = activePoliciesResult.value;

  const [totalLogsResult] = await db.select({ value: count() }).from(auditLogs);
  const totalScans = totalLogsResult.value;

  const [blockedScansResult] = await db.select({ value: count() }).from(auditLogs).where(eq(auditLogs.decision, 'block'));
  const blockedScans = blockedScansResult.value;

  const recentLogs = await db.select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(5);

  const [cachedScansResult] = await db.select({ value: count() }).from(auditLogs).where(eq(auditLogs.cached, true));
  const cachedScans = cachedScansResult.value;

  const [tokensSavedResult] = await db.select({ value: sum(auditLogs.tokensSaved) }).from(auditLogs).where(eq(auditLogs.cached, true));
  const tokensSaved = Number(tokensSavedResult?.value || 0);

  const [totalKeysResult] = await db.select({ value: count() }).from(apiKeys);
  const totalKeys = totalKeysResult.value;

  const needsOnboarding = totalPolicies === 0 && totalKeys === 0;

  return (
    <div className="flex-1 p-8 pt-6 pb-20">
      <DashboardClient 
        totalScans={totalScans}
        blockedScans={blockedScans}
        activePolicies={activePolicies}
        totalPolicies={totalPolicies}
        recentLogs={recentLogs}
        cachedScans={cachedScans}
        tokensSaved={tokensSaved}
        needsOnboarding={needsOnboarding}
      />
    </div>
  );
}
