import { useEffect, useRef, useState } from "react";
import { connectAuditStream, getCertificate } from "../api/client";
import type {
  AdversarialUpdateEvent,
  AuditCertificate,
  AuditEvent,
  ComplianceFinding,
  CompleteEvent,
  InfoEvent,
  Phase,
  ProbeResultEvent,
} from "../types";

export const PHASES: Phase[] = [
  "triage",
  "bias",
  "adversarial",
  "drift",
  "compliance",
  "meta",
  "certificate",
];

export type PhaseStatus = "waiting" | "running" | "done";
export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "closed" | "complete";

const MAX_RECONNECTS = 5;

export interface AuditStreamState {
  connection: ConnectionStatus;
  phase: Phase;
  probes: ProbeResultEvent[];
  biasScores: Record<string, number>;
  adversarial?: AdversarialUpdateEvent;
  driftScore?: number;
  compliance: ComplianceFinding[];
  infos: InfoEvent[];
  complete?: CompleteEvent;
  certificate?: AuditCertificate;
  verified?: boolean;
}

const INITIAL: AuditStreamState = {
  connection: "connecting",
  phase: "init",
  probes: [],
  biasScores: {},
  compliance: [],
  infos: [],
};

export function phaseStatus(phase: Phase, current: Phase, isComplete: boolean): PhaseStatus {
  if (isComplete) return "done";
  const ci = PHASES.indexOf(current);
  const pi = PHASES.indexOf(phase);
  if (ci < 0) return "waiting";
  if (pi < ci) return "done";
  if (pi === ci) return "running";
  return "waiting";
}

export function useAuditStream(auditId: string | undefined): AuditStreamState {
  const [state, setState] = useState<AuditStreamState>(INITIAL);
  // de-dupe across reconnects: the backend replays full history on resubscribe
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auditId) return;
    setState(INITIAL);
    seen.current = new Set();

    let cancelled = false;
    let attempts = 0;
    let finished = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: AuditEvent) => {
      // De-dupe append-only events here (NOT inside the setState updater): the
      // updater must stay pure, since React StrictMode replays it and a replayed
      // ref mutation would drop every event after the first.
      if (e.type === "probe_result") {
        const key = `p:${e.probe_id}@${e.timestamp}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
      } else if (e.type === "info") {
        const key = `i:${e.timestamp}:${e.message}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
      } else if (e.type === "complete") {
        finished = true;
        if (e.certificate_id) {
          getCertificate(e.certificate_id)
            .then((r) => setState((s) => ({ ...s, certificate: r.certificate, verified: r.verified })))
            .catch(() => undefined);
        }
      }
      setState((prev) => {
        const next = { ...prev };
        switch (e.type) {
          case "phase_change":
            next.phase = e.to;
            break;
          case "probe_result":
            next.probes = [...prev.probes, e];
            break;
          case "bias_update":
            next.biasScores = e.scores;
            break;
          case "adversarial_update":
            next.adversarial = e;
            break;
          case "drift_update":
            next.driftScore = e.drift_score;
            break;
          case "compliance_update":
            next.compliance = e.findings;
            break;
          case "info":
            next.infos = [...prev.infos, e];
            break;
          case "complete":
            next.complete = e;
            next.phase = "complete";
            next.connection = "complete";
            break;
        }
        return next;
      });
    };

    const onClose = () => {
      if (cancelled || finished) return;
      if (attempts < MAX_RECONNECTS) {
        attempts += 1;
        setState((s) => ({ ...s, connection: "reconnecting" }));
        retry = setTimeout(open, 1000);
      } else {
        setState((s) => ({ ...s, connection: "closed" }));
      }
    };

    function open() {
      if (cancelled) return;
      ws = connectAuditStream(auditId!, handle, onClose);
      ws.onopen = () =>
        setState((s) => ({ ...s, connection: s.complete ? "complete" : "live" }));
    }

    open();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [auditId]);

  return state;
}
