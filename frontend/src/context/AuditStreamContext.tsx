import { createContext, useContext, type ReactNode } from "react";
import { useAuditStream, type AuditStreamState } from "../hooks/useAuditStream";

// One WebSocket per audit, opened once by the provider and shared by every
// panel (timeline, probe stream, radar, matrix, certificate) through context.
const AuditStreamContext = createContext<AuditStreamState | null>(null);

export function AuditStreamProvider({
  auditId,
  children,
}: {
  auditId: string;
  children: ReactNode;
}) {
  const state = useAuditStream(auditId);
  return <AuditStreamContext.Provider value={state}>{children}</AuditStreamContext.Provider>;
}

export function useAuditState(): AuditStreamState {
  const ctx = useContext(AuditStreamContext);
  if (!ctx) {
    throw new Error("useAuditState must be used within an AuditStreamProvider");
  }
  return ctx;
}
