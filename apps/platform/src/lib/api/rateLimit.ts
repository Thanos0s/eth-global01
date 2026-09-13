interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

export function checkRateLimit(ip: string, limitPerMinute = 100): void {
  const now = Date.now();
  const current = windows.get(ip);

  if (!current || current.resetAt < now) {
    windows.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }

  current.count++;
  if (current.count > limitPerMinute) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ApiError } = require("@/lib/api/helpers");
    throw new ApiError("Too many requests. Rate limit exceeded.", 429);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
