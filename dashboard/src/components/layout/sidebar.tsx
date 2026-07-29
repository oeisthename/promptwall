"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, FileText, Database, Key, Settings, BarChart3, Users, Zap, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "API Keys", href: "/apikeys", icon: Key },
  { name: "Policies", href: "/policies", icon: ShieldCheck },
  { name: "Playground", href: "/playground", icon: Zap },
  { name: "Audit Logs", href: "/audit", icon: Database },
  { name: "Statistics", href: "/statistics", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Routing", href: "/routing", icon: Route },
  { name: "Teams", href: "/teams", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  const activeMember = activeOrg?.members?.find((m) => m.userId === session?.user?.id);
  const role = activeMember?.role || "owner"; // fallback to owner if org not fully loaded for local dev
  const isAdmin = role === "admin" || role === "owner";

  const filteredNavigation = navigation.filter(item => {
    if (["API Keys", "Policies", "Teams", "Routing"].includes(item.name)) {
      return isAdmin;
    }
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col glass-card border-r border-border">
      <div className="flex h-16 shrink-0 items-center px-6">
        <ShieldCheck className="h-8 w-8 text-white" />
        <span className="ml-3 text-xl font-medium tracking-tight text-white">
          PromptWall
        </span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-5 flex-1 space-y-1 px-4">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white",
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-white",
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse mr-2" />
          <span className="text-xs text-muted-foreground font-medium">All systems operational</span>
        </div>
      </div>
    </div>
  );
}
