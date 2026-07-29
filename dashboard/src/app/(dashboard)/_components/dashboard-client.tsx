"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { authClient } from "@/lib/auth-client";
import { OnboardingWizard } from "./onboarding-wizard";
import { useState, useEffect } from "react";

export function DashboardClient({
  totalScans,
  blockedScans,
  activePolicies,
  totalPolicies,
  recentLogs,
  cachedScans,
  tokensSaved,
  needsOnboarding,
}: {
  totalScans: number;
  blockedScans: number;
  activePolicies: number;
  totalPolicies: number;
  recentLogs: any[];
  cachedScans: number;
  tokensSaved: number;
  needsOnboarding?: boolean;
}) {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  const activeMember = activeOrg?.members?.find((m) => m.userId === session?.user?.id);
  const role = activeMember?.role || "owner";
  const isAdmin = role === "admin" || role === "owner";
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      const orgId = activeOrg?.id || 'personal';
      const key = `onboarding_seen_${orgId}_${session.user.id}`;
      const hasSeen = localStorage.getItem(key);
      
      if (!hasSeen) {
         const createdAt = session.user.createdAt ? new Date(session.user.createdAt).getTime() : 0;
         const now = Date.now();
         const isOldUser = (now - createdAt) > 1000 * 60 * 60; // older than 1 hour
         
         if (isOldUser && !needsOnboarding) {
            // Silently mark as seen for old users in existing workspaces
            localStorage.setItem(key, 'true');
         } else {
            setShowOnboarding(true);
         }
      }
    }
  }, [activeOrg, session, needsOnboarding]);

  const handleOnboardingComplete = () => {
    if (session?.user?.id) {
      const orgId = activeOrg?.id || 'personal';
      localStorage.setItem(`onboarding_seen_${orgId}_${session.user.id}`, 'true');
    }
    setShowOnboarding(false);
  };

  // Fake chart data for the mini chart
  const miniChartData = [
    { name: "A", requests: Math.max(0, totalScans - 500) },
    { name: "B", requests: Math.max(0, totalScans - 300) },
    { name: "C", requests: Math.max(0, totalScans - 100) },
    { name: "D", requests: totalScans },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <OnboardingWizard 
        isOpen={showOnboarding} 
        onComplete={handleOnboardingComplete} 
        isAdmin={isAdmin}
        needsSetup={needsOnboarding}
      />
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{isAdmin ? "Dashboard" : "Member Dashboard"}</h1>
        <p className="text-muted-foreground mt-2">
          {isAdmin ? "Monitor your LLM security policies and recent activity." : `Welcome back to ${activeOrg?.name || "PromptWall"}. You have member access.`}
        </p>
      </div>

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            <Activity className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalScans}</div>
            <div className="h-10 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={miniChartData}>
                  <Area type="monotone" dataKey="requests" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip contentStyle={{ display: 'none' }} cursor={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blocked Requests</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{blockedScans}</div>
            <p className="text-xs text-red-400 mt-2 font-medium">
              {totalScans > 0 ? Math.round((blockedScans / totalScans) * 100) : 0}% of total traffic blocked
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Policies</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{activePolicies}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Out of {totalPolicies} total policies configured
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalScans > 0 ? Math.round((cachedScans / totalScans) * 100) : 0}%</div>
            <p className="text-xs text-yellow-400 mt-2 font-medium">
              {cachedScans} prompts served from cache
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Cost Saved</CardTitle>
            <Activity className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">${(tokensSaved * 0.000015).toFixed(2)}</div>
            <p className="text-xs text-purple-400 mt-2 font-medium">
              Based on {tokensSaved} tokens saved
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="glass-card border-white/5 col-span-4">
          <CardHeader>
            <CardTitle className="text-white">Live Activity Stream</CardTitle>
            <CardDescription className="text-muted-foreground">
              Latest intercepted requests and policy evaluations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No recent activity found.</div>
              ) : (
                recentLogs.map((log, index) => (
                  <motion.div 
                    key={log.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center p-3 rounded-lg bg-black/40 border border-white/5"
                  >
                    <span className="relative flex h-3 w-3 mr-4">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${log.decision === 'block' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${log.decision === 'block' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    </span>
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-white leading-none">
                        Policy: <span className="text-cyan-400">{log.matchedRule || 'Unknown'}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.decision === 'block' ? 'Threat Intercepted' : 'Request Allowed'} • {log.severity || 'low'} severity
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono bg-white/5 px-2 py-1 rounded">
                      {new Date(log.timestamp!).toLocaleTimeString()}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-white/5 col-span-3">
          <CardHeader>
            <CardTitle className="text-white">Infrastructure Health</CardTitle>
            <CardDescription className="text-muted-foreground">
              Current state of the PromptWall edge nodes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium text-white">Policy Engine</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white">Postgres DB</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-orange-400" />
                  </div>
                  <span className="text-sm font-medium text-white">Audit Logger</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/20">
                  Operational
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
