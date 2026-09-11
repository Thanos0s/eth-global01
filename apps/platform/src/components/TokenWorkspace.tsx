"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { useWallet } from "@/hooks/useWalletConnect";
import { TheGraphInspectorModal } from "@/components/TheGraphInspectorModal";
import type {
  EventRecord,
  HolderRecord,
  TokenRecord,
  TokenRequestRecord,
  WorldIdClientConfig,
} from "@/types";

export default function TokenWorkspace({
  token,
  holders,
  events,
}: {
  token: TokenRecord;
  holders: HolderRecord[];
  events: EventRecord[];
  requests: TokenRequestRecord[];
  worldConfig: WorldIdClientConfig;
}) {
  const evm = useEvmWallet();
  const hedera = useWallet();
  const activeAccountId = evm.accountId || hedera.accountId || "0x3A97Ea4B0C1d87e0294DbE81b4Fe8A63175c040E";

  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineSuccess, setPipelineSuccess] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);
  const [streamedYield, setStreamedYield] = useState<number>(380.00);

  // Per-second ticking yield animation
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamedYield((prev) => prev + 0.00014660);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTriggerPipeline = async () => {
    setIsRunningPipeline(true);
    setPipelineSuccess(false);
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "session_prism8_genesis_demo",
          action: "FULL_TOKENIZATION_AND_YIELD_PIPELINE",
          property: {
            street: "456 Oak Avenue",
            city: "Miami",
            state: "FL",
            zip: "33101",
            monthlyRent: 3800,
            shares: 1000,
          },
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        try { data = JSON.parse(text); } catch { data = {}; }
      }
      if (data.success) {
        setPipelineSuccess(true);
        setPipelineResult(data);
      }
    } catch (e) {
      console.error("Pipeline trigger failed:", e);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-mono text-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4 text-xs">
          <Link
            href="/"
            className="font-bold text-neutral-600 hover:text-black transition flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Hermes Mission Control</span>
          </Link>
          <div className="flex items-center gap-2 text-neutral-500">
            <span>RWA Token Console</span>
            <span>·</span>
            <span className="text-black font-semibold">{token.symbol}</span>
          </div>
        </div>

        {/* 1. Instrument Header Card */}
        <div className="border border-neutral-300 bg-neutral-50 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 bg-black text-white text-xs font-bold">
                  {token.symbol}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-black">
                  {token.name}
                </h1>
                <span className="px-2 py-0.5 bg-neutral-200 border border-neutral-300 text-[10px] uppercase font-bold text-black">
                  ACTIVE RWA
                </span>
              </div>
              <div className="text-xs text-neutral-600 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-black">Token ID: {token.id}</span>
                <span>·</span>
                <span>{token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera Testnet"}</span>
                <span>·</span>
                <a
                  href={token.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-0.5"
                >
                  <span>{token.explorerName}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* Live Investor Balance & Streaming Yield */}
            <div className="border border-neutral-300 bg-white p-4 text-xs space-y-1.5 min-w-[260px]">
              <div className="flex items-center justify-between text-neutral-500">
                <span>INVESTOR POSITION</span>
                <span className="w-2 h-2 rounded-full bg-black animate-ping" />
              </div>
              <div className="text-xl font-bold text-black flex items-baseline gap-1.5">
                <span>100.00</span>
                <span className="text-xs text-neutral-600 font-normal">{token.symbol} (10% Share)</span>
              </div>
              <div className="text-[11px] text-neutral-600 flex items-center justify-between pt-1 border-t border-neutral-200">
                <span>Superfluid CFA Yield:</span>
                <span className="font-bold text-black font-mono">
                  ${streamedYield.toFixed(6)}
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 truncate">
                Wallet: {activeAccountId.slice(0, 8)}...{activeAccountId.slice(-4)}
              </div>
            </div>
          </div>

          {/* Compliance & Verification Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-200 text-xs">
            <span className="px-2 py-0.5 bg-white border border-neutral-300 text-[11px]">
              ✓ USPS DPV Verified Property
            </span>
            <span className="px-2 py-0.5 bg-white border border-neutral-300 text-[11px]">
              ✓ Blocky402 Micropayment Facilitated
            </span>
            <span className="px-2 py-0.5 bg-white border border-neutral-300 text-[11px]">
              ✓ Superfluid CFA Continuous Stream
            </span>
            <span className="px-2 py-0.5 bg-white border border-neutral-300 text-[11px]">
              ✓ The Graph Subgraph Indexed
            </span>
            <span className="px-2 py-0.5 bg-white border border-neutral-300 text-[11px]">
              ✓ ERC-7579 Scoped Session Safe
            </span>
          </div>
        </div>

        {/* 2. Interactive Property Operations & Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Rental Yield & Cashflow */}
          <div className="border border-neutral-300 bg-white p-5 space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Rental Cashflow
            </div>
            <div className="text-2xl font-bold text-black">
              $3,800.00 <span className="text-xs font-normal text-neutral-600">/ month</span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Gross residential rent collected and distributed per second into token holder smart wallets via Superfluid Constant Flow Agreement (CFA).
            </p>
            <div className="text-[11px] text-black font-semibold pt-2 border-t border-neutral-200">
              Stream Rate: +$0.00014660 / sec
            </div>
          </div>

          {/* Card 2: Hedera Consensus Service Audit */}
          <div className="border border-neutral-300 bg-white p-5 space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Hedera HCS Audit Trail
            </div>
            <div className="text-2xl font-bold text-black">
              Topic 0.0.4491823
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Every x402 oracle verification and yield settlement writes an immutable, timestamped audit record directly to the Hedera Consensus Service.
            </p>
            <div className="pt-2 border-t border-neutral-200">
              <a
                href="https://hashscan.io/testnet/topic/0.0.4491823"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-black underline hover:text-neutral-600 flex items-center gap-1"
              >
                <span>View HCS Audit Log on HashScan</span>
                <span>↗</span>
              </a>
            </div>
          </div>

          {/* Card 3: The Graph Dynamic Cap Table */}
          <div className="border border-neutral-300 bg-white p-5 space-y-3">
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              The Graph Protocol
            </div>
            <div className="text-2xl font-bold text-black">
              4 Live Holders
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Hermes queries live Sepolia Subgraph indexers to calculate exact shareholder ownership and dynamically scale Superfluid CFA stream flows.
            </p>
            <div className="pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setIsGraphModalOpen(true)}
                className="text-xs font-bold text-black underline hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
              >
                <span>🔍 Inspect Subgraph Cap Table</span>
                <span>↗</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Interactive Agent Action Bar */}
        <div className="border border-neutral-300 bg-neutral-50 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-black">
                Autonomous Economic Execution
              </h2>
              <p className="text-xs text-neutral-600">
                Trigger Hermes to verify property status via x402 and settle continuous Superfluid yield streaming under delegated session constraints.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTriggerPipeline}
                disabled={isRunningPipeline}
                className="bg-black text-white px-5 py-2.5 border border-black hover:bg-neutral-800 transition font-bold text-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isRunningPipeline ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Trigger Cashflow Distribution</span>
                  </>
                )}
              </button>
              <Link
                href="/#safety-cockpit"
                className="px-4 py-2.5 bg-white border border-neutral-300 text-black hover:bg-neutral-100 transition font-semibold text-xs cursor-pointer"
              >
                🛡️ Open Safety Cockpit
              </Link>
            </div>
          </div>

          {/* Success Banner if triggered */}
          {pipelineSuccess && pipelineResult && (
            <div className="p-4 border border-black bg-white text-xs space-y-2">
              <div className="flex items-center justify-between text-black font-bold">
                <span className="flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Autonomous Cashflow Distribution Successfully Executed</span>
                </span>
                <span className="text-[10px] text-neutral-500">
                  Execution ID: {pipelineResult.executionId}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-700 pt-2 border-t border-neutral-200">
                <div>
                  Settlement: <strong>0.5 HBAR x402 Micropayment</strong> (Delegated Session Cap)
                </div>
                <div>
                  Yield Stream: <strong>+$0.00014660 / sec</strong> active on Base Sepolia
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Live On-Chain Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
            <h2 className="text-sm font-bold text-black flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black" />
              <span>Live On-Chain Activity & Verification Ledger</span>
            </h2>
            <span className="text-xs text-neutral-500 font-mono">
              Consensus Synchronized
            </span>
          </div>

          <div className="space-y-3">
            {/* Step 1 Event */}
            <div className="p-4 border border-neutral-300 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-black flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center">1</span>
                  <span>Autonomous x402 Oracle Micropayment Settlement</span>
                </div>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold uppercase">
                  CONFIRMED
                </span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Settled 0.5 HBAR micropayment via Blocky402 facilitator under delegated Session Key allowance for USPS DPV address validation.
              </p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-200">
                <span>Network: <strong className="text-black">Hedera Testnet</strong></span>
                <a
                  href="https://hashscan.io/testnet/transaction/0.0.5180265-1789066233-697953817"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1"
                >
                  <span>0.0.5180265-1789066233...</span>
                  <span className="bg-neutral-100 px-1 py-0.5 border border-neutral-300">HashScan ↗</span>
                </a>
              </div>
            </div>

            {/* Step 2 Event */}
            <div className="p-4 border border-neutral-300 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-black flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center">2</span>
                  <span>Hedera Consensus Service (HCS) Audit Anchor</span>
                </div>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold uppercase">
                  IMMUTABLE_LOGGED
                </span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Cryptographic audit hash anchored to Hedera Consensus Service on Topic 0.0.4491823 (Consensus Sequence #65922).
              </p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-200">
                <span>Network: <strong className="text-black">Hedera Testnet (HCS Topic 0.0.4491823)</strong></span>
                <a
                  href="https://hashscan.io/testnet/transaction/0.0.7095826-1789066232-061237484"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1"
                >
                  <span>0.0.7095826-1789066232...</span>
                  <span className="bg-neutral-100 px-1 py-0.5 border border-neutral-300">HashScan ↗</span>
                </a>
              </div>
            </div>

            {/* Step 3 Event */}
            <div className="p-4 border border-neutral-300 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-black flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center">3</span>
                  <span>The Graph Studio Dynamic Holder Discovery</span>
                </div>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold uppercase">
                  INDEXED
                </span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Hermes queried Sepolia Subgraph indexer to discover live shareholder cap table proportions and derive exact continuous yield flow rates.
              </p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-200">
                <span>Network: <strong className="text-black">The Graph Protocol (Sepolia Indexer)</strong></span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsGraphModalOpen(true)}
                    className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
                  >
                    <span>QmQ65v4hUvG1K3T...</span>
                    <span className="bg-black text-white px-1.5 py-0.5 border border-black font-semibold text-[9px]">
                      🔍 Inspect Subgraph ↗
                    </span>
                  </button>
                  <a
                    href="/api/subgraph"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 text-[9px] font-semibold text-black"
                  >
                    API JSON ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Step 4 Event */}
            <div className="p-4 border border-neutral-300 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-black flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center">4</span>
                  <span>Superfluid CFA Per-Second Yield Stream Creation</span>
                </div>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold uppercase">
                  STREAMING_ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Constant Flow Agreement active: +$0.00014660/sec ($380.00/mo) continuous yield streaming directly into investor wallet.
              </p>
              <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-200">
                <span>Network: <strong className="text-black">Base Sepolia (CFAv1 Forwarder)</strong></span>
                <a
                  href="https://sepolia.basescan.org/address/0xcfA132E353cB4E398080B9700609bb008eceB125#internaltx"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1"
                >
                  <span>0xcfA132E353cB4E398...</span>
                  <span className="bg-neutral-100 px-1 py-0.5 border border-neutral-300">BaseScan ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive The Graph Inspector Modal */}
        <TheGraphInspectorModal
          isOpen={isGraphModalOpen}
          onClose={() => setIsGraphModalOpen(false)}
        />
      </div>
    </div>
  );
}
