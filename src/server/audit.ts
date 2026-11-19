import { insert, ready } from "./db";

export type AuditAction = "created" | "updated" | "deleted" | "login" | "logout" | "approved" | "rejected" | "status_changed";

export async function recordAudit(input: {
  actor?: string;
  action: AuditAction;
  module: string;
  title: string;
  description?: string;
  reference?: string;
  severity?: "info" | "success" | "warning" | "danger";
  /** Safe request context only: never include OTPs, passwords or Firebase tokens. */
  metadata?: Record<string, unknown>;
}) {
  await ready();
  return insert("auditLogs", {
    actor: input.actor ?? "admin",
    action: input.action,
    module: input.module,
    title: input.title,
    description: (input.description ?? "").slice(0, 500),
    reference: input.reference ?? "",
    severity: input.severity ?? (input.action === "deleted" || input.action === "rejected" ? "warning" : input.action === "created" || input.action === "approved" ? "success" : "info"),
    metadata: input.metadata ?? {},
    at: Date.now(),
  });
}
