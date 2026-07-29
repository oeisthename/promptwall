"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Search, Eye, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { DiffViewer } from "./diff-viewer";
import { toast } from "sonner";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"history" | "live">("history");
  
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  // Live Stream State
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (environmentFilter !== "all") params.append("environment", environmentFilter);
      if (decisionFilter !== "all") params.append("decision", decisionFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
      toast.error("Failed to fetch audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "history") {
      fetchLogs();
    }
  }, [search, environmentFilter, decisionFilter, severityFilter, viewMode]);

  // Live Stream Polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (viewMode === "live" && isLiveActive) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/audit?limit=20`);
          if (res.ok) {
            const data = await res.json();
            // Merge new logs, keeping max 100
            setLiveLogs(prev => {
              const newLogs = data.filter((d: any) => !prev.some(p => p.id === d.id));
              const combined = [...newLogs, ...prev].slice(0, 100);
              return combined;
            });
          }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [viewMode, isLiveActive]);

  useEffect(() => {
    if (viewMode === "live" && liveLogs.length === 0) {
      // initial fetch for live mode
      fetch(`/api/audit?limit=20`).then(res => res.json()).then(data => setLiveLogs(data));
      setIsLiveActive(true);
    }
  }, [viewMode]);

  const exportCSV = () => {
    if (logs.length === 0) return toast.info("No logs to export");
    const headers = ["ID", "Timestamp", "Decision", "Matched Rule", "Original Prompt", "Sanitized Prompt", "Score", "Latency"];
    const csvContent = [
      headers.join(","),
      ...logs.map(log => 
        [
          log.id, 
          log.timestamp, 
          log.decision, 
          log.matchedRule, 
          `"${(log.prompt || '').replace(/"/g, '""')}"`, 
          `"${(log.sanitized || '').replace(/"/g, '""')}"`, 
          log.score, 
          log.latency
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `compliance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Compliance report downloaded");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 space-y-4 p-8 pt-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3">
            Audit Logs
            {viewMode === "live" && isLiveActive && (
              <span className="flex h-3 w-3 relative ml-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </h2>
          <p className="text-muted-foreground mt-1">Explore LLM requests, inspect redactions, and export compliance reports.</p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList className="bg-black/60 border border-white/10 h-10">
              <TabsTrigger value="history" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground">
                History
              </TabsTrigger>
              <TabsTrigger value="live" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground">
                <Activity className="h-4 w-4 mr-2" /> Live Stream
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {viewMode === "history" && (
            <Button onClick={exportCSV} className="bg-white text-black hover:bg-gray-200 h-10">
              <Download className="mr-2 h-4 w-4" /> Export Report
            </Button>
          )}
        </div>
      </div>

      {viewMode === "history" ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 bg-black/40 p-4 rounded-lg border border-white/5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search prompts..." 
            className="pl-9 bg-black/60 border-white/10 text-white h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-32">
          <Select value={environmentFilter} onValueChange={(v) => v && setEnvironmentFilter(v)}>
            <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="all">All Envs</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-32">
          <Select value={decisionFilter} onValueChange={(v) => v && setDecisionFilter(v)}>
            <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="block">Block</SelectItem>
              <SelectItem value="redact">Redact</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-32">
          <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
            <SelectTrigger className="bg-black/60 border-white/10 text-white h-9">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card className="glass-card border-white/5">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : (
              <div className="rounded-md border border-white/10 overflow-hidden bg-black/50 backdrop-blur-md">
                <Table>
                  <TableHeader className="bg-white/5 hover:bg-white/5">
                    <TableRow className="border-b border-white/10 hover:bg-white/5">
                      <TableHead className="text-muted-foreground font-medium">Timestamp</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Prompt Preview</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Decision</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Matched Rule</TableHead>
                      <TableHead className="text-muted-foreground font-medium text-right">Score</TableHead>
                      <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No audit logs found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium text-white max-w-sm truncate">
                            {log.prompt}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.decision === "allow" ? "default" : "destructive"}
                              className={log.decision === "allow" ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : log.decision === "block" ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"}
                            >
                              {log.decision.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {log.matchedRule || "N/A"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {(log.score * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
        </>
      ) : (
        <Card className="glass-card border-white/5 bg-black h-[600px] flex flex-col relative overflow-hidden">
          <CardHeader className="border-b border-white/10 bg-black/80 flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-white font-mono flex items-center gap-2">
                <span className="text-emerald-500">▶</span> promptwall/proxy-stream
              </CardTitle>
              <CardDescription className="text-muted-foreground font-mono text-xs mt-1">
                Polling realtime requests... (Short-polling)
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-white/10 ${isLiveActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
              onClick={() => setIsLiveActive(!isLiveActive)}
            >
              {isLiveActive ? "Pause Stream" : "Resume Stream"}
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto font-mono text-sm bg-[#050505]">
            <div className="p-4 space-y-2 flex flex-col-reverse">
              {liveLogs.map((log) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={log.id} 
                  className={`p-3 rounded border border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                    log.decision === 'block' ? 'bg-red-500/5' : log.decision === 'error' ? 'bg-orange-500/5' : 'bg-transparent'
                  }`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      log.decision === 'allow' ? 'bg-emerald-500/20 text-emerald-400' : 
                      log.decision === 'block' ? 'bg-red-500/20 text-red-400' : 
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {log.decision}
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 text-white/90 truncate">
                      <span className="text-cyan-400 font-bold mr-2">PROMPT:</span> 
                      {log.prompt}
                    </div>
                  </div>
                  {log.matchedRule && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Rule matched: <span className="text-white/70">{log.matchedRule}</span> (Score: {(log.score * 100).toFixed(1)}%)
                    </div>
                  )}
                </motion.div>
              ))}
              {liveLogs.length === 0 && (
                <div className="text-muted-foreground p-4 text-center">Waiting for incoming requests...</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="sm:max-w-[800px] border-l border-white/10 bg-[#0a0a0a] text-white p-0 flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <SheetHeader>
              <SheetTitle className="text-white text-xl">Log Inspector</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                Detailed view of the LLM request and policy enforcement.
              </SheetDescription>
            </SheetHeader>
          </div>
          
          {selectedLog && (
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/40 p-4 rounded-lg border border-white/5">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Decision</p>
                  <Badge className={selectedLog.decision === "allow" ? "bg-emerald-500/10 text-emerald-500" : selectedLog.decision === "block" ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"}>
                    {selectedLog.decision.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Matched Rule</p>
                  <p className="font-medium text-sm">{selectedLog.matchedRule || "None"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Threat Score</p>
                  <p className="font-medium text-sm">{(selectedLog.score * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Latency</p>
                  <p className="font-medium text-sm font-mono">{selectedLog.latency}ms</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Redaction Analysis</h3>
                <DiffViewer original={selectedLog.prompt || ""} sanitized={selectedLog.sanitized || selectedLog.prompt || ""} />
              </div>

              {selectedLog.threats && selectedLog.threats !== "[]" && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Detected Threats</h3>
                  <div className="bg-black/60 border border-white/10 rounded-md p-4 font-mono text-xs text-red-400">
                    <pre>{JSON.stringify(typeof selectedLog.threats === 'string' ? JSON.parse(selectedLog.threats) : selectedLog.threats, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium mb-3">Cryptographic Hash</h3>
                <div className="bg-black/60 border border-white/10 rounded-md p-3 font-mono text-xs text-muted-foreground break-all">
                  {selectedLog.hash}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
