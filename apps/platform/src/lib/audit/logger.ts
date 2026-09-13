import { getDbAdapter } from "@/lib/db/index";

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
    getDbAdapter()
      .insertAuditLog(event)
      .catch((err) => {
        console.error("[auditLog] Failed to record audit log entry:", err);
      });
  } catch (err) {
    console.error("[auditLog] Failed to record audit log entry:", err);
  }
}
