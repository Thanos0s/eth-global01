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
    <div className="rounded-2xl border border-neutral-300 bg-white p-5 text-black shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Hackathon Demo Tool
          </span>
          <h4 className="text-base font-bold text-black">Simulate Tenant Rent Payment</h4>
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-mono text-black border border-neutral-300">
          x402 + HCS Connected
        </span>
      </div>

      <p className="text-xs text-neutral-600 mb-4 leading-relaxed font-mono">
        Simulates an incoming ACH/fiat rental payment converting into stablecoins. Injects funds into the
        Base Sepolia YieldVault reserve, triggers Superfluid CFA stream acceleration, and logs an immutable consensus proof on Hedera.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[140px]">
          <span className="absolute left-3 top-2.5 text-neutral-500 font-mono text-sm">$</span>
          <input
            type="number"
            value={rentAmount}
            onChange={(e) => setRentAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 pl-7 pr-3 py-2 text-sm font-mono text-black placeholder-neutral-400 focus:border-black focus:outline-none"
            placeholder="3800"
          />
        </div>

        <button
          onClick={handleDepositRent}
          disabled={isDepositing || rentAmount <= 0}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white border border-black hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
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
        <div className="mt-3 p-2.5 bg-neutral-100 border border-neutral-400 rounded-lg text-xs text-black font-mono">
          {error}
        </div>
      )}

      {depositResult && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3.5 border border-neutral-300 text-xs text-black space-y-2 animate-fade-in font-mono">
          <div className="flex items-center justify-between text-black font-semibold text-sm">
            <span>✓ ${depositResult.amountDeposited?.toLocaleString()} Deposited</span>
            <span className="text-[11px] text-neutral-500">Flow Rate Active</span>
          </div>

          <div className="text-[11px] text-neutral-600 grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200">
            <div>
              <span className="block text-neutral-500">Hedera HCS Proof</span>
              <a
                href={depositResult.hcsAudit?.hashscanUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-black hover:underline truncate block font-bold"
              >
                Seq #{depositResult.hcsAudit?.sequenceNumber || "83527"} ↗
              </a>
            </div>
            <div>
              <span className="block text-neutral-500">Superfluid Flow</span>
              <span className="text-black font-bold">
                +${(depositResult.amountDeposited / 2592000).toFixed(6)} / sec
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
