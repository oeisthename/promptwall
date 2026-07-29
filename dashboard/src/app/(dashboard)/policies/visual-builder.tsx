import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical } from "lucide-react";
import * as yaml from "js-yaml";
import { toast } from "sonner";

interface Rule {
  name: string;
  type: string;
  match: string;
  action: string;
}

interface PolicyDoc {
  version: string;
  policies: Rule[];
}

export function VisualBuilder({ 
  yamlContent, 
  onChange 
}: { 
  yamlContent: string; 
  onChange: (yaml: string) => void;
}) {
  const [doc, setDoc] = useState<PolicyDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync from YAML to Visual Builder when component mounts or yaml changes externally
  useEffect(() => {
    try {
      const parsed = yaml.load(yamlContent) as any;
      if (parsed && typeof parsed === 'object') {
        setDoc({
          version: parsed.version || "1.0",
          policies: Array.isArray(parsed.policies) ? parsed.policies : []
        });
        setError(null);
      }
    } catch (e: any) {
      setError("Cannot parse YAML visually. Please fix syntax errors in the YAML editor first.");
    }
  }, [yamlContent]);

  const updateDoc = (newDoc: PolicyDoc) => {
    setDoc(newDoc);
    try {
      const newYaml = yaml.dump(newDoc);
      onChange(newYaml);
    } catch (e) {
      toast.error("Failed to generate YAML from visual builder.");
    }
  };

  const updateRule = (index: number, field: keyof Rule, value: string) => {
    if (!doc) return;
    const newPolicies = [...doc.policies];
    newPolicies[index] = { ...newPolicies[index], [field]: value };
    updateDoc({ ...doc, policies: newPolicies });
  };

  const addRule = () => {
    if (!doc) return;
    updateDoc({
      ...doc,
      policies: [...doc.policies, { name: "New Rule", type: "regex", match: ".*", action: "block" }]
    });
  };

  const removeRule = (index: number) => {
    if (!doc) return;
    const newPolicies = [...doc.policies];
    newPolicies.splice(index, 1);
    updateDoc({ ...doc, policies: newPolicies });
  };

  if (error || !doc) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground border border-red-500/20 bg-red-500/5 rounded-md">
        <p>{error || "Failed to load policy structure."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-2">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-white font-medium text-lg">Policy Rules</h3>
          <p className="text-sm text-muted-foreground">Visually build your firewall rules. Changes sync automatically to YAML.</p>
        </div>
        <Button onClick={addRule} size="sm" className="bg-white text-black hover:bg-gray-200">
          <Plus className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>

      <div className="space-y-4">
        {doc.policies.length === 0 ? (
          <div className="text-center p-8 border border-white/5 border-dashed rounded-lg text-muted-foreground">
            No rules defined. Add a rule to get started.
          </div>
        ) : (
          doc.policies.map((rule, idx) => (
            <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col gap-4 relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => removeRule(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mr-8">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rule Name</label>
                  <Input 
                    value={rule.name || ""} 
                    onChange={(e) => updateRule(idx, "name", e.target.value)}
                    className="bg-black/60 border-white/10 text-white h-9"
                    placeholder="e.g. Block PII"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</label>
                  <Select value={rule.action || "block"} onValueChange={(v) => v && updateRule(idx, "action", v)}>
                    <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="allow">Allow</SelectItem>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="redact">Redact</SelectItem>
                      <SelectItem value="require_approval">Require Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matcher Type</label>
                  <Select value={rule.type || "regex"} onValueChange={(v) => v && updateRule(idx, "type", v)}>
                    <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="regex">Regular Expression</SelectItem>
                      <SelectItem value="exact">Exact String Match</SelectItem>
                      <SelectItem value="llm_eval">LLM Evaluation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pattern / Match</label>
                  <Input 
                    value={rule.match || ""} 
                    onChange={(e) => updateRule(idx, "match", e.target.value)}
                    className="bg-black/60 border-white/10 text-white h-9 font-mono text-sm"
                    placeholder="e.g. (?i)(password|secret)"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
