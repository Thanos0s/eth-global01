import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  queryLiveGraph,
  getLiveShareholderAllocation,
  isGraphConfigured,
  getSubgraphUrl,
  GraphConfigError,
  GraphIndexingError,
  GraphStalenessError,
  GraphDataError,
} from "../lib/subgraph/subgraphService";
import { GET, POST } from "../app/api/subgraph/route";

describe("The Graph Integration & Shareholder Allocation Engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DEMO_MODE = "false";
    delete process.env.SUBGRAPH_URL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Configuration & Fail-Closed Invariants", () => {
    it("reports unconfigured when SUBGRAPH_URL is unset", () => {
      expect(isGraphConfigured()).toBe(false);
      expect(getSubgraphUrl()).toBeUndefined();
    });

    it("correctly identifies configured SUBGRAPH_URL", () => {
      process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest";
      expect(isGraphConfigured()).toBe(true);
      expect(getSubgraphUrl()).toBe("https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest");
    });

    it("fails closed in non-demo mode when SUBGRAPH_URL is missing", async () => {
      process.env.DEMO_MODE = "false";
      delete process.env.SUBGRAPH_URL;

      await expect(getLiveShareholderAllocation()).rejects.toThrow(GraphConfigError);
      await expect(getLiveShareholderAllocation()).rejects.toThrow(
        /SUBGRAPH_URL is not configured/
      );
    });

    it("fails closed on queryLiveGraph when SUBGRAPH_URL is missing", async () => {
      process.env.DEMO_MODE = "false";
      delete process.env.SUBGRAPH_URL;

      await expect(queryLiveGraph("{ _meta { deployment } }")).rejects.toThrow(GraphConfigError);
    });
  });

  describe("Demo Mode Fallback & Isolation", () => {
    it("returns isolated simulated allocation in DEMO_MODE without throwing", async () => {
      process.env.DEMO_MODE = "true";
      delete process.env.SUBGRAPH_URL;

      const res = await getLiveShareholderAllocation({ monthlyRentUsd: 3800 });
      expect(res._demo).toBe(true);
      expect(res.holders.length).toBe(3);
      expect(res.totalMonthlyAllocatedUsd).toBe(3800);
      expect(res.primaryInvestor.address).toBe("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
      expect(res.provenance.subgraphUrl).toMatch(/^simulated:\/\//);
      expect(res.provenance.holderCount).toBe(3);
    });
  });

  describe("Live Query Execution & Mathematical Solvency Invariants", () => {
    const mockLiveGraphResponse = {
      _meta: {
        deployment: "QmZ123TestDeploymentHashFromStudio",
        hasIndexingErrors: false,
        block: {
          number: 11420500,
          timestamp: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago (fresh)
          hash: "0xabcdef1234567890",
        },
      },
      tokens: [
        {
          id: "0x71c8401e25687352f20d235f8d7fd1a392cf99a8",
          name: "LiquidityStream Share Token",
          symbol: "LQS",
          decimals: 18,
          transferCount: 42,
        },
      ],
      accounts: [
        {
          address: "0x1111111111111111111111111111111111111111",
          balance: "600000000000000000000", // 60%
          sentCount: "1",
          receivedCount: "2",
        },
        {
          address: "0x2222222222222222222222222222222222222222",
          balance: "300000000000000000000", // 30%
          sentCount: "0",
          receivedCount: "1",
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          balance: "100000000000000000000", // 10%
          sentCount: "0",
          receivedCount: "1",
        },
      ],
      transfers: [],
    };

    beforeEach(() => {
      process.env.DEMO_MODE = "false";
      process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest";
    });

    it("fetches, parses, and derives exact proportional yield flow rates", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockLiveGraphResponse }),
      } as Response);

      const res = await getLiveShareholderAllocation({
        tokenAddress: "0x71c8401e25687352f20d235f8d7fd1a392cf99a8",
        monthlyRentUsd: 3800,
      });

      expect(res._demo).toBe(false);
      expect(res.holders.length).toBe(3);
      expect(res.totalEligibleBalance).toBe("1000000000000000000000");

      // Verify Holder 1 (60%)
      const h1 = res.holders[0];
      expect(h1.address).toBe("0x1111111111111111111111111111111111111111");
      expect(h1.shareFraction).toBeCloseTo(0.6, 5);
      expect(h1.sharePercentage).toBe("60.00%");
      expect(h1.monthlyYieldUsd).toBeCloseTo(2280, 2); // 3800 * 0.6
      expect(h1.flowRatePerSec).toBeCloseTo(2280 / 2592000, 8);

      // Verify Holder 2 (30%)
      const h2 = res.holders[1];
      expect(h2.address).toBe("0x2222222222222222222222222222222222222222");
      expect(h2.shareFraction).toBeCloseTo(0.3, 5);
      expect(h2.sharePercentage).toBe("30.00%");
      expect(h2.monthlyYieldUsd).toBeCloseTo(1140, 2); // 3800 * 0.3
      expect(h2.flowRatePerSec).toBeCloseTo(1140 / 2592000, 8);

      // Verify Holder 3 (10%)
      const h3 = res.holders[2];
      expect(h3.address).toBe("0x3333333333333333333333333333333333333333");
      expect(h3.shareFraction).toBeCloseTo(0.1, 5);
      expect(h3.sharePercentage).toBe("10.00%");
      expect(h3.monthlyYieldUsd).toBeCloseTo(380, 2); // 3800 * 0.1
      expect(h3.flowRatePerSec).toBeCloseTo(380 / 2592000, 8);

      // Solvency check: sum of yields equals monthly rent
      expect(res.totalMonthlyAllocatedUsd).toBeCloseTo(3800, 2);
      expect(res.totalFlowRatePerSec).toBeCloseTo(3800 / 2592000, 8);

      // Primary investor is holder 1
      expect(res.primaryInvestor.address).toBe("0x1111111111111111111111111111111111111111");

      // Provenance audit
      expect(res.provenance.deploymentId).toBe("QmZ123TestDeploymentHashFromStudio");
      expect(res.provenance.indexedBlockNumber).toBe(11420500);
      expect(res.provenance.hasIndexingErrors).toBe(false);
      expect(res.provenance.holderCount).toBe(3);
    });

    it("rejects with GraphIndexingError if subgraph reports indexing errors", async () => {
      const errorResponse = {
        _meta: {
          deployment: "QmZ123FailedDeployment",
          hasIndexingErrors: true,
          block: { number: 11420500, timestamp: Math.floor(Date.now() / 1000) - 10 },
        },
        accounts: [{ address: "0x111", balance: "100" }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: errorResponse }),
      } as Response);

      await expect(getLiveShareholderAllocation()).rejects.toThrow(GraphIndexingError);
      await expect(getLiveShareholderAllocation()).rejects.toThrow(/reporting indexing errors/);
    });

    it("rejects with GraphStalenessError if indexed block is older than maxStaleness", async () => {
      const staleResponse = {
        _meta: {
          deployment: "QmZ123StaleDeployment",
          hasIndexingErrors: false,
          block: {
            number: 10000000,
            timestamp: Math.floor(Date.now() / 1000) - 200000, // > 2 days old
          },
        },
        accounts: [{ address: "0x111", balance: "100" }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: staleResponse }),
      } as Response);

      await expect(getLiveShareholderAllocation({ maxStalenessSeconds: 86400 })).rejects.toThrow(
        GraphStalenessError
      );
      await expect(getLiveShareholderAllocation({ maxStalenessSeconds: 86400 })).rejects.toThrow(
        /stale data/
      );
    });

    it("rejects with GraphDataError if accounts array is empty", async () => {
      const emptyAccountsResponse = {
        _meta: {
          deployment: "QmZ123Valid",
          hasIndexingErrors: false,
          block: { number: 11420500, timestamp: Math.floor(Date.now() / 1000) - 10 },
        },
        accounts: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: emptyAccountsResponse }),
      } as Response);

      await expect(getLiveShareholderAllocation()).rejects.toThrow(GraphDataError);
      await expect(getLiveShareholderAllocation()).rejects.toThrow(/No indexed token holders/);
    });

    it("rejects with GraphDataError if total eligible balance is zero", async () => {
      const zeroBalanceResponse = {
        _meta: {
          deployment: "QmZ123Valid",
          hasIndexingErrors: false,
          block: { number: 11420500, timestamp: Math.floor(Date.now() / 1000) - 10 },
        },
        accounts: [
          { address: "0x111", balance: "0" },
          { address: "0x222", balance: "0" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: zeroBalanceResponse }),
      } as Response);

      await expect(getLiveShareholderAllocation()).rejects.toThrow(GraphDataError);
      await expect(getLiveShareholderAllocation()).rejects.toThrow(/Total eligible token balance across indexed holders is zero/);
    });

    it("handles GraphQL syntax/execution errors properly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [{ message: "Syntax error in GraphQL query" }],
        }),
      } as Response);

      await expect(queryLiveGraph("{ test }")).rejects.toThrow(/Subgraph GraphQL query error/);
    });

    it("handles HTTP 500/502 errors from Graph gateway properly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => "Bad Gateway",
      } as Response);

      await expect(queryLiveGraph("{ test }")).rejects.toThrow(/Subgraph HTTP 502/);
    });
  });

  describe("API Route Endpoints (/api/subgraph)", () => {
    it("GET returns 503 unconfigured in non-demo mode when SUBGRAPH_URL is missing", async () => {
      process.env.DEMO_MODE = "false";
      delete process.env.SUBGRAPH_URL;

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("unconfigured");
      expect(body.mode).toBe("unconfigured");
      expect(body.isLive).toBe(false);
      expect(body.mcpTools.read).toContain("get_top_holders");
      expect(body.mcpTools.write).toContain("add_token_source");
    });

    it("GET returns 200 with live allocation data when SUBGRAPH_URL is configured", async () => {
      process.env.DEMO_MODE = "false";
      process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest";

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            _meta: {
              deployment: "QmLiveStudioDep",
              hasIndexingErrors: false,
              block: { number: 11420500, timestamp: Math.floor(Date.now() / 1000) - 15 },
            },
            accounts: [{ address: "0xabc", balance: "1000" }],
          },
        }),
      } as Response);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.mode).toBe("live-studio");
      expect(body.isLive).toBe(true);
      expect(body.data.holders.length).toBe(1);
    });

    it("POST with action=allocation returns structured shareholder yield breakdown", async () => {
      process.env.DEMO_MODE = "false";
      process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest";

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            _meta: {
              deployment: "QmLiveStudioDep",
              hasIndexingErrors: false,
              block: { number: 11420500, timestamp: Math.floor(Date.now() / 1000) - 15 },
            },
            accounts: [
              { address: "0x111", balance: "500" },
              { address: "0x222", balance: "500" },
            ],
          },
        }),
      } as Response);

      const req = new Request("http://localhost:3000/api/subgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "allocation", monthlyRentUsd: 4000 }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.data.accounts.length).toBe(2);
      expect(body.data.totalMonthlyAllocatedUsd).toBe(4000);
    });

    it("POST with custom GraphQL query proxies directly to live endpoint", async () => {
      process.env.DEMO_MODE = "false";
      process.env.SUBGRAPH_URL = "https://api.studio.thegraph.com/query/12345/liquiditystream/version/latest";

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            tokens: [{ id: "0x123", name: "Custom Token" }],
          },
        }),
      } as Response);

      const req = new Request("http://localhost:3000/api/subgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ tokens { id name } }" }),
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.tokens[0].name).toBe("Custom Token");
    });
  });
});
