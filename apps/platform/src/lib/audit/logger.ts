import { getDb } from "@/lib/db/index";

export interface AuditEvent {
  actor: string;
  role: string;
  action: string;
  resource: string;
  status: "OK" | "DENIED" | "ERROR";
  detail?: Record<string, unknown>;
  ip?: string;
}

export function auditLog(event: AuditEvent): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (actor, role, action, resource, status, detail, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        event.actor,
        event.role,
        event.action,
        event.resource,
        event.status,
        event.detail ? JSON.stringify(event.detail) : null,
        event.ip ?? null
      );
  } catch (err) {
    console.error("[auditLog] Failed to record audit log entry:", err);
  }
}
