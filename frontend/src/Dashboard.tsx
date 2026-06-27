import { useNavigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import AgentTimeline from "./components/AgentTimeline";
import ProbeStream from "./components/ProbeStream";
import BiasRadar from "./components/BiasRadar";
import ComplianceMatrix from "./components/ComplianceMatrix";
import CertificateViewer from "./components/CertificateViewer";
import { AuditStreamProvider, useAuditState } from "./context/AuditStreamContext";
import type { ConnectionStatus } from "./hooks/useAuditStream";

const CONNECTION_COPY: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: "Connecting", color: "var(--warn)" },
  live: { label: "Live · WebSocket", color: "var(--pass)" },
  reconnecting: { label: "Reconnecting", color: "var(--warn)" },
  closed: { label: "Stream closed", color: "var(--fail)" },
  complete: { label: "Audit complete", color: "var(--accent)" },
};

function StatusBar({ auditId }: { auditId: string }) {
  const navigate = useNavigate();
  const s = useAuditState();
  const conn = CONNECTION_COPY[s.connection];
  const findings = s.probes.filter((p) => !p.passed).length;

  return (
    <div className="px-6 py-3 flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
      <div className="flex items-center gap-5" role="status" aria-live="polite">
        <span>
          <span aria-hidden="true" style={{ color: conn.color }}>●</span> {conn.label}
        </span>
        <span>Probes <span className="accent">{s.probes.length}</span></span>
        <span>Findings <span style={{ color: findings ? "var(--fail)" : "var(--muted)" }}>{findings}</span></span>
        <span className="hidden sm:inline">Audit <span style={{ color: "var(--text)" }}>{auditId}</span></span>
      </div>
      <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => navigate("/")}>
        New audit
      </button>
    </div>
  );
}

function DashboardInner({ auditId }: { auditId: string }) {
  return (
    <>
      <Header subtitle={`Audit ${auditId}`} />
      <StatusBar auditId={auditId} />
      <main className="grid grid-cols-12 gap-4 px-6 pb-8">
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <AgentTimeline />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ProbeStream />
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <BiasRadar />
          <ComplianceMatrix />
        </div>
      </main>
      <CertificateViewer auditId={auditId} />
    </>
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
