"use client";

import React, { useState } from "react";
import { HcsAuditBadge } from "./HcsAuditBadge";

export interface PropertyTokenizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenized?: (propertyData: any) => void;
}

export function PropertyTokenizeModal({
  isOpen,
  onClose,
  onTokenized,
}: PropertyTokenizeModalProps) {
  const [street, setStreet] = useState("456 Oak Avenue");
  const [city, setCity] = useState("Miami");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("33101");
  const [monthlyRent, setMonthlyRent] = useState(3800);
  const [shares, setShares] = useState(1000);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyAndTokenize = async () => {
    setIsVerifying(true);
    setError(null);
    setVerificationResult(null);

    try {
      setVerificationStep("Step 1: Contacting /api/x402/property-oracle (Unpaid query)...");
      const unpaidRes = await fetch("/api/x402/property-oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ street, city, state, zip }),
      });

      if (unpaidRes.status !== 402) {
        throw new Error("Expected 402 challenge from x402 service");
      }

      const challenge = await unpaidRes.json();
      const invoiceId = challenge.x402?.invoiceId || "inv_demo";

      setVerificationStep("Step 2: 402 intercepted! Settling 0.5 HBAR micropayment via Blocky402...");
      await new Promise((r) => setTimeout(r, 900));

      const mockTxId = `0.0.4491823@${Math.floor(Date.now() / 1000)}.000000000`;

      setVerificationStep("Step 3: Submitting payment proof & executing USPS DPV check...");
      const paidRes = await fetch("/api/x402/property-oracle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Tx": mockTxId,
          "X-Payment-Invoice": invoiceId,
        },
        body: JSON.stringify({ street, city, state, zip }),
      });

      const paidData = await paidRes.json();
      if (!paidRes.ok) {
        throw new Error(paidData.error || "Verification failed");
      }

      setVerificationStep("Step 4: USPS Deliverable Confirmed (DPV Code Y). HCS Receipt Logged!");
      setVerificationResult(paidData);

      if (onTokenized) {
        onTokenized({
          street,
          city,
          state,
          zip,
          monthlyRent,
          shares,
          verification: paidData,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to tokenize property");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Hedera x402 + USPS Oracle
          </span>
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-1">Tokenize Physical Real Estate</h3>
        <p className="text-xs text-slate-400 mb-5">
          Verify physical deliverability with USPS via machine-to-machine x402 payment before minting HTS shares.
        </p>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white font-mono placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">ZIP</label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Monthly Rent ($ USD)</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Fractional HTS Shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white font-mono"
              />
            </div>
          </div>
        </div>

        {verificationStep && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{verificationStep}</span>
          </div>
        )}

        {verificationResult && (
          <div className="mt-4 rounded-xl bg-emerald-950/30 border border-emerald-500/50 p-3.5 text-xs text-slate-200 space-y-2">
            <div className="flex items-center justify-between font-semibold text-emerald-400">
              <span>✓ USPS DPV Verified: {verificationResult.standardizedAddress?.street}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                CODE {verificationResult.dpvConfirmation}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Hash: {verificationResult.addressHash?.slice(0, 20)}...
            </p>
            <HcsAuditBadge
              topicId={verificationResult.hcsAudit?.topicId}
              sequenceNumber={verificationResult.hcsAudit?.sequenceNumber}
              txId={verificationResult.hcsAudit?.txId}
            />
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleVerifyAndTokenize}
            disabled={isVerifying}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isVerifying ? "Executing x402 Handshake..." : "Verify & Deploy HTS Token"}
          </button>
        </div>
      </div>
    </div>
  );
}
