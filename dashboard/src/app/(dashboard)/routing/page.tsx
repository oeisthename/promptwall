"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Plus, Trash2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface FallbackRule {
  id: string;
  provider: string;
  onConditions: string[];
  apiKey?: string;
}

interface RoutingRules {
  primary: string;
  primaryApiKey?: string;
  fallbacks: FallbackRule[];
}

const PROVIDERS = ["openai", "anthropic", "google", "cohere", "local-llama"];
const CONDITIONS = ["429", "503", "500", "timeout", "all"];

export default function RoutingPage() {
  const [rules, setRules] = useState<RoutingRules>({ primary: "openai", primaryApiKey: "", fallbacks: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: session } = authClient.useSession();
  const { data: activeOrgData } = authClient.useActiveOrganization();
  const currentUserMember = activeOrgData?.members?.find((m: any) => m.userId === session?.user?.id);
  const currentRole = currentUserMember?.role || "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner" || !activeOrgData;

  useEffect(() => {
    fetchRules();
  }, [activeOrgData?.id]);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/routing");
      if (res.ok) {
        const data = await res.json();
        setRules(data || { primary: "openai", primaryApiKey: "", fallbacks: [] });
      }
    } catch (e) {
      toast.error("Failed to load routing rules");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routingRules: rules }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Routing configurations saved!");
    } catch (e) {
      toast.error("Failed to save routing configurations");
    } finally {
      setIsSaving(false);
    }
  };

  const addFallback = () => {
    const newFallback = {
      id: Math.random().toString(36).substr(2, 9),
      provider: "anthropic",
      onConditions: ["all"],
      apiKey: ""
    };
    setRules(prev => ({ ...prev, fallbacks: [...prev.fallbacks, newFallback] }));
  };

  const removeFallback = (id: string) => {
    setRules(prev => ({ ...prev, fallbacks: prev.fallbacks.filter(f => f.id !== id) }));
  };

  const updateFallback = (id: string, field: keyof FallbackRule, value: any) => {
    setRules(prev => ({
      ...prev,
      fallbacks: prev.fallbacks.map(f => f.id === id ? { ...f, [field]: value } : f)
    }));
  };

  if (!isAdmin && !isLoading) {
    return (
      <div className="flex-1 p-8 pt-6">
        <h2 className="text-2xl font-medium text-white mb-4">LLM Routing</h2>
        <Card className="glass-card border-white/5">
          <CardContent className="p-6 text-center text-muted-foreground">
            You do not have permission to view or edit routing rules. Must be an admin or owner.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 space-y-6 p-8 pt-6 w-full max-w-5xl mx-auto pb-20"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3">
            LLM Fallbacks & Load Balancing
          </h2>
          <p className="text-muted-foreground mt-2">Configure intelligent routing to ensure high availability for your AI applications.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-white text-black hover:bg-gray-200">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Configuration
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="glass-card border-white/5 bg-[#0a0a0a]/50">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg">Primary Provider</CardTitle>
              <CardDescription className="text-muted-foreground">
                All traffic will route to this provider by default.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 max-w-xl">
                <div className="flex items-start gap-4">
                  <div className="w-64">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Provider Name / URL</label>
                    <Input 
                      placeholder="e.g. openai or custom endpoint"
                      className="bg-black/60 border-white/10 text-white h-9"
                      value={rules.primary}
                      onChange={(e) => setRules(prev => ({ ...prev, primary: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {PROVIDERS.map(p => (
                        <button 
                          key={p} 
                          onClick={() => setRules(prev => ({ ...prev, primary: p }))} 
                          className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground px-2 py-1 rounded transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground flex-1 mt-7">
                    Your promptwall agent will forward all standard requests here. Supports custom base URLs.
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Provider API Key</label>
                  <Input 
                    type="password"
                    placeholder="Enter API Key (e.g. sk-...)" 
                    className="bg-black/60 border-white/10 text-white h-9"
                    value={rules.primaryApiKey || ""}
                    onChange={(e) => setRules(prev => ({ ...prev, primaryApiKey: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Keys are encrypted at rest using AES-256 and never exposed in plaintext.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 bg-[#0a0a0a]/50">
            <CardHeader className="border-b border-white/5 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg">Fallback Chain</CardTitle>
                <CardDescription className="text-muted-foreground">
                  If the primary provider fails, PromptWall will attempt these providers in order.
                </CardDescription>
              </div>
              <Button onClick={addFallback} variant="outline" className="border-white/10 text-white hover:bg-white/10">
                <Plus className="mr-2 h-4 w-4" /> Add Fallback
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {rules.fallbacks.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-md text-muted-foreground">
                  No fallbacks configured. If {rules.primary} fails, your app will receive an error.
                </div>
              ) : (
                rules.fallbacks.map((fb, index) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={fb.id} 
                    className="flex items-center gap-4 p-4 border border-white/5 bg-black/40 rounded-lg relative group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-muted-foreground font-mono text-sm border border-white/10">
                      {index + 1}
                    </div>
                    
                    <div className="w-48">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Route To</label>
                      <Input 
                        placeholder="Provider or URL"
                        className="bg-black/60 border-white/10 text-white h-9"
                        value={fb.provider}
                        onChange={(e) => updateFallback(fb.id, "provider", e.target.value)}
                      />
                    </div>

                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">On Condition</label>
                      <Select 
                        value={fb.onConditions[0] || "all"} 
                        onValueChange={(v) => updateFallback(fb.id, "onConditions", [v])}
                      >
                        <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
                          <SelectValue placeholder="Condition" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10 text-white">
                          <SelectItem value="all">Any Failure</SelectItem>
                          <SelectItem value="429">Rate Limited (429)</SelectItem>
                          <SelectItem value="503">Service Unavailable (503)</SelectItem>
                          <SelectItem value="500">Internal Error (500)</SelectItem>
                          <SelectItem value="timeout">Timeout</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">API Key</label>
                      <Input 
                        type="password"
                        placeholder="Enter API Key" 
                        className="bg-black/60 border-white/10 text-white h-9 w-full"
                        value={fb.apiKey || ""}
                        onChange={(e) => updateFallback(fb.id, "apiKey", e.target.value)}
                      />
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFallback(fb.id)} 
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 w-9 mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
