// Shared types mirroring the backend event + certificate payloads.

export type Phase =
  | "init"
  | "triage"
  | "bias"
  | "adversarial"
  | "drift"
  | "compliance"
  | "meta"
  | "certificate"
  | "complete";

export interface ProbeResultEvent {
  type: "probe_result";
  audit_id: string;
  probe_id: string;
  category: string;
  subcategory: string;
  severity: "low" | "medium" | "high" | "critical";
  passed: boolean;
  verdict: string | null;
  score: number;
  finding: string;
  synthetic: boolean;
  protected_attribute: string | null;
  gb_t_clause: string | null;
  eu_ai_act_article: string | null;
  prompt: string;
  response: string;
  timestamp: string;
}

export interface PhaseChangeEvent {
  type: "phase_change";
  audit_id: string;
  from: Phase;
  to: Phase;
  timestamp: string;
}

export interface InfoEvent {
  type: "info";
  audit_id: string;
  message: string;
  timestamp: string;
  synthesized?: number;
  effectiveness?: number;
  level?: string;
}

export interface BiasUpdateEvent {
  type: "bias_update";
  audit_id: string;
  scores: Record<string, number>;
}

export interface AdversarialUpdateEvent {
  type: "adversarial_update";
  audit_id: string;
  attack_success_rate: number;
  successful: number;
  partial: number;
  defended: number;
  vulnerable: string[];
}

export interface DriftUpdateEvent {
  type: "drift_update";
  audit_id: string;
  drift_score: number;
}

export interface ComplianceFinding {
  clause_key: string;
  gb_t_clause: string;
  eu_ai_act_article: string;
  severity: string;
  count: number;
  probe_ids: string[];
  description: string;
}

export interface ComplianceUpdateEvent {
  type: "compliance_update";
  audit_id: string;
  findings: ComplianceFinding[];
}

export interface CompleteEvent {
  type: "complete";
  audit_id: string;
  certificate_id: string | null;
  overall_score?: number;
  compliance_status?: string;
  public_key_fingerprint?: string;
  error?: string;
  timestamp: string;
}

export type AuditEvent =
  | ProbeResultEvent
  | PhaseChangeEvent
  | InfoEvent
  | BiasUpdateEvent
  | AdversarialUpdateEvent
  | DriftUpdateEvent
  | ComplianceUpdateEvent
  | CompleteEvent;

export interface FindingSummary {
  category: string;
  total: number;
  failed: number;
  critical: number;
}

export interface AuditCertificate {
  schema_version: string;
  audit_id: string;
  timestamp: string;
  target_model: string;
  target_url: string;
  overall_score: number;
  compliance_status: "PASS" | "FAIL" | "CONDITIONAL";
  bias_scores: Record<string, number>;
  adversarial_score: number;
  drift_score: number;
  total_probes: number;
  failed_probes: number;
  findings_summary: FindingSummary[];
  regulatory_violations: string[];
  algorithm: string;
  signature: string | null;
  public_key_pem: string | null;
  public_key_fingerprint: string | null;
}
