import { useNavigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import AgentTimeline from "./components/AgentTimeline";
import ProbeStream from "./components/ProbeStream";
import BiasRadar from "./components/BiasRadar";
import ComplianceMatrix from "./components/ComplianceMatrix";
import CertificateViewer from "./components/CertificateViewer";
import { AuditStreamProvider, useAuditState } from "./context/AuditStreamContext";
import type { ConnectionStatus } from "./hooks/useAuditStream";

const CONNECTION_COPY: Record<ConnectionStatus, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-warning" },
  live: { label: "Live · WS", dot: "bg-success" },
  reconnecting: { label: "Reconnecting", dot: "bg-warning" },
  closed: { label: "Stream closed", dot: "bg-danger" },
  complete: { label: "Complete", dot: "bg-accent" },
};

function NavStatus() {
  const navigate = useNavigate();
  const s = useAuditState();
  const conn = CONNECTION_COPY[s.connection];
  const findings = s.probes.filter((p) => !p.passed).length;

  return (
    <div className="flex items-center gap-4 font-mono text-2xs uppercase" role="status" aria-live="polite">
      <span className="flex items-center gap-2 text-muted">
        <span className={`w-2 h-2 ${conn.dot}`} aria-hidden="true" /> {conn.label}
      </span>
      <span className="text-muted hidden sm:inline">
        Probes <span className="text-accent">{s.probes.length}</span>
      </span>
      <span className="text-muted hidden sm:inline">
        Findings <span className={findings ? "text-danger" : "text-muted"}>{findings}</span>
      </span>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="border border-border px-3 py-1 text-muted hover:text-accent hover:border-accent"
      >
        New audit
      </button>
    </div>
  );
}

function DashboardInner({ auditId }: { auditId: string }) {
  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden bg-bg text-text">
      <Header subtitle={`Audit ${auditId}`} right={<NavStatus />} />
      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">
        {/* Left sidebar — agent pipeline */}
        <aside
          className="lg:w-[240px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface lg:overflow-y-auto focus:outline-none"
          tabIndex={0}
          aria-label="Agent pipeline"
        >
          <AgentTimeline />
        </aside>
        {/* Main — live probe feed */}
        <main className="flex-1 min-w-0 flex flex-col lg:overflow-hidden min-h-[460px]">
          <ProbeStream />
        </main>
        {/* Right telemetry — bias + compliance */}
        <aside
          className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface lg:overflow-y-auto focus:outline-none"
          tabIndex={0}
          aria-label="Audit telemetry"
        >
          <BiasRadar />
          <ComplianceMatrix />
        </aside>
      </div>
      <CertificateViewer auditId={auditId} />
    </div>
  );
}

export default function Dashboard() {
  const { id } = useParams();
  if (!id) return null;
  return (
    <AuditStreamProvider auditId={id}>
      <DashboardInner auditId={id} />
    </AuditStreamProvider>
  );
}
