import { isDemoMode } from "@/lib/demo";

export interface SubgraphHolderAllocation {
  address: string;
  balance: string;
  formattedBalance: string;
  shareFraction: number;
  sharePercentage: string;
  monthlyYieldUsd: number;
  flowRatePerSec: number;
  sentCount: string;
  receivedCount: string;
}

export interface SubgraphMetaInfo {
  deployment: string;
  block: {
    number: number;
    timestamp?: number;
    hash?: string;
  } | null;
  hasIndexingErrors: boolean;
  synced: boolean;
}

export interface SubgraphProvenance {
  subgraphUrl: string;
  deploymentId: string;
  indexedBlockNumber: number;
  indexedBlockTimestamp?: number;
  queryTimestamp: string;
  hasIndexingErrors: boolean;
  tokenAddress: string;
  totalEligibleBalance: string;
  holderCount: number;
}

export interface SubgraphAllocationResult {
  tokenAddress: string;
  totalEligibleBalance: string;
  monthlyRentUsd: number;
  totalMonthlyAllocatedUsd: number;
  totalFlowRatePerSec: number;
  holders: SubgraphHolderAllocation[];
  primaryInvestor: SubgraphHolderAllocation;
  meta: SubgraphMetaInfo;
  provenance: SubgraphProvenance;
  _demo: boolean;
}

export class GraphConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphConfigError";
  }
}

export class GraphIndexingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphIndexingError";
  }
}

export class GraphStalenessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphStalenessError";
  }
}

export class GraphDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphDataError";
  }
}

export function getSubgraphUrl(): string | undefined {
  return process.env.SUBGRAPH_URL?.trim() || undefined;
}

export function isGraphConfigured(): boolean {
  const url = getSubgraphUrl();
  return Boolean(url && url.startsWith("http"));
}

export async function queryLiveGraph(
  query: string,
  variables?: Record<string, unknown>,
  customUrl?: string
): Promise<Record<string, unknown>> {
  const url = customUrl || getSubgraphUrl();

  if (!url) {
    throw new GraphConfigError(
      "SUBGRAPH_URL is not configured. Live The Graph queries require a valid Graph Studio endpoint (e.g. https://api.studio.thegraph.com/query/<id>/<name>/version/latest)."
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Subgraph HTTP ${res.status}: ${errorText}`);
  }

  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    const msgs = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Subgraph GraphQL query error: ${msgs}`);
  }

  if (!json.data) {
    throw new Error("Subgraph response contained no data.");
  }

  return json.data;
}

const SECONDS_PER_MONTH = 2592000; // 30 days * 24h * 60m * 60s

export async function getLiveShareholderAllocation(options?: {
  tokenAddress?: string;
  monthlyRentUsd?: number;
  maxStalenessSeconds?: number;
  customUrl?: string;
  allowFallback?: boolean;
}): Promise<SubgraphAllocationResult> {
  const isDemo = isDemoMode() || Boolean(options?.allowFallback);
  const configuredUrl = options?.customUrl || getSubgraphUrl();
  const isLive = Boolean(configuredUrl && configuredUrl.startsWith("http"));
  const monthlyRent = options?.monthlyRentUsd ?? 3800;
  const defaultMaxStaleness = process.env.SUBGRAPH_MAX_STALENESS_SECONDS
    ? parseInt(process.env.SUBGRAPH_MAX_STALENESS_SECONDS, 10)
    : 31536000; // 365 days default to support testnet and syncing indexers
  const maxStaleness = options?.maxStalenessSeconds ?? defaultMaxStaleness;
  const targetToken = (
    options?.tokenAddress ||
    process.env.PROPERTY_TOKEN_ADDRESS ||
    "0x10279e6333f9d0ee103f4715b8aaea75be61464c"
  ).toLowerCase();
  const queryTimestamp = new Date().toISOString();

  // 1. In non-demo mode, fail closed if live Graph endpoint is not configured
  if (!isLive && !isDemo) {
    throw new GraphConfigError(
      "SUBGRAPH_URL is not configured. Production mode requires a live The Graph Studio endpoint. Local fallback is disabled outside DEMO_MODE."
    );
  }

  // 2. If in DEMO_MODE and no live endpoint configured, return structurally isolated simulated dataset
  if (!isLive && isDemo) {
    const demoHolders: SubgraphHolderAllocation[] = [
      {
        address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        balance: "400000000000000000000",
        formattedBalance: "400.00",
        shareFraction: 0.4,
        sharePercentage: "40.00%",
        monthlyYieldUsd: (monthlyRent * 0.4),
        flowRatePerSec: (monthlyRent * 0.4) / SECONDS_PER_MONTH,
        sentCount: "1",
        receivedCount: "3",
      },
      {
        address: "0x28a8746e75304c0780E011BEd21C72cd78cd535E",
        balance: "350000000000000000000",
        formattedBalance: "350.00",
        shareFraction: 0.35,
        sharePercentage: "35.00%",
        monthlyYieldUsd: (monthlyRent * 0.35),
        flowRatePerSec: (monthlyRent * 0.35) / SECONDS_PER_MONTH,
        sentCount: "0",
        receivedCount: "2",
      },
      {
        address: "0x3A97b1206489C853a836A2286bBf228FD0Dd040E",
        balance: "250000000000000000000",
        formattedBalance: "250.00",
        shareFraction: 0.25,
        sharePercentage: "25.00%",
        monthlyYieldUsd: (monthlyRent * 0.25),
        flowRatePerSec: (monthlyRent * 0.25) / SECONDS_PER_MONTH,
        sentCount: "0",
        receivedCount: "1",
      },
    ];

    const demoMeta: SubgraphMetaInfo = {
      deployment: "QmDemoSubgraphStudioDeploymentHash1234567890",
      block: {
        number: 11350480,
        timestamp: Math.floor(Date.now() / 1000) - 120,
      },
      hasIndexingErrors: false,
      synced: true,
    };

    return {
      tokenAddress: targetToken,
      totalEligibleBalance: "1000000000000000000000",
      monthlyRentUsd: monthlyRent,
      totalMonthlyAllocatedUsd: monthlyRent,
      totalFlowRatePerSec: monthlyRent / SECONDS_PER_MONTH,
      holders: demoHolders,
      primaryInvestor: demoHolders[0],
      meta: demoMeta,
      provenance: {
        subgraphUrl: "simulated://graph-studio-demo/liquiditystream-rwa",
        deploymentId: demoMeta.deployment,
        indexedBlockNumber: demoMeta.block!.number,
        indexedBlockTimestamp: demoMeta.block!.timestamp,
        queryTimestamp,
        hasIndexingErrors: false,
        tokenAddress: targetToken,
        totalEligibleBalance: "1000000000000000000000",
        holderCount: demoHolders.length,
      },
      _demo: true,
    };
  }

  // 3. Live Graph Studio Execution Path
  const graphQuery = `
    query GetTokenHoldersAndMeta($tokenAddress: String!) {
      _meta {
        deployment
        hasIndexingErrors
        block {
          number
          timestamp
          hash
        }
      }
      tokens(where: { id: $tokenAddress }) {
        id
        name
        symbol
        decimals
        transferCount
      }
      accounts(
        first: 50
        orderBy: balance
        orderDirection: desc
        where: { token: $tokenAddress }
      ) {
        address
        balance
        sentCount
        receivedCount
      }
      transfers(
        first: 10
        orderBy: blockTimestamp
        orderDirection: desc
        where: { token: $tokenAddress }
      ) {
        id
        from { address }
        to { address }
        value
        blockTimestamp
        transactionHash
      }
    }
  `;

  const data = await queryLiveGraph(graphQuery, { tokenAddress: targetToken }, configuredUrl);

  const rawMeta = data._meta as {
    deployment?: string;
    hasIndexingErrors?: boolean;
    block?: { number?: number; timestamp?: number; hash?: string };
  } | undefined;

  if (!rawMeta) {
    throw new GraphDataError("Subgraph response missing _meta indexing metadata.");
  }

  const meta: SubgraphMetaInfo = {
    deployment: rawMeta.deployment || "unknown-deployment",
    block: rawMeta.block
      ? {
          number: Number(rawMeta.block.number || 0),
          timestamp: rawMeta.block.timestamp ? Number(rawMeta.block.timestamp) : undefined,
          hash: rawMeta.block.hash,
        }
      : null,
    hasIndexingErrors: Boolean(rawMeta.hasIndexingErrors),
    synced: !rawMeta.hasIndexingErrors,
  };

  // Enforce Indexing Health Invariant
  if (meta.hasIndexingErrors) {
    throw new GraphIndexingError(
      `Subgraph deployment '${meta.deployment}' is reporting indexing errors on The Graph Network. Downstream yield allocation halted.`
    );
  }

  // Enforce Data Freshness Invariant
  if (meta.block?.timestamp) {
    const ageSeconds = Math.floor(Date.now() / 1000) - meta.block.timestamp;
    if (ageSeconds > maxStaleness) {
      throw new GraphStalenessError(
        `Subgraph indexed block timestamp (${meta.block.timestamp}) is ${ageSeconds}s old (max allowed: ${maxStaleness}s). Downstream allocation halted due to stale data.`
      );
    }
  }

  const rawAccounts = (data.accounts as Array<{
    address: string;
    balance: string;
    sentCount?: string;
    receivedCount?: string;
  }>) || [];

  if (rawAccounts.length === 0) {
    throw new GraphDataError(
      `No indexed token holders returned by Subgraph for token contract ${targetToken}.`
    );
  }

  // Calculate total eligible balance
  let totalBalanceBigInt = BigInt(0);
  for (const acc of rawAccounts) {
    try {
      const b = BigInt(acc.balance || "0");
      if (b > BigInt(0)) {
        totalBalanceBigInt += b;
      }
    } catch {
      // ignore parse err
    }
  }

  if (totalBalanceBigInt === BigInt(0)) {
    throw new GraphDataError(
      `Total eligible token balance across indexed holders is zero for token ${targetToken}. Cannot derive proportional cashflow allocation.`
    );
  }

  const totalBalanceNum = Number(totalBalanceBigInt);

  // Derive per-holder allocation weights and per-second CFA yield stream rates
  const holders: SubgraphHolderAllocation[] = rawAccounts
    .filter((acc) => {
      try {
        return BigInt(acc.balance || "0") > BigInt(0);
      } catch {
        return false;
      }
    })
    .map((acc) => {
      const balanceBigInt = BigInt(acc.balance);
      const balanceNum = Number(balanceBigInt);
      const shareFraction = balanceNum / totalBalanceNum;
      const sharePercentage = `${(shareFraction * 100).toFixed(2)}%`;
      const monthlyYieldUsd = monthlyRent * shareFraction;
      const flowRatePerSec = monthlyYieldUsd / SECONDS_PER_MONTH;

      // Format balance assuming 18 decimals or 0 decimals
      let formattedBalance = acc.balance;
      if (balanceBigInt > BigInt(1e12)) {
        formattedBalance = (balanceNum / 1e18).toFixed(2);
      }

      return {
        address: acc.address,
        balance: acc.balance,
        formattedBalance,
        shareFraction,
        sharePercentage,
        monthlyYieldUsd,
        flowRatePerSec,
        sentCount: String(acc.sentCount || "0"),
        receivedCount: String(acc.receivedCount || "0"),
      };
    });

  if (holders.length === 0) {
    throw new GraphDataError(`No active holders with non-zero balances found for token ${targetToken}.`);
  }

  const totalMonthlyAllocatedUsd = holders.reduce((sum, h) => sum + h.monthlyYieldUsd, 0);
  const totalFlowRatePerSec = totalMonthlyAllocatedUsd / SECONDS_PER_MONTH;

  const provenance: SubgraphProvenance = {
    subgraphUrl: configuredUrl!,
    deploymentId: meta.deployment,
    indexedBlockNumber: meta.block?.number || 0,
    indexedBlockTimestamp: meta.block?.timestamp,
    queryTimestamp,
    hasIndexingErrors: meta.hasIndexingErrors,
    tokenAddress: targetToken,
    totalEligibleBalance: totalBalanceBigInt.toString(),
    holderCount: holders.length,
  };

  return {
    tokenAddress: targetToken,
    totalEligibleBalance: totalBalanceBigInt.toString(),
    monthlyRentUsd: monthlyRent,
    totalMonthlyAllocatedUsd,
    totalFlowRatePerSec,
    holders,
    primaryInvestor: holders[0],
    meta,
    provenance,
    _demo: false,
  };
}
