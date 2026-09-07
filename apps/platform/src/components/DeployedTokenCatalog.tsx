"use client";

import { useState } from "react";
import Link from "next/link";
import type { TokenRecord } from "@/types";
import { InvestorStreamDashboard } from "./InvestorStreamDashboard";
import { RentSimulatorPanel } from "./RentSimulatorPanel";
import { PropertyTokenizeModal } from "./PropertyTokenizeModal";
import { TheGraphInspectorModal } from "./TheGraphInspectorModal";

const ASSET_CATEGORY_LABELS: Record<NonNullable<TokenRecord["assetCategory"]>, string> = {
  securities: "Securities",
  "real-estate": "Real estate",
  invoices: "Invoices",
  "carbon-credits": "Carbon credits",
  commodities: "Commodities",
  other: "Tokenized asset",
};

export default function DeployedTokenCatalog({ tokens }: { tokens: TokenRecord[] }) {
  const [isTokenizeOpen, setIsTokenizeOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-16">
        
        {/* 1. Hero Section (Ad402 Exact Layout) */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-border bg-secondary text-xs font-mono text-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Hedera x402 · The Graph · Superfluid CFA</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-mono font-bold text-foreground mb-6 tracking-tight">
            LiquidityStream-402
          </h1>
          <p className="text-lg sm:text-xl font-mono text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            The future of decentralized real-estate yield streaming. Autonomous agents discover property oracles, pay per query via Hedera x402, index ownership on The Graph, and stream rental cashflow per-second with Superfluid CFA.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="bg-primary text-primary-foreground px-8 py-3.5 hover:bg-primary/90 transition-colors font-mono font-bold cursor-pointer"
            >
              Tokenize Property (x402)
            </button>
            <button
              onClick={() => setIsGraphOpen(true)}
              className="bg-background text-foreground px-8 py-3.5 border border-border hover:bg-secondary transition-colors font-mono font-semibold cursor-pointer"
            >
              The Graph AI Inspector
            </button>
            <a
              href="#instruments"
              className="bg-background text-foreground px-8 py-3.5 border border-border hover:bg-secondary transition-colors font-mono font-semibold text-center"
            >
              Publisher Dashboard
            </a>
          </div>
        </div>

        {/* 2. 3 Slot Cards (Ad402 Exact Slot Grid Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          
          {/* Slot 1: Live Yield Stream */}
          <div className="bg-card p-6 border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-card-foreground">Yield Stream Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 font-mono">
                  Superfluid CFA
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Continuous cashflow streaming at +$0.00162037/sec on Base Sepolia.
              </p>
              <div className="ad402-slot mb-4">
                <InvestorStreamDashboard
                  propertyAddress="456 Oak Avenue, Miami FL 33101"
                  monthlyRent={3800}
                  sharePercentage={10.0}
                  initialBalance={14.8251}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between pt-2 border-t border-border">
              <span>Wrapped Token:</span>
              <span className="text-foreground font-bold">fUSDCx (Super Token)</span>
            </div>
          </div>

          {/* Slot 2: Tenant Payment Simulator */}
          <div className="bg-card p-6 border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-card-foreground">Tenant Payment Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  Rent Inflow
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                Simulate tenant rent deposit ($3,800) converting into yield streams.
              </p>
              <div className="ad402-slot mb-4">
                <RentSimulatorPanel
                  propertyId="prop_456_oak_ave"
                  defaultRentAmount={3800}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between pt-2 border-t border-border">
              <span>Payout Rail:</span>
              <span className="text-foreground font-bold">Hedera Scheduled Tx</span>
            </div>
          </div>

          {/* Slot 3: Hedera x402 Oracle */}
          <div className="bg-card p-6 border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-mono font-semibold text-card-foreground">x402 Verification Slot</h3>
                <span className="text-[11px] px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                  Hedera 0.5 HBAR
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-4">
                USPS physical address validation with unforgeable HCS audit receipt.
              </p>
              <div className="ad402-slot mb-4 font-mono text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Endpoint:</span>
                  <span className="text-foreground truncate max-w-[170px]">/api/x402/property-oracle</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Status Gate:</span>
                  <span className="text-emerald-400 font-bold">HTTP 402 → 200 OK</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">USPS DPV:</span>
                  <span className="text-foreground font-semibold">Code Y (Deliverable)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">HCS Topic:</span>
                  <a
                    href="https://hashscan.io/testnet"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-bold"
                  >
                    0.0.567812 ↗
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="w-full bg-secondary text-secondary-foreground py-2.5 text-xs font-mono font-bold border border-border hover:bg-secondary/80 transition cursor-pointer"
            >
              Inspect x402 Handshake
            </button>
          </div>
        </div>

        {/* 3. Key Features (Ad402 Exact 3-Column Layout with Icons) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="bg-secondary w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border">
              <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-foreground">Instant Payments</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              Publishers receive payments instantly using the Hedera x402 protocol. No waiting periods or complex withdrawal processes.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-secondary w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border">
              <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-foreground">No Intermediaries</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              Direct connection between property owners and investors. Lower fees, more transparency, and continuous Superfluid cashflows.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-secondary w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border">
              <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-mono font-semibold mb-2 text-foreground">Real-time Analytics</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              The Graph indexes token transfers and holder distributions in real-time. Query live blockchain data through dual MCP servers.
            </p>
          </div>
        </div>

        {/* 4. How It Works (Ad402 Exact 4-Step Numbered Box) */}
        <div className="bg-card border border-border shadow-sm p-8 mb-16">
          <h2 className="text-3xl font-mono font-bold text-center mb-8 text-card-foreground">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                1
              </div>
              <h3 className="font-mono font-semibold mb-2 text-foreground">Register Slots</h3>
              <p className="text-muted-foreground text-sm font-mono leading-relaxed">
                Publishers and agents verify addresses via x402, paying 0.5 HBAR on Hedera testnet.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                2
              </div>
              <h3 className="font-mono font-semibold mb-2 text-foreground">Browse & Select</h3>
              <p className="text-muted-foreground text-sm font-mono leading-relaxed">
                Investors browse tokenized properties, verify identity via World ID, and acquire fractional shares.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                3
              </div>
              <h3 className="font-mono font-semibold mb-2 text-foreground">Pay & Place</h3>
              <p className="text-muted-foreground text-sm font-mono leading-relaxed">
                The Graph indexes shareholder distributions, enabling automated proportional flow rates.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-mono font-bold">
                4
              </div>
              <h3 className="font-mono font-semibold mb-2 text-foreground">Go Live</h3>
              <p className="text-muted-foreground text-sm font-mono leading-relaxed">
                Rental yield streams live every second into investor wallets via Superfluid CFA on Base Sepolia.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Ready to Get Started? (Ad402 Exact Primary Call-to-Action) */}
        <div className="text-center bg-primary text-primary-foreground p-12 border border-border mb-16">
          <h2 className="text-3xl font-mono font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 font-mono opacity-90">
            Join the decentralized real-estate yield revolution today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setIsTokenizeOpen(true)}
              className="bg-background text-foreground px-8 py-3 hover:bg-secondary transition-colors font-mono border border-border font-bold cursor-pointer"
            >
              Try Demo (Tokenize)
            </button>
            <button
              onClick={() => setIsGraphOpen(true)}
              className="bg-secondary text-secondary-foreground px-8 py-3 hover:bg-secondary/80 transition-colors font-mono border border-border font-bold cursor-pointer"
            >
              Start Publishing
            </button>
          </div>
        </div>

        {/* 6. Real-Estate Instruments Catalog (Ad402 Style Card Grid) */}
        <div id="instruments" className="mb-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div>
              <p className="text-xs uppercase font-bold text-primary tracking-wider">Live Registry</p>
              <h2 className="text-2xl font-mono font-bold text-foreground">Available Real-Estate Instruments</h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Synced by Hermes
            </span>
          </div>

          {tokens.length === 0 ? (
            <div className="bg-card border border-border p-12 text-center">
              <p className="font-mono text-muted-foreground">No property tokens deployed yet. Use the Hermes operator to tokenize.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tokens.map((token) => {
                const assetType = token.assetCategory
                  ? ASSET_CATEGORY_LABELS[token.assetCategory]
                  : "Real estate";

                return (
                  <Link
                    key={token.id}
                    href={`/tokens/${token.id}`}
                    className="bg-card border border-border p-6 hover:border-primary transition-colors flex flex-col justify-between block group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold px-2 py-1 bg-secondary text-foreground border border-border">
                          {token.symbol}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {token.blockchain === "EVM" ? "Sepolia" : "Hedera"}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-mono text-foreground mb-1 group-hover:text-primary transition-colors">
                        {token.name}
                      </h3>
                      <p className="text-xs font-mono text-muted-foreground mb-4 line-clamp-2">
                        {token.memo || `Fractional real-estate asset on ${token.blockchain}.`}
                      </p>

                      <div className="space-y-2 text-xs font-mono border-t border-border pt-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Token ID:</span>
                          <span className="font-semibold text-foreground truncate max-w-[160px]">{token.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supply:</span>
                          <span className="text-foreground">{token.initialSupply} shares</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="text-foreground">{assetType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-primary font-bold">
                      <span>View Instrument</span>
                      <span>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <PropertyTokenizeModal
          isOpen={isTokenizeOpen}
          onClose={() => setIsTokenizeOpen(false)}
        />

        <TheGraphInspectorModal
          isOpen={isGraphOpen}
          onClose={() => setIsGraphOpen(false)}
        />

      </div>
    </div>
  );
}
