"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, Zap, ServerCrash, Loader2, Play } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface SimulationResult {
  decision: "allow" | "block" | "redact";
  matchedRule: string | null;
  originalPrompt: string;
  sanitizedPrompt: string;
  latency: number;
}

export default function PlaygroundPage() {
  const { data: session } = authClient.useSession();
  const { data: activeOrgData } = authClient.useActiveOrganization();
  
  const currentUserMember = activeOrgData?.members?.find((m: any) => m.userId === session?.user?.id);
  const currentRole = (currentUserMember?.role as string) || "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner" || (!session?.session?.activeOrganizationId);
  const canTest = isAdmin || currentRole === "developer";
  
  const [prompt, setPrompt] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    if (!prompt.trim()) {
      return toast.error("Please enter a prompt to simulate.");
    }
    
    setIsSimulating(true);
    setResult(null);

    try {
      const res = await fetch("/api/playground/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, environment })
      });
      
      if (!res.ok) throw new Error("Simulation failed");
      
      const data = await res.json();
      setResult(data);
    } catch (e) {
      toast.error("Failed to run simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-8rem)] space-y-6 p-8 pt-6 w-full max-w-7xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3">
            <Zap className="h-7 w-7 text-yellow-400" />
            Policy Simulator
          </h2>
          <p className="text-muted-foreground mt-2">Test your prompts against your active policies before deploying to production.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={environment} onValueChange={(v) => v && setEnvironment(v)}>
            <SelectTrigger className="w-[180px] bg-black/40 border-white/10 text-white">
              <SelectValue placeholder="Select Environment" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border-white/10 text-white">
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
            </SelectContent>
          </Select>
          {canTest ? (
            <Button onClick={handleSimulate} disabled={isSimulating} className="bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Simulation
            </Button>
          ) : (
            <Button disabled className="bg-white/10 text-white/50 cursor-not-allowed">
              Read Only
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[500px]">
        {/* Left Side: Input */}
        <Card className="glass-card border-white/5 flex flex-col h-full bg-[#0a0a0a]/50">
          <CardHeader className="pb-3 border-b border-white/5 bg-black/20">
            <CardTitle className="text-white text-lg">Input Prompt</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <Textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste the prompt your user or application would send to the LLM..."
              className="w-full h-full min-h-[400px] bg-transparent border-0 resize-none focus-visible:ring-0 text-white p-6 leading-relaxed rounded-none"
              disabled={!canTest}
            />
          </CardContent>
        </Card>

        {/* Right Side: Output */}
        <Card className="glass-card border-white/5 flex flex-col h-full bg-[#0a0a0a]/50 relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/5 bg-black/20">
            <CardTitle className="text-white text-lg flex justify-between items-center">
              <span>Simulation Result</span>
              {result && (
                <span className="text-xs font-mono text-muted-foreground flex items-center bg-black/40 px-2 py-1 rounded border border-white/5">
                  Latency: {result.latency}ms
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 relative">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ShieldCheck className="h-16 w-16 mb-4 opacity-20" />
                <p>Run a simulation to see how your policies react.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 h-full flex flex-col"
              >
                {/* Decision Badge */}
                <div className="flex items-center gap-4">
                  {result.decision === "block" ? (
                    <div className="flex items-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                      <ShieldAlert className="h-5 w-5" /> Blocked
                    </div>
                  ) : result.decision === "redact" ? (
                    <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                      <ShieldAlert className="h-5 w-5" /> Redacted
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                      <ShieldCheck className="h-5 w-5" /> Allowed
                    </div>
                  )}

                  {result.matchedRule && (
                    <div className="flex items-center text-sm text-white/70 bg-white/5 px-3 py-1 rounded-md border border-white/10">
                      <span className="text-muted-foreground mr-2">Matched Policy:</span>
                      <span className="font-mono text-purple-400">{result.matchedRule}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 border border-white/5 rounded-lg bg-black/40 overflow-hidden flex flex-col">
                  <div className="bg-black/60 px-4 py-2 border-b border-white/5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Final Payload to LLM
                  </div>
                  <div className="p-4 text-white font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-auto flex-1">
                    {result.decision === "block" ? (
                      <div className="flex flex-col items-center justify-center h-full text-red-400/50">
                        <ServerCrash className="h-12 w-12 mb-2" />
                        <p>Request blocked before reaching LLM.</p>
                      </div>
                    ) : (
                      result.sanitizedPrompt
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
