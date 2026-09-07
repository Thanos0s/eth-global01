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
    <div className="rounded-2xl border border-neutral-300 bg-white p-6 text-black shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-black"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-black">
              Active Superfluid CFA Stream
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-black">{propertyAddress}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-mono text-black border border-neutral-300">
            Base Sepolia (fUSDCx)
          </span>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-mono text-neutral-600 border border-neutral-300">
            Hedera HTS (Shares)
          </span>
        </div>
      </div>

      {/* Main Streaming Ticker Counter */}
      <div className="my-6 rounded-xl bg-neutral-50 p-6 border border-neutral-300 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <svg className="w-24 h-24 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <span className="text-xs uppercase tracking-widest text-neutral-500 font-medium">
          Accrued Rental Yield (Real-Time)
        </span>
        <div className="mt-2 text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-black">
          ${currentYield.toFixed(6)}
        </div>

        <div className="mt-4 flex flex-wrap justify-center items-center gap-6 text-xs text-neutral-700 font-mono">
          <div>
            <span className="text-neutral-500 block text-[11px]">Flow Rate</span>
            <span className="text-black font-bold">
              +${flowRatePerSec.toFixed(8)} / sec
            </span>
          </div>
          <div className="h-4 w-px bg-neutral-300" />
          <div>
            <span className="text-neutral-500 block text-[11px]">Your Share ({sharePercentage}%)</span>
            <span className="text-black font-semibold">${investorMonthlyRent.toFixed(2)} / mo</span>
          </div>
          <div className="h-4 w-px bg-neutral-300" />
          <div>
            <span className="text-neutral-500 block text-[11px]">Total Property Rent</span>
            <span className="text-black font-semibold">${monthlyRent.toLocaleString()} / mo</span>
          </div>
        </div>
      </div>

      {/* Actions and Audit Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleClaim}
            disabled={isClaiming || currentYield <= 0.0001}
            className="flex-1 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white border border-black hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
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
            className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-xs font-medium text-black hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {isStreaming ? "Pause Stream View" : "Resume Stream"}
          </button>
        </div>

        {claimSuccess && (
          <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-xl text-xs text-black text-center animate-fade-in font-mono">
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
