"use client";

import { useState } from "react";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { useWallet } from "@/hooks/useWalletConnect";

type Role = "investor" | "issuer";

type UserJourneyProps = {
  hasAssets: boolean;
  onTokenize: () => void;
};

const journeys: Record<Role, { label: string; intro: string; steps: Array<{ title: string; description: string }> }> = {
  investor: {
    label: "Investor",
    intro: "Discover a tokenized property, complete the required eligibility checks, and track your testnet position.",
    steps: [
      { title: "Connect", description: "Connect an EVM or Hedera testnet wallet from the header." },
      { title: "Choose an asset", description: "Open an instrument from the active asset catalog." },
      { title: "Complete eligibility", description: "Register your wallet and complete the checks required by that instrument." },
      { title: "Request allocation", description: "Submit a token request, then monitor the resulting balance and yield stream." },
    ],
  },
  issuer: {
    label: "Issuer",
    intro: "Verify a property address, authorize deployment, and create a fractional instrument on testnet.",
    steps: [
      { title: "Connect", description: "Connect the operator wallet authorized for this testnet deployment." },
      { title: "Verify property", description: "Run the x402 address validation before creating an instrument." },
      { title: "Create instrument", description: "Set the property details, fractional supply, and testnet compliance controls." },
      { title: "Manage distribution", description: "Open the asset workspace to manage holders, requests, and yield operations." },
    ],
  },
};

export default function UserJourney({ hasAssets, onTokenize }: UserJourneyProps) {
  const [role, setRole] = useState<Role>("investor");
  const evm = useEvmWallet();
  const hedera = useWallet();
  const connected = Boolean(evm.accountId || hedera.accountId);
  const journey = journeys[role];

  const goToCatalog = () => document.getElementById("instruments")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section aria-labelledby="journey-title" className="border border-black bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-5 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Getting started</p>
          <h2 id="journey-title" className="mt-2 text-2xl font-bold tracking-tight">A clear path from wallet to workspace</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{journey.intro}</p>
        </div>
        <div className="inline-flex w-full border border-black p-1 sm:w-auto" role="tablist" aria-label="Choose your journey">
          {(Object.keys(journeys) as Role[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={role === item}
              onClick={() => setRole(item)}
              className={`flex-1 px-4 py-2 text-xs font-bold transition-colors sm:flex-none ${role === item ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"}`}
            >
              {journeys[item].label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-4">
        {journey.steps.map((step, index) => (
          <li key={step.title} className="border border-neutral-300 p-4">
            <span className="inline-flex h-6 w-6 items-center justify-center border border-black text-xs font-bold">{index + 1}</span>
            <h3 className="mt-5 text-sm font-bold">{step.title}</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-600">{step.description}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-600">
          {connected ? "Wallet connected. Continue with the next step for your selected journey." : "Connect a testnet wallet from the header to begin."}
        </p>
        <div className="flex flex-wrap gap-2">
          {role === "issuer" ? (
            <button type="button" onClick={onTokenize} className="border border-black bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800">
              Verify and tokenize property
            </button>
          ) : (
            <button type="button" onClick={goToCatalog} className="border border-black bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800">
              {hasAssets ? "Browse available assets" : "No assets available yet"}
            </button>
          )}
          {role === "issuer" && hasAssets && (
            <button type="button" onClick={goToCatalog} className="border border-neutral-400 bg-white px-4 py-2 text-xs font-bold text-black hover:border-black">
              Open asset workspace
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
