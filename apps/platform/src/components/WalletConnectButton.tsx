"use client";

import { useWallet } from "@/hooks/useWalletConnect";
import { useEvmWallet } from "@/hooks/useEvmWallet";

function shorten(accountId: string): string {
  return accountId.startsWith("0x")
    ? `${accountId.slice(0, 6)}…${accountId.slice(-4)}`
    : accountId;
}

export default function WalletConnectButton() {
  const { accountId, connecting, error, connect, disconnect } = useWallet();
  const evm = useEvmWallet();

  return (
    <div className="app-wallet-control">
      <button
        onClick={accountId ? disconnect : connect}
        disabled={connecting}
        title={accountId ? "Disconnect Hedera wallet" : "Connect Hedera wallet"}
        className={`app-wallet-button ${accountId ? "is-connected" : ""}`}
      >
        {accountId && <span className="app-wallet-dot" aria-hidden="true" />}
        {connecting ? "Connecting…" : accountId ? shorten(accountId) : "Hedera"}
      </button>
      <button
        onClick={evm.accountId ? evm.disconnect : evm.connect}
        disabled={evm.connecting}
        title={evm.accountId ? "Disconnect wallet" : "Connect wallet"}
        className={`app-wallet-button ${evm.accountId ? "is-connected" : ""}`}
      >
        {evm.accountId && <span className="app-wallet-dot" aria-hidden="true" />}
        {evm.connecting ? "Connecting…" : evm.accountId ? shorten(evm.accountId) : "Connect Wallet"}
      </button>
      {(error || evm.error) && <span className="app-wallet-error">{error ?? evm.error}</span>}
    </div>
  );
}
