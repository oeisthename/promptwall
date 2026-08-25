"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, MonitorSmartphone, KeyRound, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export default function SettingsPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  // --- Profile State ---
  const [name, setName] = useState(session?.user?.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [totpURI, setTotpURI] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [mfaPasswordDialogOpen, setMfaPasswordDialogOpen] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [isGeneratingMfa, setIsGeneratingMfa] = useState(false);

  // --- Org Settings State ---
  const [webhookUrl, setWebhookUrl] = useState("");
  const [retentionDays, setRetentionDays] = useState("30");
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // SIEM States
  const [datadogEndpoint, setDatadogEndpoint] = useState("");
  const [datadogApiKey, setDatadogApiKey] = useState("");
  const [datadogEnabled, setDatadogEnabled] = useState(false);

  const [splunkEndpoint, setSplunkEndpoint] = useState("");
  const [splunkApiKey, setSplunkApiKey] = useState("");
  const [splunkEnabled, setSplunkEnabled] = useState(false);

  const [wazuhEndpoint, setWazuhEndpoint] = useState("");
  const [wazuhApiKey, setWazuhApiKey] = useState("");
  const [wazuhEnabled, setWazuhEnabled] = useState(false);

  const [elkEndpoint, setElkEndpoint] = useState("");
  const [elkApiKey, setElkApiKey] = useState("");
  const [elkEnabled, setElkEnabled] = useState(false);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.id) return;
      try {
        let orgData = null;
        const { data } = await authClient.organization.getFullOrganization();
        orgData = data;
        
        if (!orgData) {
          const orgsResp = (authClient.organization as any).list 
            ? await (authClient.organization as any).list()
            : { data: [] };
            
          if (orgsResp.data && orgsResp.data.length > 0) {
            await authClient.organization.setActive({ organizationId: orgsResp.data[0].id });
            const { data: newOrg } = await authClient.organization.getFullOrganization();
            orgData = newOrg;
          }
        }

        if (orgData) {
          const currentMember = orgData.members?.find((m: any) => m.userId === session.user.id);
          const currentRole = currentMember?.role || "member";
          setIsAdmin(currentRole === "admin" || currentRole === "owner");
        }
      } catch (e) {
        console.error("Failed to fetch organization role", e);
      } finally {
        setRoleChecked(true);
      }
    };
    fetchRole();
  }, [session?.user?.id]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { data } = await authClient.listSessions();
        if (data) setActiveSessions(data);
      } catch (e) {
        console.error("Failed to fetch sessions", e);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    const fetchOrgSettings = async () => {
      if (!isAdmin) {
        setIsLoadingOrg(false);
        return;
      }
      try {
        const [settingsRes, siemRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/settings/siem")
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setWebhookUrl(data.webhookUrl || "");
          setRetentionDays(data.retentionDays ? data.retentionDays.toString() : "30");
        }

        if (siemRes.ok) {
          const siemData = await siemRes.json();
          siemData.forEach((siem: any) => {
            if (siem.provider === 'datadog') {
              setDatadogEndpoint(siem.endpoint || "");
              setDatadogApiKey(siem.apiKey || "");
              setDatadogEnabled(siem.enabled);
            } else if (siem.provider === 'splunk') {
              setSplunkEndpoint(siem.endpoint || "");
              setSplunkApiKey(siem.apiKey || "");
              setSplunkEnabled(siem.enabled);
            } else if (siem.provider === 'wazuh') {
              setWazuhEndpoint(siem.endpoint || "");
              setWazuhApiKey(siem.apiKey || "");
              setWazuhEnabled(siem.enabled);
            } else if (siem.provider === 'elk') {
              setElkEndpoint(siem.endpoint || "");
              setElkApiKey(siem.apiKey || "");
              setElkEnabled(siem.enabled);
            }
          });
        }
      } catch (error) {
        toast.error("Failed to load organization settings");
      } finally {
        setIsLoadingOrg(false);
      }
    };
    fetchOrgSettings();
  }, [isAdmin]);

  // --- Handlers ---
  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      await authClient.updateUser({ name });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartMfaSetup = () => {
    setMfaPassword("");
    setMfaPasswordDialogOpen(true);
  };

  const handleEnableMFA = async () => {
    if (!mfaPassword) return toast.error("Password is required");
    setIsGeneratingMfa(true);
    try {
      const { data, error } = await authClient.twoFactor.enable({ password: mfaPassword } as any);
      if (error) throw error;
      setTotpURI(data?.totpURI || "");
      setMfaPasswordDialogOpen(false);
      setMfaDialogOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate MFA secret.");
    } finally {
      setIsGeneratingMfa(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaCode || mfaCode.length < 6) return toast.error("Invalid code");
    setIsVerifying(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: mfaCode } as any);
      if (error) throw error;
      toast.success("MFA successfully enabled!");
      setMfaDialogOpen(false);
    } catch (e: any) {
      toast.error("Failed to verify code. " + e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    try {
      await authClient.revokeSession({ token });
      toast.success("Session revoked");
    } catch (error) {
      toast.error("Failed to revoke session");
    }
  };

  const handleSaveOrgSettings = async () => {
    setIsSavingOrg(true);
    try {
      const p1 = fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, retentionDays: parseInt(retentionDays, 10) }),
      });
      const p2 = fetch("/api/settings/siem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: 'datadog', endpoint: datadogEndpoint, apiKey: datadogApiKey, enabled: datadogEnabled })
      });
      const p3 = fetch("/api/settings/siem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: 'splunk', endpoint: splunkEndpoint, apiKey: splunkApiKey, enabled: splunkEnabled })
      });
      const p4 = fetch("/api/settings/siem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: 'wazuh', endpoint: wazuhEndpoint, apiKey: wazuhApiKey, enabled: wazuhEnabled })
      });
      const p5 = fetch("/api/settings/siem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: 'elk', endpoint: elkEndpoint, apiKey: elkApiKey, enabled: elkEnabled })
      });

      const results = await Promise.all([p1, p2, p3, p4, p5]);
      if (results.some(res => !res.ok)) throw new Error("Failed to save some configurations");
      
      toast.success("Organization Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSavingOrg(false);
    }
  };

  if (sessionPending || !roleChecked) {
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
      className="flex-1 space-y-6 p-8 pt-6 pb-20 max-w-5xl mx-auto"
    >
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-white flex items-center gap-3">
            <Settings className="h-7 w-7 text-white/70" />
            Settings
          </h2>
          <p className="text-muted-foreground mt-2">Manage your personal and organization preferences.</p>
        </div>
      </div>

      <div className="space-y-12 w-full">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card border-white/5 h-fit">
              <CardHeader>
                <CardTitle className="text-white">Personal Information</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Update your photo and personal details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border border-white/10">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User"} />
                    <AvatarFallback className="text-2xl bg-black/60">{session?.user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <Button variant="outline" className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => toast.info('Image upload coming soon')}>
                      Change Photo
                    </Button>
                    <p className="text-xs text-muted-foreground pt-1">Recommended size 256x256px.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-black/40 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Email Address</Label>
                    <Input
                      id="email"
                      value={session?.user?.email || ""}
                      disabled
                      className="bg-black/40 border-white/5 text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-white/5 pt-4 flex justify-end">
                <Button onClick={handleUpdateProfile} disabled={isSavingProfile} className="bg-white text-black hover:bg-gray-200">
                  {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Profile
                </Button>
              </CardFooter>
            </Card>

            <div className="space-y-6">
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-purple-400" />
                    Security
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Secure your account with two-factor authentication.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg bg-black/20">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        Two-Factor Authentication
                        <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400 border border-orange-500/20">
                          Not Configured
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                    </div>
                    <Button variant="outline" onClick={handleStartMfaSetup} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                      Setup MFA
                    </Button>
                  </div>
                  
                  <Dialog open={mfaPasswordDialogOpen} onOpenChange={setMfaPasswordDialogOpen}>
                    <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Confirm Password</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Please enter your password to enable Two-Factor Authentication.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-white">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={mfaPassword}
                            onChange={(e) => setMfaPassword(e.target.value)}
                            className="bg-black/40 border-white/10 text-white"
                          />
                        </div>
                      </div>
                      <DialogFooter className="sm:justify-end">
                        <Button variant="outline" className="border-white/10 text-white" onClick={() => setMfaPasswordDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-white text-black hover:bg-gray-200" onClick={handleEnableMFA} disabled={isGeneratingMfa}>
                          {isGeneratingMfa && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Continue
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
                    <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Scan the QR code with your authenticator app (e.g. Google Authenticator, Authy).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center justify-center py-4 space-y-4">
                        {totpURI ? (
                          <div className="bg-white p-4 rounded-xl">
                            <QRCodeSVG value={totpURI} size={200} />
                          </div>
                        ) : (
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        )}
                        <div className="w-full space-y-2">
                          <Label htmlFor="code" className="text-white">Verification Code</Label>
                          <Input
                            id="code"
                            placeholder="123456"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            className="bg-black/40 border-white/10 text-white text-center tracking-widest text-lg"
                            maxLength={6}
                          />
                        </div>
                      </div>
                      <DialogFooter className="sm:justify-end">
                        <Button variant="outline" className="border-white/10 text-white" onClick={() => setMfaDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-white text-black hover:bg-gray-200" onClick={handleVerifyMFA} disabled={isVerifying}>
                          {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Verify & Enable
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MonitorSmartphone className="h-5 w-5 text-cyan-400" />
                    Active Sessions
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage devices currently logged into your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {activeSessions?.map((s: any) => (
                    <div key={s.token} className="flex items-center justify-between p-4 border border-white/5 rounded-lg bg-black/20">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <MonitorSmartphone className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white flex items-center gap-2">
                            {s.userAgent?.includes("Mac") ? "Mac OS" : s.userAgent?.includes("Windows") ? "Windows" : "Unknown Device"}
                            {s.token === session?.session?.token && (
                              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/20">
                                Current Session
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            IP: {s.ipAddress || 'Unknown'} • Last Active: {new Date(s.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {s.token !== session?.session?.token && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRevokeSession(s.token)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div>
              <h3 className="text-xl font-medium text-white">Organization Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage global configurations for your team.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveOrgSettings} disabled={isSavingOrg || isLoadingOrg} className="bg-white text-black hover:bg-gray-200">
                {isSavingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Org Configuration
              </Button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Alerts & Webhooks</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure notifications for critical security events.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingOrg ? (
                    <div className="flex h-[100px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="webhook" className="text-white">Slack / Discord Webhook URL</Label>
                      <Input
                        id="webhook"
                        placeholder="https://hooks.slack.com/services/..."
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="bg-black/40 border-white/10 text-white placeholder:text-muted-foreground/50 h-10"
                      />
                      <p className="text-xs text-muted-foreground pt-1">
                        We will send a POST request with the threat details whenever a prompt is blocked.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Data Retention</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage how long audit logs are kept in the database.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingOrg ? (
                    <div className="flex h-[100px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="retention" className="text-white">Audit Log Retention</Label>
                      <Select value={retentionDays} onValueChange={(val) => { if (val) setRetentionDays(val); }}>
                        <SelectTrigger id="retention" className="w-full bg-black/40 border-white/10 text-white h-10">
                          <SelectValue placeholder="Select retention period" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-white/10 text-white">
                          <SelectItem value="7">7 Days</SelectItem>
                          <SelectItem value="30">30 Days</SelectItem>
                          <SelectItem value="90">90 Days</SelectItem>
                          <SelectItem value="365">1 Year</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground pt-1">
                        Older logs will be automatically purged by the cleanup job.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SIEM INTEGRATIONS */}
              <Card className="glass-card border-white/5 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">SIEM Integrations</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Export audit logs automatically to your preferred enterprise logging platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {isLoadingOrg ? (
                    <div className="flex h-[100px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                    </div>
                  ) : (
                    <>
                      {/* Datadog */}
                      <div className="grid gap-4 md:grid-cols-2 p-4 border border-white/5 rounded-lg bg-black/20 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#632ca6]"></div>
                        <div className="col-span-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-white">Datadog</h4>
                            <p className="text-sm text-muted-foreground">Send audit logs to Datadog Logs API.</p>
                          </div>
                          <Switch checked={datadogEnabled} onCheckedChange={setDatadogEnabled} className="data-[state=checked]:bg-[#632ca6]" />
                        </div>
                        
                        {datadogEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-white">API Endpoint</Label>
                              <Input
                                placeholder="https://http-intake.logs.datadoghq.com/api/v2/logs"
                                value={datadogEndpoint}
                                onChange={(e) => setDatadogEndpoint(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white">API Key</Label>
                              <Input
                                type="password"
                                placeholder="ddp_..."
                                value={datadogApiKey}
                                onChange={(e) => setDatadogApiKey(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Splunk */}
                      <div className="grid gap-4 md:grid-cols-2 p-4 border border-white/5 rounded-lg bg-black/20 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff0098]"></div>
                        <div className="col-span-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-white">Splunk</h4>
                            <p className="text-sm text-muted-foreground">Send audit logs via Splunk HTTP Event Collector (HEC).</p>
                          </div>
                          <Switch checked={splunkEnabled} onCheckedChange={setSplunkEnabled} className="data-[state=checked]:bg-[#ff0098]" />
                        </div>
                        
                        {splunkEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-white">HEC URL</Label>
                              <Input
                                placeholder="https://prd-p-xxxx.splunkcloud.com:8088/services/collector"
                                value={splunkEndpoint}
                                onChange={(e) => setSplunkEndpoint(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white">HEC Token</Label>
                              <Input
                                type="password"
                                placeholder="xxxx-xxxx-xxxx-xxxx"
                                value={splunkApiKey}
                                onChange={(e) => setSplunkApiKey(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Wazuh */}
                      <div className="grid gap-4 md:grid-cols-2 p-4 border border-white/5 rounded-lg bg-black/20 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00A1E0]"></div>
                        <div className="col-span-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-white">Wazuh</h4>
                            <p className="text-sm text-muted-foreground">Send security events to Wazuh Manager API.</p>
                          </div>
                          <Switch checked={wazuhEnabled} onCheckedChange={setWazuhEnabled} className="data-[state=checked]:bg-[#00A1E0]" />
                        </div>
                        
                        {wazuhEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-white">API Endpoint</Label>
                              <Input
                                placeholder="https://wazuh-manager.local:55000/security/user/authenticate"
                                value={wazuhEndpoint}
                                onChange={(e) => setWazuhEndpoint(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white">API Key / Token</Label>
                              <Input
                                type="password"
                                placeholder="Base64 encoded auth or JWT token"
                                value={wazuhApiKey}
                                onChange={(e) => setWazuhApiKey(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* ELK */}
                      <div className="grid gap-4 md:grid-cols-2 p-4 border border-white/5 rounded-lg bg-black/20 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00bfb3]"></div>
                        <div className="col-span-2 flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-medium text-white">Elastic Stack (ELK)</h4>
                            <p className="text-sm text-muted-foreground">Send logs to Elasticsearch or Logstash.</p>
                          </div>
                          <Switch checked={elkEnabled} onCheckedChange={setElkEnabled} className="data-[state=checked]:bg-[#00bfb3]" />
                        </div>
                        
                        {elkEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-white">Elasticsearch URL</Label>
                              <Input
                                placeholder="https://elasticsearch.local:9200/promptwall-logs/_doc"
                                value={elkEndpoint}
                                onChange={(e) => setElkEndpoint(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white">API Key</Label>
                              <Input
                                type="password"
                                placeholder="Elasticsearch API Key"
                                value={elkApiKey}
                                onChange={(e) => setElkApiKey(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
