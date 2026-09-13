import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/api/rateLimit";

describe("Rate Limiting Guard", () => {
  it("permits requests within the defined threshold", () => {
    const ip = "192.168.1.100";
    expect(() => checkRateLimit(ip, 5)).not.toThrow();
    expect(() => checkRateLimit(ip, 5)).not.toThrow();
    expect(() => checkRateLimit(ip, 5)).not.toThrow();
  });

  it("throws ApiError 429 when rate limit is exceeded", () => {
    const ip = "192.168.1.101";
    // Consume 3 allowed requests
    checkRateLimit(ip, 3);
    checkRateLimit(ip, 3);
    checkRateLimit(ip, 3);

    // 4th request must throw 429
    expect(() => checkRateLimit(ip, 3)).toThrow("Too many requests");
  });
});
