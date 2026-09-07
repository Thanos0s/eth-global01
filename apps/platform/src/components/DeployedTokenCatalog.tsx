"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TokenRecord } from "@/types";
import { InvestorStreamDashboard } from "./InvestorStreamDashboard";
import { RentSimulatorPanel } from "./RentSimulatorPanel";
import { PropertyTokenizeModal } from "./PropertyTokenizeModal";

const ACCENTS = [
  {
    chip: "is-sage",
    mark: "is-sage",
  },
  {
    chip: "is-lemon",
    mark: "is-lemon",
  },
  {
    chip: "is-slate",
    mark: "is-slate",
  },
  {
    chip: "is-ink",
    mark: "is-ink",
  },
  {
    chip: "is-violet",
    mark: "is-violet",
  },
] as const;

const ASSET_CATEGORY_LABELS: Record<NonNullable<TokenRecord["assetCategory"]>, string> = {
  securities: "Securities",
  "real-estate": "Real estate",
  invoices: "Invoices",
  "carbon-credits": "Carbon credits",
  commodities: "Commodities",
  other: "Tokenized asset",
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 10h12m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function tokenControls(token: TokenRecord) {
  const controls: string[] = [];
  if (token.compliance.worldIdSelfieCheck) controls.push("Selfie Check");
  if (token.compliance.worldIdMinimumAge) {
    controls.push(`Age ${token.compliance.worldIdMinimumAge}+`);
  }
  if (token.compliance.worldIdNationality) {
    controls.push(`Nationality ${token.compliance.worldIdNationality}`);
  }
  if (
    token.compliance.worldIdRequired &&
    !token.compliance.worldIdSelfieCheck &&
    !token.compliance.worldIdMinimumAge &&
    !token.compliance.worldIdNationality
  ) {
    controls.push("World ID");
  }
  if (token.compliance.kycRequired) controls.push("KYC");
  if (token.compliance.livenessEnabled) controls.push("Liveness");
  if (token.compliance.freezeDefault) controls.push("Freeze");
  if (token.compliance.pauseEnabled) controls.push("Pausable");
  return controls;
}

export default function DeployedTokenCatalog({ tokens }: { tokens: TokenRecord[] }) {
  const [isTokenizeOpen, setIsTokenizeOpen] = useState(false);

  return (
    <>
      {/* LiquidityStream Specialized Real-Estate Yield Streaming Engine */}
      <section className="mb-12 rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-6 sm:p-8 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Hedera x402 + Superfluid CFA Architecture
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              LiquidityStream Engine
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Autonomous Real-Estate Yield Streaming Engine. Verifies physical deliverability with USPS via x402 machine-to-machine payments, tokenizes fractional shares on Hedera HTS, and streams rental cashflow per-second with Superfluid CFA on Base Sepolia.
            </p>
          </div>

          <button
            onClick={() => setIsTokenizeOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
          >
            <span className="text-base">🏢</span>
            <span>Tokenize Property (x402)</span>
          </button>
        </div>

        {/* Live Demo Dashboard Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <InvestorStreamDashboard
              propertyAddress="456 Oak Avenue, Miami FL 33101"
              monthlyRent={3800}
              sharePercentage={10.0}
              initialBalance={14.8251}
            />
          </div>
          <div>
            <RentSimulatorPanel
              propertyId="prop_456_oak_ave"
              defaultRentAmount={3800}
            />
          </div>
        </div>
      </section>

      <PropertyTokenizeModal
        isOpen={isTokenizeOpen}
        onClose={() => setIsTokenizeOpen(false)}
      />

      <div className="rwa-catalog-head is-page-start" id="instruments">
        <div>
          <p className="rwa-kicker">Live registry</p>
          <h2>Available tokens</h2>
        </div>
        <span className="rwa-no-payment">
          <span className="proof-live-dot" aria-hidden="true" />
          Synced by Hermes
        </span>
      </div>

      {tokens.length === 0 ? (
        <div className="mint-empty-state">
          <Image
            src="/brand/logo-512.png"
            alt=""
            width={72}
            height={72}
            aria-hidden="true"
          />
          <h3 className="text-xl font-semibold">No token deployed yet</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Ask Hermes to deploy one. It will appear here when the transaction is confirmed.
          </p>
        </div>
      ) : (
        <div className="rwa-grid">
          {tokens.map((token, index) => {
            const accent = ACCENTS[index % ACCENTS.length];
            const controls = tokenControls(token);
            const assetType = token.assetCategory
              ? ASSET_CATEGORY_LABELS[token.assetCategory]
              : "Tokenized asset";

            return (
              <Link
                key={token.id}
                href={`/tokens/${token.id}`}
                className="rwa-card group block"
                aria-label={`Open ${token.name} (${token.id})`}
              >
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rwa-symbol ${accent.mark}`}>{token.symbol}</div>
                    <span className="rwa-token-id">
                      {token.id}
                    </span>
                  </div>

                  <div className="mt-7">
                    <span className={`rwa-asset-chip ${accent.chip}`}>{assetType}</span>
                    <h3>{token.name}</h3>
                    <p className="rwa-description">
                      {token.memo || `A real-world asset token deployed on ${token.blockchain === "EVM" ? "Ethereum Sepolia" : "Hedera Token Service"}.`}
                    </p>
                  </div>

                  <dl className="rwa-meta">
                    <div>
                      <dt>Network</dt>
                      <dd>{token.blockchain === "EVM" ? "Sepolia" : "Hedera"}</dd>
                    </div>
                    <div>
                      <dt>Initial supply</dt>
                      <dd>{token.initialSupply}</dd>
                    </div>
                  </dl>

                  <div className="rwa-requirements">
                    <div className="flex items-center justify-between gap-3">
                      <span>Compliance controls</span>
                      <span className={controls.length ? "rwa-control-count" : "rwa-control-open"}>
                        {controls.length || "Open"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {controls.length ? (
                        controls.map((control) => (
                          <span className="rwa-condition" key={control}>
                            {control}
                          </span>
                        ))
                      ) : (
                        <span className="rwa-condition is-open">No access controls</span>
                      )}
                    </div>
                  </div>

                  <span className="rwa-card-action">
                    <span>View instrument</span>
                    <ArrowIcon />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
