"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ShieldCheck, FileText, Database, Key, Settings, BarChart3, Users, LayoutDashboard, Play, Route, Activity } from "lucide-react";

export function CommandMenu({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, [setOpen]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/policies"))}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span>Policies</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/apikeys"))}>
            <Key className="mr-2 h-4 w-4" />
            <span>API Keys</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/teams"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Teams & Access</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/statistics"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Statistics</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/playground"))}>
            <Play className="mr-2 h-4 w-4" />
            <span>Playground</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/audit"))}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Audit Log</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/routing"))}>
            <Route className="mr-2 h-4 w-4" />
            <span>Routing</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => router.push("/profile"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>System Configuration</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
