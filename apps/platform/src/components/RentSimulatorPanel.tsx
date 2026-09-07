"use client";

import React, { useState } from "react";

export interface RentSimulatorPanelProps {
  propertyId?: string;
  defaultRentAmount?: number;
  onDepositSuccess?: (amount: number, receipt: any) => void;
}

export function RentSimulatorPanel({
  propertyId = "prop_456_oak_ave",
  defaultRentAmount = 3800,
  onDepositSuccess,
}: RentSimulatorPanelProps) {
  const [rentAmount, setRentAmount] = useState<number>(defaultRentAmount);
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [depositResult, setDepositResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDepositRent = async () => {
    setIsDepositing(true);
    setError(null);

    try {
      const res = await fetch("/api/rent/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          amount: rentAmount,
          tenantName: "Acme Residential Tenant Corp",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Deposit simulation failed");
      }

      setDepositResult(data);
      if (onDepositSuccess) {
        onDepositSuccess(rentAmount, data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to trigger rent deposit");
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-white shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Hackathon Demo Tool
          </span>
          <h4 className="text-base font-bold text-slate-100">Simulate Tenant Rent Payment</h4>
        </div>
        <span className="rounded-full bg-teal-950 px-2.5 py-1 text-[11px] font-mono text-teal-300 border border-teal-800/50">
          x402 + HCS Connected
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Simulates an incoming ACH/fiat rental payment converting into stablecoins. Injects funds into the
        Base Sepolia YieldVault reserve, triggers Superfluid CFA stream acceleration, and logs an immutable consensus proof on Hedera.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[140px]">
          <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-sm">$</span>
          <input
            type="number"
            value={rentAmount}
            onChange={(e) => setRentAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-7 pr-3 py-2 text-sm font-mono text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            placeholder="3800"
          />
        </div>

        <button
          onClick={handleDepositRent}
          disabled={isDepositing || rentAmount <= 0}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {isDepositing ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              Processing Rent Inflow...
            </>
          ) : (
            <>Trigger Tenant Rent Deposit</>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300">
          {error}
        </div>
      )}

      {depositResult && (
        <div className="mt-4 rounded-xl bg-slate-950 p-3.5 border border-teal-500/30 text-xs text-slate-300 space-y-2 animate-fade-in font-mono">
          <div className="flex items-center justify-between text-teal-400 font-semibold text-sm">
            <span>✓ ${depositResult.amountDeposited?.toLocaleString()} Deposited</span>
            <span className="text-[11px] text-slate-400">Flow Rate Active</span>
          </div>

          <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <div>
              <span className="block text-slate-500">Hedera HCS Proof</span>
              <a
                href={depositResult.hcsAudit?.hashscanUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-teal-300 hover:underline truncate block"
              >
                Seq #{depositResult.hcsAudit?.sequenceNumber || "83527"} ↗
              </a>
            </div>
            <div>
              <span className="block text-slate-500">Superfluid Flow</span>
              <span className="text-emerald-400">
                +${(depositResult.amountDeposited / 2592000).toFixed(6)} / sec
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
