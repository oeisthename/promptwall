"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ShieldAlert, Activity, Users } from "lucide-react";
import { toast } from "sonner";

import { getStatisticsAction } from "./actions";
import { useEffect } from "react";

export default function StatisticsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [data, setData] = useState<any[]>([]);
  const [severityData, setSeverityData] = useState<any[]>([]);
  const [topRules, setTopRules] = useState<any[]>([]);

  useEffect(() => {
    getStatisticsAction().then(res => {
      setData(res.data);
      setSeverityData(res.severityData);
      setTopRules(res.topRules);
      setIsLoading(false);
    }).catch(console.error);
  }, []);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      // Dynamically import PDF renderer to prevent massive compilation delays on page load
      const { pdf } = await import('@react-pdf/renderer');
      const { SecurityReportPDF } = await import('@/components/pdf-report');

      const blob = await pdf(<SecurityReportPDF 
        data={data} 
        severityData={severityData} 
        topRules={topRules} 
      />).toBlob();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PromptWall_Enterprise_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("Cybersecurity Report generated successfully");
    } catch (e) {
      toast.error("Failed to generate report");
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 space-y-4 p-8 pt-6 pb-20"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-medium tracking-tight text-white">Advanced Analytics</h2>
          <Button onClick={handleDownloadPdf} disabled={isExporting || isLoading} className="bg-cyan-500 hover:bg-cyan-600 text-white">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export PDF Report
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests (24h)</CardTitle>
                  <Activity className="h-4 w-4 text-cyan-500" />
            </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{data.reduce((sum, d) => sum + d.requests, 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Live data from edge</p>
                </CardContent>
          </Card>
          <Card className="glass-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Threats Blocked</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{data.reduce((sum, d) => sum + d.blocked, 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-red-400">Total blocked actions</p>
                </CardContent>
          </Card>
          <Card className="glass-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{data.length > 0 ? "Active" : "Pending"}</div>
                  <p className="text-xs text-muted-foreground mt-1">Telemetry status</p>
                </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card border-white/5 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">API Traffic & Threat Volume</CardTitle>
              <CardDescription className="text-muted-foreground">
                Total requests processed vs blocked by PromptWall over 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div id="chart-traffic" className="h-[300px] w-full mt-4 p-4 bg-[#0a0a0a] rounded-lg">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                    <Area type="monotone" dataKey="requests" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
                    <Area type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorBlocked)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-white">Threat Severity</CardTitle>
              <CardDescription className="text-muted-foreground">Distribution of blocked requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div id="chart-severity" className="h-[300px] w-full mt-4 p-4 bg-[#0a0a0a] rounded-lg flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-white">Top Triggered Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div id="chart-rules" className="h-[300px] w-full mt-4 p-4 bg-[#0a0a0a] rounded-lg">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topRules} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="rule" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={150} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="hits" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </motion.div>
  );
}
