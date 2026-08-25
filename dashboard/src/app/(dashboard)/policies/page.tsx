"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Play, ShieldAlert, ShieldCheck, History, Trash2, Code2, Plus, Eye, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { authClient } from "@/lib/auth-client";
import { VisualBuilder } from "./visual-builder";
import { POLICY_TEMPLATES } from "@/lib/templates";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [activePolicyId, setActivePolicyId] = useState<string | "new">("new");
  const [yamlContent, setYamlContent] = useState<string>("# Loading policies...");
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("simulator");
  const [editorMode, setEditorMode] = useState<"visual" | "yaml">("visual");
  const [environmentFilter, setEnvironmentFilter] = useState("production");
  
  // Template States
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("all");
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Requests State
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);

  // Version Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState("");
  const [viewerVersionId, setViewerVersionId] = useState("");

  // Simulator State
  const [testPrompt, setTestPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ decision: string, reason: string, score: number } | null>(null);

  const { data: session } = authClient.useSession();
  const { data: activeOrgData } = authClient.useActiveOrganization();
  const currentUserMember = activeOrgData?.members?.find((m: any) => m.userId === session?.user?.id);
  const currentRole = (currentUserMember?.role as string) || "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner" || (!session?.session?.activeOrganizationId);
  const canEdit = isAdmin || currentRole === "developer";

  const fetchVersions = async (policyId: string) => {
    try {
      const res = await fetch(`/api/policies/versions?policyId=${policyId}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (e) {
      console.error("Failed to fetch versions", e);
    }
  };

  const fetchPolicies = async (selectId?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/policies?environment=${environmentFilter}`);
      if (!res.ok) throw new Error("Failed to fetch policies");
      const data = await res.json();
      setPolicies(data);
      
      if (data && data.length > 0) {
        const target = selectId ? data.find((p: any) => p.id === selectId) || data[0] : data[0];
        setYamlContent(target.content);
        setActivePolicyId(target.id);
        fetchVersions(target.id);
      } else {
        setYamlContent(`# Default PromptWall Policy\n\nversion: "1.0"\npolicies:\n  - name: "Block Prompt Injection"\n    type: "regex"\n    match: "(?i)(ignore all previous instructions|system prompt)"\n    action: "block"`);
        setActivePolicyId("new");
        setVersions([]);
      }
    } catch (error) {
      toast.error("Failed to load policies.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [environmentFilter]);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/policies/requests");
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (e) {
      console.error("Failed to fetch requests", e);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchRequests();
    }
  }, [isAdmin]);

  const handleSelectPolicy = (id: string) => {
    setActivePolicyId(id);
    const pol = policies.find(p => p.id === id);
    if (pol) {
      setYamlContent(pol.content);
      fetchVersions(pol.id);
    }
  };

  const handleCreatePolicy = async () => {
    if (!newPolicyName.trim()) return toast.error("Name is required");
    setIsSaving(true);
    try {
      const defaultContent = `# Policy: ${newPolicyName}\n\nversion: "1.0"\npolicies:\n  - name: "Example Rule"\n    type: "regex"\n    match: ".*"\n    action: "allow"`;
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPolicyName,
          content: defaultContent,
          isActive: true,
          environment: environmentFilter,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const savedPolicy = await res.json();
      setIsCreateOpen(false);
      setNewPolicyName("");
      toast.success("Policy created.");
      await fetchPolicies(savedPolicy.id);
    } catch (error) {
      toast.error("Failed to create policy.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (activePolicyId === "new") return toast.error("Please create a policy first.");
    setIsSaving(true);
    const activePol = policies.find(p => p.id === activePolicyId);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activePolicyId,
          name: activePol?.name || "Updated Policy",
          content: yamlContent,
          isActive: true,
          environment: environmentFilter,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Policy saved successfully.");
      fetchVersions(activePolicyId);
    } catch (error) {
      toast.error("Failed to save policy.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedForDelete.length === 0) return;
    setIsDeleting(true);
    try {
      for (const id of selectedForDelete) {
        await fetch(`/api/policies?id=${id}`, { method: "DELETE" });
      }
      toast.success("Selected policies deleted.");
      setIsDeleteOpen(false);
      setSelectedForDelete([]);
      await fetchPolicies();
    } catch (error) {
      toast.error("Failed to delete some policies.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (selectedForDelete.length === 0) return;
    setIsRequestingDelete(true);
    try {
      for (const id of selectedForDelete) {
        const res = await fetch("/api/policies/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId: id })
        });
        if (!res.ok) {
           const err = await res.json();
           if (err.error !== 'Deletion request already pending for this policy') {
             toast.error(err.error || "Failed to request deletion");
           }
        }
      }
      toast.success("Deletion requests submitted for approval.");
      setIsDeleteOpen(false);
      setSelectedForDelete([]);
    } catch (error) {
      toast.error("Failed to submit deletion requests.");
    } finally {
      setIsRequestingDelete(false);
    }
  };

  const handleApproveDeny = async (requestId: string, status: "approved" | "denied") => {
    try {
      const res = await fetch("/api/policies/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status })
      });
      if (!res.ok) throw new Error("Failed to update request");
      toast.success(`Request ${status}`);
      await fetchRequests();
      await fetchPolicies();
    } catch (error) {
      toast.error("Failed to update request status");
    }
  };

  const handleSimulate = async () => {
    if (!testPrompt.trim()) return;
    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testPrompt,
          policyYaml: yamlContent,
        }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();
      setSimResult(data);
    } catch (error) {
      toast.error("Failed to run simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleImportTemplate = (template: any) => {
    const condition = template.definition.conditions[0];
    
    // escape backslashes and quotes for YAML double-quoted string
    const escapedRegex = condition.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    
    const newRuleYaml = `\n  - name: "${template.name}"\n    type: "regex"\n    match: "${escapedRegex}"\n    action: "${template.definition.action}"\n`;
    
    let currentYaml = yamlContent;
    if (!currentYaml.includes("policies:")) {
      currentYaml += "\npolicies:";
    }
    setYamlContent(currentYaml + newRuleYaml);
    setIsTemplateOpen(false);
    toast.success(`Template '${template.name}' added to current policy.`);
  };

  const categories = ["all", ...Array.from(new Set(POLICY_TEMPLATES.map(t => t.category)))];
  
  const filteredTemplates = POLICY_TEMPLATES.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.description.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesCategory = templateCategory === "all" || t.category === templateCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 space-y-4 p-8 pt-6 pb-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3 mb-2">
            <ShieldCheck className="h-8 w-8 text-cyan-400" />
            Policies
          </h2>
          <p className="text-muted-foreground text-sm">Manage your security guardrails and AI firewall rules.</p>
        </div>

        {canEdit ? (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white text-black hover:bg-gray-200 h-10 px-4 py-2">
              <Plus className="mr-2 h-4 w-4" />
              New Policy
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Create New Policy</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Give your new policy file a name.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="e.g. Finance App Guardrails"
                value={newPolicyName}
                onChange={(e) => setNewPolicyName(e.target.value)}
                className="bg-black/40 border-white/10 text-white"
              />
              <DialogFooter>
                <Button className="bg-white text-black hover:bg-gray-200" onClick={handleCreatePolicy} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button disabled className="bg-white/10 text-white/50 cursor-not-allowed">
            Read Only
          </Button>
        )}
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8 bg-black/20 border border-white/5 rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={environmentFilter} onValueChange={(v) => v && setEnvironmentFilter(v)}>
            <SelectTrigger className="w-[150px] bg-black/60 border-white/10 text-white h-9 text-sm">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
            </SelectContent>
          </Select>
          {policies.length > 0 && (
            <Select value={activePolicyId} onValueChange={(val) => { if (val) handleSelectPolicy(val) }}>
              <SelectTrigger className="w-[250px] bg-black/60 border-white/10 text-white h-9 text-sm">
                <SelectValue placeholder="Select a policy" />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/10 text-white">
                {policies.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
            <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 h-10 px-4 py-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Templates
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] bg-black border border-white/10 text-white h-[85vh] flex flex-col p-0 overflow-hidden">
              <div className="p-6 pb-4 border-b border-white/10 shrink-0">
                <DialogHeader>
                  <DialogTitle className="text-xl">Policy Template Library</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Browse and import production-ready guardrails directly into your active policy.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-4 mt-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search templates (e.g. HIPAA, PII, SQL)..." 
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="pl-9 bg-black/60 border-white/10 text-white h-10"
                    />
                  </div>
                  <Select value={templateCategory} onValueChange={(v) => v && setTemplateCategory(v)}>
                    <SelectTrigger className="w-[180px] bg-black/60 border-white/10 text-white h-10">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white max-h-[300px]">
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border border-white/5 rounded-lg border-dashed">
                      No templates match your search.
                    </div>
                  )}
                  {filteredTemplates.map((template, idx) => (
                    <motion.div
                      key={template.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      className="group relative bg-black/40 border border-white/10 hover:border-cyan-500/50 rounded-lg p-5 flex flex-col gap-3 transition-colors cursor-pointer"
                      onClick={() => handleImportTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <Badge variant="outline" className={`text-[10px] font-mono tracking-wider border-white/10 ${
                          template.category === 'Security' ? 'text-red-400 bg-red-400/5' :
                          template.category === 'Privacy' ? 'text-purple-400 bg-purple-400/5' :
                          template.category === 'Compliance' ? 'text-blue-400 bg-blue-400/5' :
                          template.category === 'Cost' ? 'text-emerald-400 bg-emerald-400/5' :
                          'text-orange-400 bg-orange-400/5'
                        }`}>
                          {template.category}
                        </Badge>
                        <Badge className={`px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${
                          template.definition.action === 'block' ? 'bg-red-500/10 text-red-500' :
                          template.definition.action === 'redact' ? 'bg-orange-500/10 text-orange-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {template.definition.action}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm leading-tight group-hover:text-cyan-400 transition-colors">
                          {template.name}
                        </h4>
                        <p className="text-muted-foreground text-xs mt-2 line-clamp-3 leading-relaxed">
                          {template.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>



          <Dialog open={isDeleteOpen} onOpenChange={(open) => {
            setIsDeleteOpen(open);
            if (open) setSelectedForDelete([]);
          }}>
            <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-red-500/20 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 h-10 px-4 py-2">
              <Trash2 className="mr-2 h-4 w-4" />
              {isAdmin ? "Delete..." : "Request Deletion..."}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>{isAdmin ? "Delete Policies" : "Request Policy Deletion"}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {isAdmin 
                    ? "Select the policies you want to permanently delete." 
                    : "Select the policies you want to request for deletion. An admin must approve your request."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 my-4 max-h-[300px] overflow-y-auto pr-4">
                {policies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center">No policies available.</p>
                )}
                {policies.map(p => (
                  <div key={p.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-white/5">
                    <Checkbox 
                      id={`del-${p.id}`} 
                      checked={selectedForDelete.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedForDelete(prev => [...prev, p.id]);
                        else setSelectedForDelete(prev => prev.filter(id => id !== p.id));
                      }}
                      className="border-white/20 data-[state=checked]:bg-red-500 data-[state=checked]:text-white"
                    />
                    <label htmlFor={`del-${p.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                      {p.name}
                    </label>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" className="border-white/10 text-white" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                <Button 
                  className="bg-red-500 text-white hover:bg-red-600" 
                  onClick={isAdmin ? handleBulkDelete : handleRequestDeletion} 
                  disabled={(isAdmin ? isDeleting : isRequestingDelete) || selectedForDelete.length === 0}
                >
                  {(isAdmin ? isDeleting : isRequestingDelete) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isAdmin ? "Delete Selected" : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isAdmin && pendingRequests.length > 0 && (
            <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
              <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-orange-500/20 bg-transparent text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 h-10 px-4 py-2 relative">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                Requests ({pendingRequests.length})
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle>Pending Deletion Requests</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Review policies requested for deletion by team members.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 my-4 max-h-[300px] overflow-y-auto pr-4">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="p-3 rounded-md border border-white/10 bg-black/40 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-white">{req.policyName}</p>
                          <p className="text-xs text-muted-foreground">Requested by {req.requesterName || req.requesterEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end mt-2">
                        <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => handleApproveDeny(req.id, "denied")}>
                          Deny
                        </Button>
                        <Button size="sm" className="bg-red-500 text-white hover:bg-red-600" onClick={() => handleApproveDeny(req.id, "approved")}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {canEdit && (
            <Button onClick={handleSave} disabled={isSaving || isLoading || activePolicyId === "new"} className="bg-white text-black hover:bg-gray-200 h-9 px-6">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {/* Left Column: Monaco Editor */}
        <Card className="glass-card border-white/5 md:col-span-2 flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-white">Policy Editor</CardTitle>
              <CardDescription className="text-muted-foreground">
                Define your security guardrails.
              </CardDescription>
            </div>
            <div className="flex bg-black/40 border border-white/10 rounded-md p-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setEditorMode("visual")}
                className={`h-7 px-3 text-xs ${editorMode === 'visual' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                Visual Builder
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setEditorMode("yaml")}
                className={`h-7 px-3 text-xs ${editorMode === 'yaml' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                Raw YAML
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-[600px]">
            <div className="relative flex h-[600px] w-full overflow-hidden rounded-md border border-white/10 bg-black">
              {isLoading ? (
                <div className="flex w-full items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                </div>
              ) : editorMode === "visual" ? (
                <div className="w-full h-full p-4 bg-[#0a0a0a]">
                  <VisualBuilder yamlContent={yamlContent} onChange={canEdit ? setYamlContent : () => {}} readOnly={!canEdit} />
                </div>
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  theme="vs-dark"
                  value={yamlContent}
                  onChange={(value) => setYamlContent(value || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    readOnly: !canEdit,
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Dynamic Panel */}
        <div className="md:col-span-1 flex flex-col h-full gap-4">
          <div className="flex p-1 bg-black/40 border border-white/10 rounded-lg shrink-0">
            <Button 
              variant="ghost" 
              className={`flex-1 h-8 text-xs ${activeTab === 'simulator' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`} 
              onClick={() => setActiveTab("simulator")}
            >
              <Code2 className="h-3 w-3 mr-2" /> Simulator
            </Button>
            <Button 
              variant="ghost" 
              className={`flex-1 h-8 text-xs ${activeTab === 'history' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`} 
              onClick={() => setActiveTab("history")}
            >
              <History className="h-3 w-3 mr-2" /> History
            </Button>
          </div>
          <AnimatePresence mode="wait">
            {activeTab === "simulator" ? (
              <motion.div 
                key="simulator"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass-card border-white/5">
                  <CardHeader>
                    <CardTitle className="text-white">Policy Simulator</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Test prompts against your current configuration.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <textarea
                        className="w-full h-32 rounded-md border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                        placeholder="Enter a test prompt..."
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                      />
                      <Button 
                        onClick={handleSimulate} 
                        disabled={isSimulating || !testPrompt.trim()} 
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                      >
                        {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Test
                      </Button>
                    </div>

                    {simResult && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`rounded-lg border p-4 mt-4 ${simResult.decision === 'block' ? 'border-red-500/20 bg-red-500/5' : simResult.decision === 'error' ? 'border-orange-500/20 bg-orange-500/5' : simResult.decision === 'redact' ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {simResult.decision === 'block' ? (
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                          ) : simResult.decision === 'error' ? (
                             <ShieldAlert className="h-5 w-5 text-orange-500" />
                          ) : simResult.decision === 'redact' ? (
                             <ShieldAlert className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                          )}
                          <h4 className={`font-medium ${simResult.decision === 'block' ? 'text-red-500' : simResult.decision === 'error' ? 'text-orange-500' : simResult.decision === 'redact' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                            {simResult.decision === 'block' ? 'Access Blocked' : simResult.decision === 'error' ? 'Invalid Policy' : simResult.decision === 'redact' ? 'Redacted' : 'Access Allowed'}
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{simResult.reason}</p>
                        {simResult.decision !== 'error' && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Threat Score:</span>
                            <Badge variant="outline" className="font-mono border-white/10 text-muted-foreground">
                              {(simResult.score * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="glass-card border-white/5 h-[680px]">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Version History
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Click to view past states.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[550px] pr-4">
                      {versions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center mt-10">No history found.</p>
                      ) : (
                        <div className="space-y-4">
                          {versions.map((v, i) => (
                            <div key={v.id} className="p-3 rounded-md border border-white/10 bg-black/40 flex flex-col gap-2 relative transition-colors hover:bg-white/5 cursor-pointer"
                                 onClick={() => {
                                   setViewerContent(v.content);
                                   setViewerVersionId(v.id);
                                   setViewerOpen(true);
                                 }}>
                              {i === 0 && (
                                <Badge className="absolute -top-2 -right-2 bg-emerald-500 text-white">Current</Badge>
                              )}
                              <div className="text-sm text-white font-medium flex items-center gap-2">
                                <Eye className="h-4 w-4 text-cyan-400" />
                                {new Date(v.createdAt).toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground pl-6">
                                {v.versionMessage || "Update"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Version Viewer Modal */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="sm:max-w-4xl max-w-4xl bg-black border border-white/10 text-white h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>View Policy Version</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Reviewing the policy state. Restoring will apply this to the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 border border-white/10 rounded-md overflow-hidden relative">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              theme="vs-dark"
              value={viewerContent}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" className="border-white/10 text-white" onClick={() => setViewerOpen(false)}>Close</Button>
            <Button className="bg-white text-black hover:bg-gray-200" disabled={!canEdit} onClick={() => {
              setYamlContent(viewerContent);
              setViewerOpen(false);
              toast.success("Version restored to editor! Click Save Changes to apply.");
            }}>
              Restore This Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
