// REST + WebSocket client for the VeritasCore backend.
//
// In local dev VITE_API_BASE is unset and requests use same-origin relative URLs
// that Vite proxies to the backend (WebSocket included). In docker the frontend
// is given VITE_API_BASE and talks to the backend directly.

import type { AuditCertificate, AuditEvent } from "../types";

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE ?? "";

export interface StartAuditBody {
  target_url: string;
  model_name: string;
  api_key?: string;
}

export async function startAudit(body: StartAuditBody): Promise<{ audit_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/audit/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`startAudit failed: ${res.status}`);
  return res.json();
}

export async function getStatus(auditId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/audit/${auditId}/status`);
  if (!res.ok) throw new Error(`getStatus failed: ${res.status}`);
  return res.json();
}

export async function getCertificate(
  auditId: string
): Promise<{ certificate: AuditCertificate; verified: boolean }> {
  const res = await fetch(`${API_BASE}/certificate/${auditId}`);
  if (!res.ok) throw new Error(`getCertificate failed: ${res.status}`);
  return res.json();
}

export function certificateDownloadUrl(auditId: string): string {
  return `${API_BASE}/certificate/${auditId}/download`;
}

export function certificatePdfUrl(auditId: string): string {
  return `${API_BASE}/certificate/${auditId}/pdf`;
}

export function wsUrl(auditId: string): string {
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws") + `/ws/audit/${auditId}`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/audit/${auditId}`;
}

export function connectAuditStream(
  auditId: string,
  onEvent: (e: AuditEvent) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(wsUrl(auditId));
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as AuditEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => onClose?.();
  return ws;
}
