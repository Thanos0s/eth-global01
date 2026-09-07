"use client";

import React, { useEffect, useState, useRef } from "react";
import { HcsAuditBadge } from "./HcsAuditBadge";

export interface InvestorStreamDashboardProps {
  propertyAddress?: string;
  monthlyRent?: number;
  sharePercentage?: number;
  initialBalance?: number;
  onClaim?: () => void;
}

export function InvestorStreamDashboard({
  propertyAddress = "456 Oak Avenue, Miami FL 33101",
  monthlyRent = 3800,
  sharePercentage = 10.0, // 10% ownership
  initialBalance = 12.45021,
  onClaim,
}: InvestorStreamDashboardProps) {
  // Monthly yield for this investor
  const investorMonthlyRent = (monthlyRent * sharePercentage) / 100;
  // Per-second flow rate: monthly / (30 * 86400)
  const flowRatePerSec = investorMonthlyRent / 2592000;

  const [currentYield, setCurrentYield] = useState<number>(initialBalance);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [lastClaimedTime, setLastClaimedTime] = useState<Date | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimSuccess, setClaimSuccess] = useState<boolean>(false);

  const startRef = useRef<number>(Date.now());
  const initialRef = useRef<number>(initialBalance);

  // High-frequency animation loop for smooth real-time ticking balance (100ms)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startRef.current) / 1000;
      const accrued = elapsedSeconds * flowRatePerSec;
      setCurrentYield(initialRef.current + accrued);
    }, 80);

    return () => clearInterval(interval);
  }, [isStreaming, flowRatePerSec]);

  const handleClaim = async () => {
    setIsClaiming(true);
    // Simulate transaction on Hedera / Base Sepolia
    await new Promise((r) => setTimeout(r, 1200));
    setIsClaiming(false);
    setClaimSuccess(true);
    setLastClaimedTime(new Date());
    initialRef.current = 0;
    startRef.current = Date.now();
    setCurrentYield(0);
    if (onClaim) onClaim();
    setTimeout(() => setClaimSuccess(false), 4000);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-950 p-6 text-white shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Active Superfluid CFA Stream
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-slate-100">{propertyAddress}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-950/60 px-3 py-1 text-xs font-mono text-emerald-300 border border-emerald-700/50">
            Base Sepolia (fUSDCx)
          </span>
          <span className="rounded-full bg-indigo-950/60 px-3 py-1 text-xs font-mono text-indigo-300 border border-indigo-700/50">
            Hedera HTS (Shares)
          </span>
        </div>
      </div>

      {/* Main Streaming Ticker Counter */}
      <div className="my-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-6 border border-slate-800 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <svg className="w-24 h-24 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">
          Accrued Rental Yield (Real-Time)
        </span>
        <div className="mt-2 text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-emerald-400 drop-shadow-sm">
          ${currentYield.toFixed(6)}
        </div>

        <div className="mt-4 flex flex-wrap justify-center items-center gap-6 text-xs text-slate-300 font-mono">
          <div>
            <span className="text-slate-400 block text-[11px]">Flow Rate</span>
            <span className="text-emerald-300 font-semibold">
              +${flowRatePerSec.toFixed(8)} / sec
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div>
            <span className="text-slate-400 block text-[11px]">Your Share ({sharePercentage}%)</span>
            <span className="text-slate-200 font-semibold">${investorMonthlyRent.toFixed(2)} / mo</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div>
            <span className="text-slate-400 block text-[11px]">Total Property Rent</span>
            <span className="text-slate-200 font-semibold">${monthlyRent.toLocaleString()} / mo</span>
          </div>
        </div>
      </div>

      {/* Actions and Audit Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleClaim}
            disabled={isClaiming || currentYield <= 0.0001}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isClaiming ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Settling Yield on Hedera...
              </>
            ) : (
              <>Claim Accrued Yield (${currentYield.toFixed(4)})</>
            )}
          </button>

          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {isStreaming ? "Pause Stream View" : "Resume Stream"}
          </button>
        </div>

        {claimSuccess && (
          <div className="p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 text-center animate-fade-in">
            ✓ Successfully claimed yield! Settled via Hedera Scheduled Transaction.
          </div>
        )}

        {/* HCS Verifiable Audit Trail */}
        <HcsAuditBadge
          topicId="0.0.4491823"
          sequenceNumber={83526}
          txId="0.0.4491823@1788783526.000000000"
        />
      </div>
    </div>
  );
}
