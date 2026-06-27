import { ShieldCheck } from "lucide-react";

export default function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <ShieldCheck size={22} className="accent" aria-hidden="true" />
      <div>
        <div className="text-[15px] font-extrabold tracking-[0.16em] display">
          VERITAS<span className="accent">CORE</span>
        </div>
        <div className="text-[10px]" style={{ color: "var(--muted)" }}>
          {subtitle ?? "Autonomous AI behavioral auditing"}
        </div>
      </div>
    </header>
  );
}
