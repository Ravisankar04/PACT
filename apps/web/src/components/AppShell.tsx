"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/ConnectButton";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Overview" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/policies", label: "Policies" },
  { href: "/app/lab", label: "Agent Lab" },
  { href: "/app/marketplace", label: "Marketplace" },
  { href: "/app/escrows", label: "Escrows" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/reputation", label: "Reputation" },
  { href: "/app/investigate", label: "Investigations" },
  { href: "/explorer", label: "Explorer" },
  { href: "/app/developer", label: "Developer" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-pact-border bg-pact-panel/60 p-4 flex flex-col gap-6">
        <Link href="/" className="font-display text-xl tracking-tight">
          PACT
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/app" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-2 rounded-md transition-colors",
                  active ? "bg-white/5 text-pact-text" : "text-pact-muted hover:text-pact-text hover:bg-white/[0.03]",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto text-[11px] text-pact-muted mono">
          Authorization & settlement
          <br />
          for autonomous agents
        </div>
      </aside>
      <div className="min-w-0">
        <header className="h-14 border-b border-pact-border flex items-center justify-between px-6">
          <div className="text-sm text-pact-muted mono">protocol / accountability</div>
          <ConnectButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
