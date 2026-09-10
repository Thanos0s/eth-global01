/**
 * Resolves the genuine MetaMask provider when multiple browser wallets
 * (like Phantom, Coinbase, Brave, etc.) are installed and inject into window.ethereum.
 */
export function getMetaMaskProvider(): any {
  if (typeof window === "undefined") return undefined;
  const win = window as any;

  // 1. Check window.ethereum.providers array (standard EIP-5749 / multi-wallet injection)
  // When Phantom and MetaMask co-exist, window.ethereum.providers holds both instances.
  if (Array.isArray(win.ethereum?.providers) && win.ethereum.providers.length > 0) {
    // Specifically search for MetaMask that is NOT Phantom
    const genuineMetaMask = win.ethereum.providers.find(
      (p: any) => p.isMetaMask && !p.isPhantom
    );
    if (genuineMetaMask) return genuineMetaMask;

    // Fallback: any provider where isPhantom is falsy
    const nonPhantom = win.ethereum.providers.find((p: any) => !p.isPhantom);
    if (nonPhantom) return nonPhantom;
  }

  // 2. Check window.ethereum directly
  if (win.ethereum) {
    // If window.ethereum is genuine MetaMask (and NOT Phantom)
    if (win.ethereum.isMetaMask && !win.ethereum.isPhantom) {
      return win.ethereum;
    }

    // If window.ethereum was hijacked by Phantom (isPhantom === true),
    // check if there is another provider in providers or window.ethereum
    if (win.ethereum.isPhantom && Array.isArray(win.ethereum.providers)) {
      const found = win.ethereum.providers.find((p: any) => p.isMetaMask && !p.isPhantom);
      if (found) return found;
    }
  }

  // 3. Fallback
  return win.ethereum;
}
