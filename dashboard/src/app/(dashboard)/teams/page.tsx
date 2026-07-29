"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Users, UserPlus, Shield, Copy, Check, MoreHorizontal, Trash, ShieldAlert, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export default function TeamsPage() {
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: session } = authClient.useSession();
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const currentRole = currentUserMember?.role || "member";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  // Create Org State
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Invite State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const fetchOrgData = async () => {
    try {
      const { data: org, error } = await authClient.organization.getFullOrganization();
      if (org) {
        setActiveOrg(org);
        setMembers(org.members || []);
        setInvitations(org.invitations || []);
      } else {
        // If no active organization, check if they belong to any
        const orgsResp = (authClient.organization as any).list 
          ? await (authClient.organization as any).list()
          : { data: [] };
          
        if (orgsResp.data && orgsResp.data.length > 0) {
          await authClient.organization.setActive({ organizationId: orgsResp.data[0].id });
          const { data: newOrg } = await authClient.organization.getFullOrganization();
          if (newOrg) {
            setActiveOrg(newOrg);
            setMembers(newOrg.members || []);
            setInvitations(newOrg.invitations || []);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, []);

  const handleCreateOrg = async () => {
    if (!orgName || !orgSlug) return;
    setIsCreating(true);
    try {
      const { data, error } = await authClient.organization.create({
        name: orgName,
        slug: orgSlug
      });
      if (error) throw error;
      toast.success("Organization created successfully");
      await fetchOrgData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const { data, error } = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole as "member" | "admin"
      });
      if (error) throw error;
      
      const link = `${window.location.origin}/accept-invitation/${data.id}`;
      setGeneratedLink(link);
      setIsLinkDialogOpen(true);
      setHasCopied(false);
      
      toast.success("Invitation generated successfully");
      setInviteEmail("");
      await fetchOrgData();
    } catch (error: any) {
      toast.error(error.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setHasCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "member") => {
    try {
      const { error } = await authClient.organization.updateMemberRole({
        memberId,
        role: newRole
      });
      if (error) throw error;
      toast.success("Role updated successfully");
      await fetchOrgData();
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId
      });
      if (error) throw error;
      toast.success("Member removed");
      await fetchOrgData();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove member");
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId
      });
      if (error) throw error;
      toast.success("Invitation cancelled");
      await fetchOrgData();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel invitation");
    }
  };

  if (isLoading) {
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
      className="flex-1 space-y-6 p-8 pt-6"
    >
      <div className="flex items-center justify-between space-y-2 mb-6">
        <h2 className="text-3xl font-medium tracking-tight text-white">Team Management</h2>
      </div>

      {!activeOrg ? (
        <Card className="glass-card border-white/5 max-w-md">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create Organization
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Create a team to start inviting members and configuring RBAC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Organization Name</Label>
              <Input
                placeholder="Acme Corp Security"
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                }}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">URL Slug</Label>
              <Input
                placeholder="acme-corp"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
            <Button 
              className="w-full bg-white text-black hover:bg-gray-200 mt-2"
              onClick={handleCreateOrg}
              disabled={isCreating || !orgName || !orgSlug}
            >
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-6 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-1'}`}>
          
          <div className={`${isAdmin ? 'md:col-span-2' : ''} space-y-6`}>
            <Card className="glass-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {activeOrg.name} Members
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage roles and access for your team.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-white/10 text-white bg-white/5">
                  {members.length} Members
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/40">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                          {member.user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{member.user.name}</p>
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={member.role === 'owner' ? 'bg-purple-500/20 text-purple-400' : member.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white'}>
                          {member.role}
                        </Badge>
                        {isAdmin && member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0a0a0a] border-white/10 text-white">
                              {member.role === 'member' && (
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'admin')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10">
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              {member.role === 'admin' && (
                                <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'member')} className="cursor-pointer hover:bg-white/10 focus:bg-white/10">
                                  <Users className="mr-2 h-4 w-4" />
                                  Make Member
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleRemoveMember(member.user.email)} className="cursor-pointer text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400">
                                <Trash className="mr-2 h-4 w-4" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {isAdmin && invitations.filter((i: any) => i.status === 'pending').length > 0 && (
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Pending Invitations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {invitations.filter((i: any) => i.status === 'pending').map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/20 opacity-80">
                        <div className="text-sm text-white">{inv.email}</div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-white/10 text-yellow-500">{inv.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => handleCancelInvite(inv.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {isAdmin && (
            <div className="md:col-span-1">
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Invite Member
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Generate an invite link for a colleague to join {activeOrg.name}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-black/40 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Role</Label>
                    <Select value={inviteRole} onValueChange={(val) => { if (val) setInviteRole(val); }}>
                      <SelectTrigger className="w-full bg-black/40 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0a] border-white/10 text-white">
                        <SelectItem value="member">Member (View Only)</SelectItem>
                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white mt-2"
                    onClick={handleInvite}
                    disabled={isInviting || !inviteEmail}
                  >
                    {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Link
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      )}

      {/* Manual Invite Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Invitation Generated</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send this link to the user. They must sign in using the exact email address you invited them with.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="link"
                defaultValue={generatedLink}
                readOnly
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
            <Button type="button" size="sm" className="px-3 bg-white text-black hover:bg-gray-200" onClick={copyToClipboard}>
              <span className="sr-only">Copy</span>
              {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setIsLinkDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
