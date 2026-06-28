import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export default function Header({ subtitle, right }: { subtitle?: string; right?: ReactNode }) {
  return (
    <header className="h-14 flex-shrink-0 border-b border-border bg-surface px-6 flex items-center justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <ShieldCheck size={20} className="text-accent shrink-0" aria-hidden="true" />
        <div className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
          Veritas<span className="text-accent">Core</span> Audit Suite
        </div>
        {subtitle && (
          <>
            <div className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="font-mono text-sm uppercase tracking-widest text-muted truncate">
              {subtitle}
            </span>
          </>
        )}
      </div>
      {right && <div className="flex items-center gap-4 shrink-0">{right}</div>}
    </header>
  );
}
