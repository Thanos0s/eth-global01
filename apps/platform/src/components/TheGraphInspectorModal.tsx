"use client";

import { useState, useEffect } from "react";

interface TheGraphInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HolderData {
  address: string;
  formattedBalance: string;
  sharePercentage: string;
  monthlyYieldUsd: number;
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
  const [activeTab, setActiveTab] = useState<"query" | "mcp" | "architecture">("query");
  const [queryType, setQueryType] = useState<"holders" | "transfers" | "meta">("holders");
  const [loading, setLoading] = useState(false);
  const [subgraphData, setSubgraphData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, queryType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subgraph");
      const json = await res.json();
      setSubgraphData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-3xl border border-purple-500/30 bg-slate-950 p-6 sm:p-8 text-slate-100 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow Header Accent */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">The Graph AI Integration</h3>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">
                  Dual MCP + GraphQL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live Subgraph indexing real-estate tokens & fueling autonomous Superfluid cashflow distribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 mt-4 text-sm font-medium gap-2">
          <button
            onClick={() => setActiveTab("query")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "query"
                ? "border-b-2 border-purple-400 text-purple-300 bg-purple-500/5 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 Live GraphQL Query Runner
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "mcp"
                ? "border-b-2 border-purple-400 text-purple-300 bg-purple-500/5 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🤖 Subgraph MCP Tooling
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "architecture"
                ? "border-b-2 border-purple-400 text-purple-300 bg-purple-500/5 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🏆 Hackathon Track Alignment
          </button>
        </div>

        {/* Tab 1: Live GraphQL Query Runner */}
        {activeTab === "query" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Endpoint:</span>
                <span className="font-mono text-xs text-purple-300 truncate max-w-md">
                  {subgraphData?.subgraphUrl || "https://api.studio.thegraph.com/query/.../version/latest"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400 font-mono">
                  {subgraphData?.mode === "live-studio" ? "Studio Live" : "Indexed Simulation"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Quick Queries:</span>
              <button
                onClick={() => setQueryType("holders")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "holders"
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                    : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Top Token Holders (Yield Allocation)
              </button>
              <button
                onClick={() => setQueryType("transfers")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "transfers"
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                    : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Recent Transfers (Mints / Secondary)
              </button>
              <button
                onClick={() => setQueryType("meta")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  queryType === "meta"
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                    : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Subgraph Metadata (_meta)
              </button>
            </div>

            {/* Query Content Display */}
            {queryType === "holders" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
                    <span>Indexed Entities: `Account` & `Token`</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Auto-derived Flow Rates</span>
                  </div>
                  <div className="divide-y divide-slate-800/60 font-mono text-xs">
                    <div className="grid grid-cols-12 py-2 text-slate-500 font-bold uppercase text-[10px]">
                      <div className="col-span-6">Holder Address</div>
                      <div className="col-span-2 text-right">Balance</div>
                      <div className="col-span-2 text-right">Share</div>
                      <div className="col-span-2 text-right text-emerald-400">Yield/Mo</div>
                    </div>
                    {(subgraphData?.data?.holders || []).map((h: HolderData, i: number) => (
                      <div key={i} className="grid grid-cols-12 py-2.5 items-center hover:bg-slate-800/30 px-1 rounded-lg">
                        <div className="col-span-6 flex items-center gap-2 truncate text-slate-300">
                          <span className="text-purple-400">#{i + 1}</span>
                          <span className="truncate">{h.address}</span>
                        </div>
                        <div className="col-span-2 text-right text-slate-200">{h.formattedBalance}</div>
                        <div className="col-span-2 text-right text-indigo-300 font-semibold">{h.sharePercentage}</div>
                        <div className="col-span-2 text-right text-emerald-400 font-bold">
                          ${h.monthlyYieldUsd.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-400 bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/60">
                  💡 <strong className="text-slate-200">How Agent Uses This:</strong> The Hermes autonomous agent calls <code className="text-purple-300">subgraph_read.get_top_holders</code> to discover shareholder proportions and immediately opens or scales continuous Superfluid CFA cashflow streams in <code className="text-emerald-300">YieldVault.sol</code>.
                </p>
              </div>
            )}

            {queryType === "transfers" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 font-mono text-xs">
                <div className="divide-y divide-slate-800/60">
                  <div className="grid grid-cols-12 py-2 text-slate-500 font-bold uppercase text-[10px]">
                    <div className="col-span-3">Tx Hash</div>
                    <div className="col-span-4">From → To</div>
                    <div className="col-span-3 text-right">Amount</div>
                    <div className="col-span-2 text-right">Type</div>
                  </div>
                  {(subgraphData?.data?.recentTransfers || []).map((t: TransferData, i: number) => (
                    <div key={i} className="grid grid-cols-12 py-2.5 items-center hover:bg-slate-800/30 px-1 rounded-lg">
                      <div className="col-span-3 truncate text-purple-400">
                        {t.transactionHash.slice(0, 10)}...
                      </div>
                      <div className="col-span-4 text-slate-400 truncate text-[11px]">
                        {t.from.address.slice(0, 6)}... → {t.to.address.slice(0, 6)}...
                      </div>
                      <div className="col-span-3 text-right text-slate-200 font-semibold">{t.formattedValue}</div>
                      <div className="col-span-2 text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          t.isMintOrBurn
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {t.isMintOrBurn ? "Mint" : "Transfer"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {queryType === "meta" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 font-mono text-xs text-slate-300">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-purple-300">
{JSON.stringify(subgraphData?.meta || {}, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Subgraph MCP Tooling */}
        {activeTab === "mcp" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4">
              <h4 className="font-bold text-sm text-purple-300 mb-1">Official Model Context Protocol (MCP) Integration</h4>
              <p className="text-slate-300">
                Two dedicated MCP servers (<code className="text-purple-300">subgraph_read</code> and <code className="text-purple-300">subgraph_write</code>) built with <code className="text-slate-200">@modelcontextprotocol/sdk</code> allow any LLM (Hermes, Claude, Cursor, ChatGPT) to interact with The Graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-200">
                  <span className="text-emerald-400">📖</span>
                  <span>subgraph_read (Query Suite)</span>
                </div>
                <ul className="space-y-1.5 font-mono text-slate-400 text-[11px]">
                  <li>• <strong className="text-slate-200">get_token_info</strong>: Name, symbol, supply, tx count</li>
                  <li>• <strong className="text-slate-200">get_top_holders</strong>: Rank holders by balance</li>
                  <li>• <strong className="text-slate-200">get_recent_transfers</strong>: Filter transfers/mints</li>
                  <li>• <strong className="text-slate-200">get_account_balance</strong>: Live derived balance</li>
                  <li>• <strong className="text-slate-200">get_biggest_transfer</strong>: Largest whale movements</li>
                  <li>• <strong className="text-slate-200">get_deployment_status</strong>: Graph Studio IPFS hash</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-200">
                  <span className="text-amber-400">✍️</span>
                  <span>subgraph_write (Self-Deployment)</span>
                </div>
                <p className="text-slate-400 mb-2 text-[11px]">
                  Autonomous pipeline enabling the agent to reconfigure and redeploy Subgraphs on the fly:
                </p>
                <ul className="space-y-1.5 font-mono text-slate-400 text-[11px]">
                  <li>• <strong className="text-slate-200">add_token_source</strong>: Appends new RWA contract to <code className="text-purple-300">subgraph.yaml</code></li>
                  <li>• <strong className="text-slate-200">set_token_sources</strong>: Replaces tracked token registry</li>
                  <li>• Auto-triggers <code className="text-amber-300">graph codegen &amp;&amp; graph deploy</code> to Studio</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-slate-300 font-semibold mb-2">Natural Language Agent Query Example:</div>
              <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-slate-800">
                <span className="text-purple-400">&gt; User:</span> "Who owns the highest share in 456 Oak Avenue and how much yield did they earn this month?"<br />
                <span className="text-emerald-400">&gt; Hermes Agent:</span> Calling <code className="text-purple-300">subgraph_read.get_top_holders(tokenAddress: "0xf531...")</code>...<br />
                <span className="text-slate-300">&gt; Agent Response:</span> "The top holder is 0x742d... with 250 OAK-RWA tokens (25% share). Based on monthly rental collections of $3,800, their Superfluid CFA stream continuously accrues $950.00/month."
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Track Alignment */}
        {activeTab === "architecture" && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-slate-300">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <h4 className="font-bold text-sm text-emerald-300 mb-1">
                Aligned with The Graph Track: "One AI track, two ways to build"
              </h4>
              <p className="text-slate-300">
                LiquidityStream directly satisfies both halves of the track prompt + the featured x402 payment challenge.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <span className="font-bold text-purple-300 text-sm">Way 1: Tooling for AI Environments</span>
                <p className="mt-1 text-slate-400">
                  Built standard TypeScript Model Context Protocol (MCP) servers (<code className="text-purple-300">read.ts</code> and <code className="text-purple-300">write.ts</code>) enabling LLMs to run structured GraphQL queries, monitor indexing health, and autonomously mutate/redeploy Subgraph manifests without human developer intervention.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <span className="font-bold text-indigo-300 text-sm">Way 2: AI Agents Using Live Blockchain Data</span>
                <p className="mt-1 text-slate-400">
                  The Hermes autonomous asset manager consumes The Graph as its live source of truth to index real estate fractional tokens, determine shareholder proportions, verify tenant payments, and stream continuous per-second cashflows via Superfluid CFA.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <span className="font-bold text-amber-300 text-sm">Autonomous x402 Payment Challenge</span>
                <p className="mt-1 text-slate-400">
                  The Graph track prompt asks: <em>"or let your agent pay per query autonomously with x402."</em> LiquidityStream integrates the native Hedera x402 protocol, where the agent pays 0.5 HBAR per request autonomously with Blocky402 facilitator and HCS audit receipts, proving zero-subscription machine commerce.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Powered by:</span>
            <span className="font-semibold text-purple-300">The Graph</span>
            <span>·</span>
            <span className="font-semibold text-emerald-300">Superfluid</span>
            <span>·</span>
            <span className="font-semibold text-cyan-300">Hedera x402</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 font-medium text-white hover:bg-slate-700 transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
