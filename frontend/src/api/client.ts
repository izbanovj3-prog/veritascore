// REST + WebSocket client for the VeritasCore backend.
//
// Three modes:
//  * local dev   — VITE_API_BASE unset; same-origin relative URLs proxied by Vite.
//  * docker      — VITE_API_BASE points at the backend directly.
//  * demo (Pages)— VITE_DEMO_MODE=1; no backend exists, so the client replays a
//                  REAL recorded audit (real probe stream + the real signed
//                  certificate captured from an actual run) entirely in-browser.

import type { AuditCertificate, AuditEvent } from "../types";

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE ?? "";
const DEMO: boolean = (import.meta as any).env?.VITE_DEMO_MODE === "1";
const BASE_URL: string = (import.meta as any).env?.BASE_URL ?? "/";

export interface StartAuditBody {
  target_url: string;
  model_name: string;
  api_key?: string;
}

export interface StreamHandle {
  onopen: (() => void) | null;
  close: () => void;
}

export async function startAudit(body: StartAuditBody): Promise<{ audit_id: string; status: string }> {
  if (DEMO) return { audit_id: "demo", status: "started" };
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
  if (DEMO) {
    const res = await fetch(`${BASE_URL}demo/certificate.json`);
    return { certificate: (await res.json()) as AuditCertificate, verified: true };
  }
  const res = await fetch(`${API_BASE}/certificate/${auditId}`);
  if (!res.ok) throw new Error(`getCertificate failed: ${res.status}`);
  return res.json();
}

export function certificateDownloadUrl(auditId: string): string {
  if (DEMO) return `${BASE_URL}demo/certificate.json`;
  return `${API_BASE}/certificate/${auditId}/download`;
}

export function certificatePdfUrl(auditId: string): string {
  if (DEMO) return `${BASE_URL}demo/certificate.pdf`;
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
): StreamHandle {
  if (DEMO) return connectDemoStream(onEvent, onClose);

  const ws = new WebSocket(wsUrl(auditId));
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as AuditEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => onClose?.();
  return ws as unknown as StreamHandle;
}

// Replays the recorded audit (public/demo/recorded-audit.json) on its original
// schedule, so the GitHub Pages build behaves like a live audit with no backend.
function connectDemoStream(onEvent: (e: AuditEvent) => void, onClose?: () => void): StreamHandle {
  const timers: number[] = [];
  let closed = false;
  const handle: StreamHandle = {
    onopen: null,
    close() {
      closed = true;
      timers.forEach((t) => clearTimeout(t));
    },
  };

  fetch(`${BASE_URL}demo/recorded-audit.json`)
    .then((r) => r.json())
    .then((rec: { t: number; event: AuditEvent }[]) => {
      if (closed) return;
      handle.onopen?.();
      for (const item of rec) {
        timers.push(
          window.setTimeout(() => {
            if (!closed) onEvent(item.event);
          }, item.t + 350)
        );
      }
      const last = rec.length ? rec[rec.length - 1].t : 0;
      timers.push(
        window.setTimeout(() => {
          if (!closed) onClose?.();
        }, last + 700)
      );
    })
    .catch(() => onClose?.());

  return handle;
}
