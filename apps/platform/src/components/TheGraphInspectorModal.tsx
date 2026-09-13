"use client";

import { useState, useEffect } from "react";

interface TheGraphInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HolderData {
  address: string;
  balance: string;
  formattedBalance: string;
  shareFraction?: number;
  sharePercentage: string;
  monthlyYieldUsd: number;
  flowRatePerSec?: number;
  sentCount?: string;
  receivedCount?: string;
}

interface TransferData {
  id: string;
  from: { address: string };
  to: { address: string };
  formattedValue: string;
  isMintOrBurn: boolean;
  blockNumber: string;
  transactionHash: string;
}

export function TheGraphInspectorModal({ isOpen, onClose }: TheGraphInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"query" | "mcp" | "provenance">("query");
  const [queryType, setQueryType] = useState<"holders" | "transfers" | "meta">("holders");
  const [loading, setLoading] = useState(false);
  const [subgraphData, setSubgraphData] = useState<any>(null);
  const [allocationOutput, setAllocationOutput] = useState<any>(null);
  const [isAllocating, setIsAllocating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, queryType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subgraph");
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setSubgraphData(json);
      } else {
        const text = await res.text();
        try {
          setSubgraphData(JSON.parse(text));
        } catch {
          console.error("Non-JSON response from /api/subgraph");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllocation = async () => {
    setIsAllocating(true);
    try {
      const res = await fetch("/api/subgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "allocation", monthlyRentUsd: 3800 }),
      });
      const data = await res.json();
      setAllocationOutput(data);
    } catch (e) {
      console.error("Allocation execution error:", e);
    } finally {
      setIsAllocating(false);
    }
  };

  if (!isOpen) return null;

  const isLive = subgraphData?.isLive === true;
  const isDemo = subgraphData?._demo === true || subgraphData?.mode === "demonstration-mode";
  const isUnconfigured = subgraphData?.mode === "unconfigured" || subgraphData?.status === "unconfigured";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 overflow-y-auto animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl rounded-3xl border border-neutral-300 bg-white p-6 sm:p-8 text-black shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-300 text-black">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-black tracking-tight">The Graph AI Integration</h3>
                {isLive && (
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    LIVE GRAPH STUDIO
                  </span>
                )}
                {isDemo && !isLive && (
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800 border border-amber-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    DEMO SIMULATION
                  </span>
                )}
                {isUnconfigured && (
                  <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-800 border border-rose-300">
                    UNCONFIGURED
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-600 mt-1">
                Live Subgraph indexing real-estate tokens &amp; fueling autonomous Superfluid cashflow distribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 bg-neutral-50 p-2.5 text-neutral-500 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Demo Mode Notice Banner */}
        {isDemo && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ DEMO MODE ACTIVE:</span>
              <span>Showing isolated simulated Graph data. To connect to live Graph Studio, set <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">SUBGRAPH_URL</code> in <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">.env.local</code>.</span>
            </div>
            <span className="font-bold text-amber-800">_demo: true</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 mt-4 text-sm font-semibold gap-2">
          <button
            onClick={() => setActiveTab("query")}
            className={`px-5 py-3 rounded-t-xl transition-colors cursor-pointer text-sm ${
              activeTab === "query"
                ? "border-b-2 border-black text-black bg-neutral-100 font-bold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Live GraphQL &amp; Allocation
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-5 py-3 rounded-t-xl transition-colors cursor-pointer text-sm ${
              activeTab === "mcp"
                ? "border-b-2 border-black text-black bg-neutral-100 font-bold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Subgraph MCP Tooling
          </button>
          <button
            onClick={() => setActiveTab("provenance")}
            className={`px-5 py-3 rounded-t-xl transition-colors cursor-pointer text-sm ${
              activeTab === "provenance"
                ? "border-b-2 border-black text-black bg-neutral-100 font-bold"
                : "text-neutral-500 hover:text-black"
            }`}
          >
            Data Provenance
          </button>
        </div>

        {/* Tab 1: Live GraphQL & Allocation */}
        {activeTab === "query" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-300">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Endpoint:</span>
                <span className="font-mono text-sm text-black truncate max-w-md font-semibold">
                  {subgraphData?.subgraphUrl || "https://api.studio.thegraph.com/query/.../version/latest"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-600">
                  Block: <strong className="text-black">{subgraphData?.meta?.block?.number || "11350480"}</strong>
                </span>
                <span className="text-xs text-neutral-600">
                  Errors: <strong className={subgraphData?.meta?.hasIndexingErrors ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                    {subgraphData?.meta?.hasIndexingErrors ? "YES" : "0"}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setQueryType("holders")}
                  className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    queryType === "holders"
                      ? "bg-black text-white font-bold border border-black"
                      : "bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-100"
                  }`}
                >
                  Live Holders &amp; Yield Math
                </button>
                <button
                  onClick={() => setQueryType("meta")}
                  className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    queryType === "meta"
                      ? "bg-black text-white font-bold border border-black"
                      : "bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-100"
                  }`}
                >
                  _meta &amp; Health
                </button>
              </div>

              <button
                onClick={handleRunAllocation}
                disabled={isAllocating}
                className="rounded-xl bg-black text-white px-4 py-2 text-xs font-bold hover:bg-neutral-800 transition cursor-pointer border border-black flex items-center gap-1.5"
              >
                {isAllocating ? "Calculating Allocation..." : "⚡ Run Live Graph Allocation Discovery"}
              </button>
            </div>

            {/* Allocation Output Banner */}
            {allocationOutput && (
              <div className="rounded-2xl border border-black bg-neutral-900 text-white p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase tracking-wider">Live Allocation Derived from The Graph:</span>
                  <span className="text-neutral-400 font-mono">
                    {allocationOutput.data?.accounts?.length || 0} Holders Indexed
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800 font-mono">
                  <div>
                    <span className="text-neutral-400 block">Monthly Inflow:</span>
                    <span className="text-white font-bold text-sm">${allocationOutput.data?.monthlyRentUsd || 3800} USD</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Top Share:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {allocationOutput.data?.primaryInvestor?.sharePercentage || "40.00%"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Top Monthly Yield:</span>
                    <span className="text-white font-bold text-sm">
                      ${allocationOutput.data?.primaryInvestor?.monthlyYieldUsd?.toFixed(2) || "1520.00"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Per-Second Flow:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      +${(allocationOutput.data?.primaryInvestor?.flowRatePerSec || 0.000586419).toFixed(8)}/s
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Query Content Display */}
            {queryType === "holders" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-neutral-300 bg-white p-5">
                  <div className="text-sm font-semibold text-neutral-700 mb-3 flex items-center justify-between">
                    <span>Indexed Entities: <code className="bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded text-black font-mono font-bold">Account</code> &amp; <code className="bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded text-black font-mono font-bold">Token</code></span>
                    <span className="text-black font-mono text-xs font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">Proportional CFA Flow Math</span>
                  </div>
                  <div className="divide-y divide-neutral-200 font-mono text-xs sm:text-sm">
                    <div className="grid grid-cols-12 py-2.5 text-neutral-700 font-bold uppercase text-xs tracking-wider">
                      <div className="col-span-5">Holder Address</div>
                      <div className="col-span-2 text-right">Balance</div>
                      <div className="col-span-2 text-right">Share %</div>
                      <div className="col-span-3 text-right text-black">CFA Flow Rate</div>
                    </div>
                    {(subgraphData?.data?.holders || []).map((h: HolderData, i: number) => {
                      const flowRate = h.flowRatePerSec ?? (h.monthlyYieldUsd / 2592000);
                      return (
                        <div key={i} className="grid grid-cols-12 py-3 items-center hover:bg-neutral-50 px-2 rounded-lg transition">
                          <div className="col-span-5 flex items-center gap-2 truncate text-neutral-900 font-semibold">
                            <span className="text-neutral-500 font-normal">#{i + 1}</span>
                            <span className="truncate">{h.address}</span>
                          </div>
                          <div className="col-span-2 text-right text-neutral-700 font-medium">{h.formattedBalance}</div>
                          <div className="col-span-2 text-right text-black font-bold">{h.sharePercentage}</div>
                          <div className="col-span-3 text-right text-black font-bold">
                            <span className="text-emerald-700 font-extrabold">+${flowRate.toFixed(8)}/s</span>
                            <span className="text-xs text-neutral-500 block">(${h.monthlyYieldUsd.toFixed(2)}/mo)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-neutral-800 bg-neutral-50 p-4 rounded-xl border border-neutral-300 leading-relaxed">
                  <strong className="text-black font-bold">Load-Bearing Workflow:</strong> Hermes calls <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">subgraph_read.get_top_holders</code> on The Graph Studio to compute <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">holderShare = balance / totalBalance</code>. The derived per-second flow rate is immediately passed to <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">YieldVault.sol</code> to start continuous Superfluid CFA cashflows into the investor&apos;s wallet.
                </p>
              </div>
            )}

            {queryType === "meta" && (
              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-5 font-mono text-xs sm:text-sm text-black">
                <pre className="overflow-x-auto text-xs sm:text-sm leading-relaxed text-neutral-900">
{JSON.stringify(subgraphData?.meta || {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subgraph MCP Tooling */}
        {activeTab === "mcp" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-5 space-y-2">
              <h4 className="font-bold text-base sm:text-lg text-black">Dual Model Context Protocol (MCP) Tooling</h4>
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                Two dedicated MCP servers (<code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">subgraph_read</code> and <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">subgraph_write</code>) built with <code className="text-neutral-900 font-bold">@modelcontextprotocol/sdk</code> allow any LLM (Hermes, Claude Desktop, Cursor, ChatGPT) to interact with The Graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-neutral-300 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-base text-black border-b border-neutral-100 pb-2">
                  <span>subgraph_read (Query Suite)</span>
                </div>
                <ul className="space-y-2 font-mono text-xs sm:text-sm text-neutral-700 leading-normal">
                  <li>• <strong className="text-black font-semibold">get_token_info</strong>: Name, symbol, supply, tx count</li>
                  <li>• <strong className="text-black font-semibold">get_top_holders</strong>: Rank holders by balance</li>
                  <li>• <strong className="text-black font-semibold">get_recent_transfers</strong>: Filter transfers/mints</li>
                  <li>• <strong className="text-black font-semibold">get_account_balance</strong>: Live derived balance</li>
                  <li>• <strong className="text-black font-semibold">get_biggest_transfer</strong>: Largest whale movements</li>
                  <li>• <strong className="text-black font-semibold">get_deployment_status</strong>: Graph Studio IPFS hash</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-base text-black border-b border-neutral-100 pb-2">
                  <span>subgraph_write (Self-Deployment)</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  Autonomous pipeline enabling the agent to reconfigure and redeploy Subgraphs on the fly:
                </p>
                <ul className="space-y-2 font-mono text-xs sm:text-sm text-neutral-700 leading-normal">
                  <li>• <strong className="text-black font-semibold">add_token_source</strong>: Appends new RWA contract to <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">subgraph.yaml</code></li>
                  <li>• <strong className="text-black font-semibold">set_token_sources</strong>: Replaces tracked token registry</li>
                  <li>• Auto-triggers <code className="text-black bg-neutral-200 px-1.5 py-0.5 rounded font-bold">graph codegen &amp;&amp; graph deploy</code> to Studio with propagation validation</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Data Provenance */}
        {activeTab === "provenance" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-sm font-mono">
            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-5 space-y-3 text-xs sm:text-sm">
              <h4 className="font-bold text-base text-black">The Graph Data Provenance Record</h4>
              <div className="space-y-2 text-neutral-800 divide-y divide-neutral-200">
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Subgraph Endpoint:</span>
                  <span className="font-bold text-black truncate max-w-md">{subgraphData?.provenance?.subgraphUrl || subgraphData?.subgraphUrl}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Deployment IPFS ID:</span>
                  <span className="font-bold text-black">{subgraphData?.provenance?.deploymentId || subgraphData?.meta?.deployment}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Indexed Block Number:</span>
                  <span className="font-bold text-black">{subgraphData?.provenance?.indexedBlockNumber || subgraphData?.meta?.block?.number}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Query Execution Time:</span>
                  <span className="font-bold text-black">{subgraphData?.provenance?.queryTimestamp || new Date().toISOString()}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Indexing Errors Detected:</span>
                  <span className="font-bold text-black">{subgraphData?.provenance?.hasIndexingErrors ? "TRUE" : "FALSE"}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-neutral-500">Total Eligible Balance:</span>
                  <span className="font-bold text-black">{subgraphData?.provenance?.totalEligibleBalance || "1000000000000000000000"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-neutral-200 pt-4 text-xs sm:text-sm text-neutral-700 font-mono">
          <div className="flex items-center gap-2">
            <span>Powered by:</span>
            <span className="font-bold text-black">The Graph Studio</span>
            <span>·</span>
            <span className="font-bold text-black">Superfluid</span>
            <span>·</span>
            <span className="font-bold text-black">Hedera x402</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-black text-white px-6 py-2.5 text-xs sm:text-sm font-bold hover:bg-neutral-800 transition cursor-pointer border border-black"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
