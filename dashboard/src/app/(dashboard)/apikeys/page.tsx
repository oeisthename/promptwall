"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, KeyRound, Plus, Trash2, Copy, Check, Eye, EyeOff, Edit2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  environment: string;
  createdAt: string;
  lastUsedAt: string | null;
  budget: number | null;
  spend: number;
  rateLimit: number;
}

export default function ApiKeysPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState("production");
  const [newKeyBudget, setNewKeyBudget] = useState("");
  const [newKeyRateLimit, setNewKeyRateLimit] = useState("60");
  const [isCreating, setIsCreating] = useState(false);

  // New key display state
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editBudget, setEditBudget] = useState("");
  const [editRateLimit, setEditRateLimit] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Visibility toggle
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/apikeys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (e) {
      toast.error("Failed to fetch API keys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchKeys();
    }
  }, [session]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      return toast.error("Please enter a key name");
    }
    
    setIsCreating(true);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newKeyName, 
          environment: newKeyEnv, 
          budget: newKeyBudget || null,
          rateLimit: newKeyRateLimit || 60
        })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create key");
      }
      
      const newKey = await res.json();
      setNewlyCreatedKey(newKey.key);
      setKeys([...keys, newKey]);
      setNewKeyName("");
      setNewKeyEnv("production");
      setNewKeyBudget("");
      setNewKeyRateLimit("60");
      toast.success("API Key created successfully");
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/apikeys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setKeys(keys.filter((k) => k.id !== id));
      toast.success("API Key deleted");
    } catch (e) {
      toast.error("Failed to delete API Key");
    }
  };

  const handleOpenEdit = (key: ApiKey) => {
    setEditingKey(key);
    setEditBudget(key.budget?.toString() || "");
    setEditRateLimit(key.rateLimit?.toString() || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/apikeys/${editingKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: editBudget || null,
          rateLimit: editRateLimit || null
        })
      });
      if (!res.ok) throw new Error("Failed to update");
      const updatedKey = await res.json();
      setKeys(keys.map(k => k.id === updatedKey.id ? { ...k, budget: updatedKey.budget, rateLimit: updatedKey.rateLimit } : k));
      toast.success("API Key updated");
      setIsEditDialogOpen(false);
    } catch (e) {
      toast.error("Failed to update API Key");
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeys({ ...copiedKeys, [id]: true });
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedKeys({ ...copiedKeys, [id]: false });
    }, 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys({ ...visibleKeys, [id]: !visibleKeys[id] });
  };

  if (sessionPending) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3">
            <KeyRound className="h-7 w-7 text-white/70" />
            API Keys
          </h2>
          <p className="text-muted-foreground mt-2">Manage tokens for your CLI and API access.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-white text-black hover:bg-gray-200">
          <Plus className="mr-2 h-4 w-4" />
          Create New Key
        </Button>
      </div>

      <Card className="glass-card border-white/5">
        <CardHeader>
          <CardTitle className="text-white">Active Keys</CardTitle>
          <CardDescription className="text-muted-foreground">
            Keys are scoped to the current active organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex h-[100px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-white/5 rounded-lg bg-black/20">
              <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>No API keys found.</p>
              <p className="text-xs mt-1">Create one to start authenticating your CLI.</p>
            </div>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 border border-white/5 rounded-lg bg-black/20">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{k.name}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${k.environment === 'production' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {k.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-muted-foreground border border-white/10 w-[280px] truncate">
                      {visibleKeys[k.id] ? k.key : "pw_" + "*".repeat(32)}
                    </code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleVisibility(k.id)}>
                      {visibleKeys[k.id] ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(k.key, k.id)}>
                      {copiedKeys[k.id] ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                  </div>
                  {k.budget !== null && (
                    <div className="mt-4 w-full max-w-[280px]">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                        <span>Tokens Used</span>
                        <span>{k.spend.toLocaleString()} / {k.budget.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            (k.spend / k.budget) > 0.9 ? 'bg-red-500' : (k.spend / k.budget) > 0.75 ? 'bg-orange-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, (k.spend / k.budget) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                  <span className="hidden md:inline-block">Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/5">
                    {k.rateLimit} req/min
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(k)} className="text-white hover:bg-white/10 h-7 px-2">
                      <Edit2 className="h-3 w-3 mr-1" /> Edit Limits
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(k.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2">
                      <Trash2 className="h-3 w-3 mr-1" /> Revoke
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setNewlyCreatedKey(null);
      }}>
        <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-white/10 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>{newlyCreatedKey ? "API Key Created" : "Create New API Key"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {newlyCreatedKey ? "Copy this key now. You won't be able to see it again." : "Generate a new token to connect your CLI."}
            </DialogDescription>
          </DialogHeader>
          
          {newlyCreatedKey ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-black/60 rounded-lg border border-white/10 break-all font-mono text-green-400 text-sm flex justify-between items-center">
                {newlyCreatedKey}
              </div>
              <Button onClick={() => copyToClipboard(newlyCreatedKey, 'new')} className="w-full bg-white text-black hover:bg-gray-200">
                {copiedKeys['new'] ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiedKeys['new'] ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Key Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. CLI Dev Token"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment" className="text-white">Environment</Label>
                <Select value={newKeyEnv} onValueChange={(val) => val && setNewKeyEnv(val)}>
                  <SelectTrigger id="environment" className="w-full bg-black/40 border-white/10 text-white h-10">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/10 text-white">
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget" className="text-white">Monthly Token Budget <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="e.g. 5000000"
                  value={newKeyBudget}
                  onChange={(e) => setNewKeyBudget(e.target.value)}
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rateLimit" className="text-white">Requests per Minute Limit</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  placeholder="e.g. 60"
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(e.target.value)}
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-end">
            {!newlyCreatedKey && (
              <>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 text-white">Cancel</Button>
                <Button onClick={handleCreateKey} disabled={isCreating} className="bg-white text-black hover:bg-gray-200">
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Key
                </Button>
              </>
            )}
            {newlyCreatedKey && (
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 text-white">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-white/10 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>Edit API Key Limits</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the rate limit and budget for {editingKey?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editBudget" className="text-white">Monthly Token Budget <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
              <Input
                id="editBudget"
                type="number"
                placeholder="e.g. 5000000"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRateLimit" className="text-white">Requests per Minute Limit</Label>
              <Input
                id="editRateLimit"
                type="number"
                placeholder="e.g. 60"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(e.target.value)}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-white/10 text-white">Cancel</Button>
            <Button onClick={handleUpdateKey} disabled={isUpdating} className="bg-white text-black hover:bg-gray-200">
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
