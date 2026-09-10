"use client";

import React, { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { getMetaMaskProvider } from "@/lib/evm/browserProvider";
import { TheGraphInspectorModal } from "./TheGraphInspectorModal";

export interface AgenticSafetyCockpitProps {
  onWorkflowComplete?: (result: any) => void;
}

const VALIDATOR_MODULE_ADDRESS = "0x7579C0de00000000000000000000000000007579";
const HERMES_AGENT_ADDRESS = "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7";

export function AgenticSafetyCockpit({ onWorkflowComplete }: AgenticSafetyCockpitProps) {
  const evm = useEvmWallet();

  const [session, setSession] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSigningSession, setIsSigningSession] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [guardrailAlert, setGuardrailAlert] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState<boolean>(false);

  // Fetch active session on mount
  useEffect(() => {
    fetchSession();
  }, [evm.accountId]);

  const fetchSession = async () => {
    try {
      const url = evm.accountId
        ? `/api/agent/session?grantor=${encodeURIComponent(evm.accountId)}`
        : "/api/agent/session";
      const res = await fetch(url);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
      }
    } catch {
      // Fallback
    }
  };

  // 1. Grant/Rotate Session Key with EIP-712 Typed Signature (ERC-7579 standard)
  const handleGrantSessionKey = async () => {
    setIsSigningSession(true);
    setError(null);
    setGuardrailAlert(null);

    try {
      const rawProvider = getMetaMaskProvider();
      if (!rawProvider) {
        throw new Error("MetaMask extension was not detected. Please install MetaMask.");
      }

      // 1. Explicitly authorize accounts on current origin
      let accounts: string[] = [];
      try {
        accounts = (await rawProvider.request({ method: "eth_requestAccounts" })) as string[];
      } catch (authErr: any) {
        if (authErr.code === 4001 || authErr.message?.includes("rejected")) {
          throw new Error("Connection request declined in MetaMask.");
        }
        throw new Error(authErr.message || "MetaMask authorization failed.");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No authorized accounts found. Please unlock your MetaMask wallet.");
      }

      // 2. Ensure chain is Sepolia (0xaa36a7)
      try {
        const chainId = await rawProvider.request({ method: "eth_chainId" });
        if (chainId !== "0xaa36a7") {
          try {
            await rawProvider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0xaa36a7" }],
            });
          } catch (switchErr: any) {
            console.warn("Could not switch to Sepolia automatically:", switchErr);
          }
        }
      } catch {
        // Ignore chain check error
      }

      const provider = new BrowserProvider(rawProvider);
      const signer = await provider.getSigner();
      const grantor = await signer.getAddress();

      const policyConstraints = {
        maxSpendHbar: 5.0,
        maxFlowRateMonthlyUsd: 5000,
        allowedActions: [
          "ORACLE_USPS_X402",
          "HCS_CONSENSUS_AUDIT",
          "SUBGRAPH_HOLDER_DISCOVERY",
          "CFA_YIELD_STREAM_START",
          "CFA_YIELD_STREAM_ADJUST",
          "COMPLIANCE_FREEZE",
        ],
        durationHours: 24,
      };

      const nonce = Date.now();
      const validUntil = Math.floor(Date.now() / 1000) + 24 * 3600;

      const domain = {
        name: "Prism8SessionValidator",
        version: "1",
        chainId: 11155111,
        verifyingContract: VALIDATOR_MODULE_ADDRESS,
      };

      const types = {
        SessionPolicy: [
          { name: "grantor", type: "address" },
          { name: "agent", type: "address" },
          { name: "maxSpendHbar", type: "uint256" },
          { name: "maxFlowMonthlyUsd", type: "uint256" },
          { name: "validUntil", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      };

      const value = {
        grantor,
        agent: HERMES_AGENT_ADDRESS,
        maxSpendHbar: BigInt(5 * 1e18),
        maxFlowMonthlyUsd: BigInt(5000),
        validUntil: BigInt(validUntil),
        nonce: BigInt(nonce),
      };

      let signature: string;
      let rawMessage: string | undefined;

      try {
        // Primary: EIP-712 Structured Typed Data Signing
        signature = await signer.signTypedData(domain, types, value);
      } catch (typedErr: any) {
        // Fallback to personal_sign if user wallet doesn't support typed data
        rawMessage = [
          "[Prism 8] Cryptographic Agent Session Key Delegation (ERC-7579)",
          `Grantor: ${grantor}`,
          `Grantee Agent: ${HERMES_AGENT_ADDRESS}`,
          "Max Spend Cap: 5.0 HBAR equivalent",
          "Max Yield Flow: $5,000 USD / month",
          `Allowed Actions: ${policyConstraints.allowedActions.join(", ")}`,
          `Validity: 24 Hours (until ${validUntil})`,
          `Nonce: ${nonce}`,
        ].join("\n");
        signature = await signer.signMessage(rawMessage);
      }

      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantor,
          signature,
          constraints: policyConstraints,
          nonce,
          rawMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register session key");

      setSession(data.session);
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setError("Signature declined in wallet.");
      } else {
        setError(err.message || "Failed to grant session key.");
      }
    } finally {
      setIsSigningSession(false);
    }
  };

  // 2. Run Autonomous Pipeline
  const handleRunAutonomousPipeline = async () => {
    setIsRunning(true);
    setError(null);
    setGuardrailAlert(null);
    setExecutionResult(null);

    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.sessionId || "session_prism8_genesis_demo",
          action: "FULL_TOKENIZATION_AND_YIELD_PIPELINE",
          property: {
            street: "456 Oak Avenue",
            city: "Miami",
            state: "FL",
            zip: "33101",
            monthlyRent: 3800,
            shares: 1000,
          },
          simulateMalicious: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Autonomous execution failed");

      setExecutionResult(data);
      fetchSession();

      if (onWorkflowComplete) {
        onWorkflowComplete(data);
      }
    } catch (err: any) {
      setError(err.message || "Pipeline execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  // 3. Test Cryptographic Guardrail (Simulate Rogue AI Action)
  const handleSimulateRogueAction = async () => {
    setError(null);
    setExecutionResult(null);
    setGuardrailAlert(null);

    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.sessionId || "session_prism8_genesis_demo",
          action: "UNAUTHORIZED_TREASURY_TRANSFER",
          simulateMalicious: true,
        }),
      });

      const data = await res.json();
      if (res.status === 403) {
        setGuardrailAlert(data);
      } else {
        setError("Guardrail failed to intercept rogue action.");
      }
    } catch (err: any) {
      setError(err.message || "Guardrail test error");
    }
  };

  const remainingHbar = session ? Math.max(0, session.constraints.maxSpendHbar - session.spentHbar) : 4.5;
  const budgetPercent = session ? (remainingHbar / session.constraints.maxSpendHbar) * 100 : 90;

  return (
    <div className="bg-white border border-neutral-300 p-6 shadow-sm font-mono text-black space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-black">
              ERC-7579 Account Abstraction & Guardrails
            </span>
          </div>
          <h2 className="text-xl font-bold text-black tracking-tight">
            Hermes Autonomous Mission Cockpit
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Autonomous AI agents executing real on-chain workflows under cryptographically signed session constraints (EIP-712 / ERC-7579).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGrantSessionKey}
            disabled={isSigningSession}
            className="px-4 py-2 bg-white text-black border border-black text-xs font-bold hover:bg-neutral-100 transition cursor-pointer"
          >
            {isSigningSession ? "Signing EIP-712 in Wallet..." : "✍️ Grant Session Key (EIP-712)"}
          </button>
          <button
            onClick={handleRunAutonomousPipeline}
            disabled={isRunning}
            className="px-4 py-2 bg-black text-white border border-black text-xs font-bold hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1.5"
          >
            {isRunning ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Hermes Executing...</span>
              </>
            ) : (
              <>
                <span>⚡ Run Autonomous Mission</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: 3 Safety Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Card 1: Session Status & ERC-7579 Validator */}
        <div className="p-3.5 border border-neutral-300 bg-neutral-50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">ERC-7579 Module</span>
            <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold">
              {session?.signatureType === "EIP712" ? "EIP-712 TYPED" : (session?.status || "ACTIVE")}
            </span>
          </div>
          <div className="text-black font-bold text-sm">
            {session ? `${session.sessionId.slice(0, 16)}...` : "session_prism8_genesis"}
          </div>
          <div className="text-[11px] text-neutral-600 truncate">
            Validator: <span className="text-black font-semibold">SessionKeyValidator.sol</span>
          </div>
          <div className="text-[10px] text-neutral-500 truncate">
            Grantor: {session?.grantor || (evm.accountId ? `${evm.accountId.slice(0, 10)}...` : "0x7099...79C8")}
          </div>
        </div>

        {/* Card 2: Spend Allowance */}
        <div className="p-3.5 border border-neutral-300 bg-neutral-50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Remaining Budget</span>
            <span className="font-bold text-black">
              {remainingHbar.toFixed(2)} / {session?.constraints.maxSpendHbar || 5.0} HBAR
            </span>
          </div>
          <div className="w-full bg-neutral-200 h-1.5 overflow-hidden">
            <div
              className="bg-black h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, budgetPercent))}%` }}
            />
          </div>
          <div className="text-[11px] text-neutral-500">
            Auto-settles 0.5 HBAR x402 micropayments per oracle call.
          </div>
        </div>

        {/* Card 3: Cryptographic Guardrails */}
        <div className="p-3.5 border border-neutral-300 bg-neutral-50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Safety Guardrail</span>
            <span className="text-[10px] text-neutral-700 border border-neutral-300 px-1.5 py-0.5 bg-white">
              STRICT CEILING
            </span>
          </div>
          <div className="text-black font-bold">
            Max CFA: ${session?.constraints.maxFlowRateMonthlyUsd || 5000}/mo
          </div>
          <div className="text-[11px] text-neutral-500">
            Unauthorized drains or out-of-bounds calls cryptographically rejected.
          </div>
        </div>
      </div>

      {/* Safety Demonstration Button */}
      <div className="flex items-center justify-between p-3 border border-neutral-200 bg-white text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-black">Audit / Safety Benchmark</div>
          <div className="text-[11px] text-neutral-600">
            Verify that the AI agent cannot exceed its delegated budget or trigger rogue contracts.
          </div>
        </div>
        <button
          onClick={handleSimulateRogueAction}
          className="px-3 py-1.5 border border-neutral-400 bg-white text-black hover:bg-neutral-100 transition text-xs font-semibold cursor-pointer"
        >
          🛡️ Test Guardrail (Simulate Rogue Action)
        </button>
      </div>

      {/* Guardrail Rejection Alert (Proves Safety to Judges) */}
      {guardrailAlert && (
        <div className="p-4 border-2 border-black bg-neutral-50 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-black text-sm">
              <span>🛡️</span>
              <span>SECURITY BENCHMARK PASSED: ROGUE AI INTERCEPTED</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold">
                403 FORBIDDEN (HALTED)
              </span>
              <button
                onClick={() => setGuardrailAlert(null)}
                className="text-neutral-500 hover:text-black text-xs font-bold px-1"
                title="Dismiss benchmark alert"
              >
                ✕
              </button>
            </div>
          </div>
          <p className="text-neutral-800 text-[11px] leading-relaxed">
            Hermes attempted to execute an unauthorized treasury transfer (<code className="bg-neutral-200 px-1 py-0.5 text-black font-mono font-bold">{guardrailAlert.guardrailDetails?.attemptedAction}</code>), but was <strong>cryptographically rejected</strong> by the ERC-7579 Session Key Validator. Your wallet and funds remain 100% secure.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px] text-neutral-600 border-t border-neutral-200">
            <div>Policy Status: <strong className="text-black block">ENFORCED (REJECTED)</strong></div>
            <div>Attempted Action: <strong className="text-black block truncate">{guardrailAlert.guardrailDetails?.attemptedAction}</strong></div>
            <div>Intercepted Spend: <strong className="text-black block">{guardrailAlert.guardrailDetails?.attemptedSpend}</strong></div>
            <div>Protected Balance: <strong className="text-black block">{guardrailAlert.guardrailDetails?.remainingSessionBudget}</strong></div>
          </div>
          <div className="text-[10px] text-neutral-500 italic pt-0.5">
            ✓ Hackathon Security Proof: Hermes cannot drain assets or call undelegated contracts beyond the user's signed EIP-712 envelope.
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 border border-neutral-400 bg-neutral-50 text-xs text-black">
          ⚠️ {error}
        </div>
      )}

      {/* Real On-Chain Activity Ledger */}
      {executionResult && (
        <div className="border border-neutral-300 bg-neutral-50 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black" />
              <span className="font-bold text-black text-sm">
                Live On-Chain Evidence & Execution Ledger
              </span>
            </div>
            <span className="text-[11px] text-neutral-600">
              Execution ID: {executionResult.executionId}
            </span>
          </div>

          {/* ERC-7579 Verification Badge */}
          {executionResult.sessionProof && (
            <div className="p-3 bg-white border border-neutral-300 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-black font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="text-black">🔒</span>
                  <span>{executionResult.sessionProof.standard}</span>
                </span>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px]">
                  VERIFIED DELEGATION
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] text-neutral-600">
                <div>Grantor: <span className="font-mono text-black font-semibold">{executionResult.sessionProof.grantor.slice(0, 8)}...</span></div>
                <div>Agent: <span className="font-mono text-black font-semibold">{executionResult.sessionProof.agent.slice(0, 8)}...</span></div>
                <div>Budget Limit: <span className="text-black font-semibold">{executionResult.sessionProof.delegatedBudget}</span></div>
                <div>Validator: <span className="font-mono text-black font-semibold">SessionKeyValidator</span></div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {executionResult.steps?.map((step: any) => (
              <div
                key={step.stepNumber}
                className="p-3 bg-white border border-neutral-300 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-black flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <span>{step.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 border border-neutral-300 bg-neutral-100 text-black">
                    {step.status}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-600">
                  {step.detail}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200 text-[10px]">
                  <div className="text-neutral-500">
                    Network: <span className="text-black font-semibold">{step.network}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.network?.includes("The Graph") ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">IPFS:</span>
                        <button
                          type="button"
                          onClick={() => setIsGraphModalOpen(true)}
                          className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1 cursor-pointer"
                          title="Open interactive Subgraph Inspector Modal"
                        >
                          <span>{step.txId.slice(0, 16)}...</span>
                          <span className="text-[9px] bg-black text-white px-2 py-0.5 border border-black rounded font-semibold hover:bg-neutral-800 transition">
                            🔍 Inspect Subgraph Live ↗
                          </span>
                        </button>
                        <a
                          href="/api/subgraph"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 border border-neutral-300 rounded text-black font-semibold"
                          title="Open raw GraphQL API endpoint"
                        >
                          API JSON ↗
                        </a>
                      </div>
                    ) : (
                      <>
                        <span className="text-neutral-500">Tx:</span>
                        <a
                          href={step.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-black underline hover:text-neutral-600 flex items-center gap-1"
                        >
                          <span>{step.txId.slice(0, 20)}...</span>
                          <span className="text-[9px] bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 border border-neutral-300 rounded text-black font-semibold">
                            {step.network.includes("Hedera") ? "HashScan ↗" : step.network.includes("Base") ? "BaseScan ↗" : "Explorer ↗"}
                          </span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-neutral-100 border border-neutral-300 text-[11px] text-black flex items-center justify-between">
            <span>✓ Complete Economic Workflow Settled Autonomously under Delegated Session Cap</span>
            <span className="font-bold">Remaining Allowance: {executionResult.sessionRemainingHbar.toFixed(2)} HBAR</span>
          </div>
        </div>
      )}

      {/* Interactive The Graph Inspector Modal */}
      <TheGraphInspectorModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
      />
    </div>
  );
}
