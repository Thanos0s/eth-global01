export const DEMO_BANNER = "⚠️ Simulated — not on-chain";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
}

export function assertNotDemo(): void {
  if (isDemoMode()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ApiError } = require("@/lib/api/helpers");
    throw new ApiError("This operation is disabled in demo mode. Configure live credentials.", 503);
  }
}
