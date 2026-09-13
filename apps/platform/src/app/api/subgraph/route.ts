import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo";
import {
  getSubgraphUrl,
  isGraphConfigured,
  queryLiveGraph,
  getLiveShareholderAllocation,
  GraphConfigError,
  GraphIndexingError,
  GraphStalenessError,
  GraphDataError,
} from "@/lib/subgraph/subgraphService";

export const dynamic = "force-dynamic";

interface SubgraphQueryBody {
  query?: string;
  variables?: Record<string, unknown>;
  action?: "top_holders" | "transfers" | "token_info" | "status" | "allocation";
  tokenAddress?: string;
  monthlyRentUsd?: number;
}

export async function GET() {
  const subgraphUrl = getSubgraphUrl();
  const isLive = isGraphConfigured();
  const isDemo = isDemoMode();

  // In production / non-demo mode without a configured live Subgraph endpoint, fail closed
  if (!isLive && !isDemo) {
    return NextResponse.json(
      {
        status: "unconfigured",
        isLive: false,
        mode: "unconfigured",
        error:
          "SUBGRAPH_URL is not configured. Live The Graph queries require a valid Graph Studio endpoint in production mode. Local data substitution is disabled outside DEMO_MODE.",
        schemaEntities: ["Token", "Account", "Transfer"],
        mcpTools: {
          read: [
            "get_token_info",
            "get_biggest_transfer",
            "get_top_holders",
            "get_recent_transfers",
            "get_account_balance",
            "get_latest_sepolia_block",
            "get_tracked_tokens",
            "get_deployment_status",
          ],
          write: ["add_token_source", "set_token_sources"],
        },
      },
      { status: 503 }
    );
  }

  try {
    const allocation = await getLiveShareholderAllocation();

    return NextResponse.json({
      status: "ok",
      subgraphUrl: subgraphUrl || (isDemo ? "simulated://graph-studio-demo/liquiditystream-rwa" : null),
      isLive,
      mode: isLive ? "live-studio" : "demonstration-mode",
      _demo: allocation._demo,
      meta: allocation.meta,
      provenance: allocation.provenance,
      schemaEntities: ["Token", "Account", "Transfer"],
      mcpTools: {
        read: [
          "get_token_info",
          "get_biggest_transfer",
          "get_top_holders",
          "get_recent_transfers",
          "get_account_balance",
          "get_latest_sepolia_block",
          "get_tracked_tokens",
          "get_deployment_status",
        ],
        write: ["add_token_source", "set_token_sources"],
      },
      data: {
        holders: allocation.holders,
        totalEligibleBalance: allocation.totalEligibleBalance,
        totalMonthlyAllocatedUsd: allocation.totalMonthlyAllocatedUsd,
        totalFlowRatePerSec: allocation.totalFlowRatePerSec,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        isLive,
        mode: isLive ? "live-studio" : isDemo ? "demonstration-mode" : "unconfigured",
        error: err.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const subgraphUrl = getSubgraphUrl();
  const isLive = isGraphConfigured();
  const isDemo = isDemoMode();

  try {
    const body: SubgraphQueryBody = await req.json();

    // 1. Direct custom GraphQL query proxy
    if (body.query) {
      if (!isLive && !isDemo) {
        return NextResponse.json(
          {
            error:
              "SUBGRAPH_URL is not configured. Live GraphQL proxy requires a valid endpoint in non-demo mode.",
          },
          { status: 503 }
        );
      }

      if (isLive) {
        const rawData = await queryLiveGraph(body.query, body.variables);
        return NextResponse.json({ data: rawData });
      }

      // If in DEMO_MODE, return simulated GraphQL query envelope
      const allocation = await getLiveShareholderAllocation({
        tokenAddress: body.tokenAddress,
        monthlyRentUsd: body.monthlyRentUsd,
      });

      return NextResponse.json({
        data: {
          accounts: allocation.holders,
          _meta: allocation.meta,
        },
        _demo: true,
      });
    }

    // 2. High-level action dispatch
    const allocation = await getLiveShareholderAllocation({
      tokenAddress: body.tokenAddress,
      monthlyRentUsd: body.monthlyRentUsd,
    });

    if (body.action === "allocation" || body.action === "top_holders") {
      return NextResponse.json({
        status: "ok",
        _demo: allocation._demo,
        data: {
          tokenAddress: allocation.tokenAddress,
          totalEligibleBalance: allocation.totalEligibleBalance,
          monthlyRentUsd: allocation.monthlyRentUsd,
          totalMonthlyAllocatedUsd: allocation.totalMonthlyAllocatedUsd,
          totalFlowRatePerSec: allocation.totalFlowRatePerSec,
          accounts: allocation.holders,
          primaryInvestor: allocation.primaryInvestor,
          _meta: allocation.meta,
          provenance: allocation.provenance,
        },
      });
    }

    return NextResponse.json({
      status: "ok",
      _demo: allocation._demo,
      data: allocation,
    });
  } catch (error: any) {
    let statusCode = 500;
    if (error instanceof GraphConfigError) statusCode = 503;
    if (error instanceof GraphIndexingError || error instanceof GraphStalenessError) statusCode = 502;
    if (error instanceof GraphDataError) statusCode = 400;

    return NextResponse.json(
      {
        error: error.message || "Failed to execute subgraph query",
        type: error.name || "Error",
      },
      { status: statusCode }
    );
  }
}
