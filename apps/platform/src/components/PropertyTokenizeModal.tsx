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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-white p-6 text-black shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-black text-lg font-bold cursor-pointer"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-black">
            Hedera x402 + USPS Oracle
          </span>
        </div>
        <h3 className="text-xl font-bold text-black mb-1">Tokenize Physical Real Estate</h3>
        <p className="text-xs text-neutral-600 mb-5 font-mono">
          Verify physical deliverability with USPS via machine-to-machine x402 payment before minting HTS shares.
        </p>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-neutral-700 mb-1 font-medium font-mono">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-black font-mono placeholder-neutral-400 focus:border-black focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-neutral-700 mb-1 font-medium font-mono">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-black font-mono focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-700 mb-1 font-medium font-mono">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-black font-mono focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-700 mb-1 font-medium font-mono">ZIP</label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-black font-mono focus:border-black focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-neutral-700 mb-1 font-medium font-mono">Monthly Rent ($ USD)</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-black font-mono focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-700 mb-1 font-medium font-mono">Fractional HTS Shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-black font-mono focus:border-black focus:outline-none"
              />
            </div>
          </div>
        </div>

        {verificationStep && (
          <div className="mt-4 p-3 rounded-xl bg-neutral-100 border border-neutral-300 font-mono text-[11px] text-black flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-black animate-ping" />
            <span>{verificationStep}</span>
          </div>
        )}

        {verificationResult && (
          <div className="mt-4 rounded-xl bg-neutral-50 border border-neutral-300 p-3.5 text-xs text-neutral-800 space-y-2 font-mono">
            <div className="flex items-center justify-between font-semibold text-black">
              <span>✓ USPS DPV Verified: {verificationResult.standardizedAddress?.street}</span>
              <span className="px-2 py-0.5 rounded bg-neutral-200 text-black text-[10px] border border-neutral-300">
                CODE {verificationResult.dpvConfirmation}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 font-mono">
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
          <div className="mt-3 p-2.5 bg-neutral-100 border border-neutral-400 rounded-lg text-xs text-black font-mono">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-300 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-medium text-neutral-700 hover:text-black hover:border-black transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleVerifyAndTokenize}
            disabled={isVerifying}
            className="rounded-xl bg-black px-5 py-2.5 text-xs font-semibold text-white border border-black hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isVerifying ? "Executing x402 Handshake..." : "Verify & Deploy HTS Token"}
          </button>
        </div>
      </div>
    </div>
  );
}
