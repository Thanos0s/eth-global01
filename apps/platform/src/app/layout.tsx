import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWalletConnect";
import { EvmWalletProvider } from "@/hooks/useEvmWallet";
import WalletConnectButton from "@/components/WalletConnectButton";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.TOKENIZATION_APP_URL ?? "http://localhost:3000"),
  title: "Prism 8 · Real-Estate Yield Streaming Engine",
  description:
    "Decentralized real-estate yield streaming platform powered by Hedera x402, The Graph, and Superfluid.",
  openGraph: {
    title: "Prism 8",
    description: "Autonomous real-estate yield streaming with Hedera x402, The Graph, and Superfluid.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-screen bg-background font-mono antialiased flex flex-col">
        <WalletProvider>
          <EvmWalletProvider>
            <header className="py-5 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50 font-mono">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href="/" className="flex items-center gap-2.5">
                    {/* Empty logo container - add logo image here later */}
                    <div className="w-8 h-8 rounded border border-dashed border-border bg-secondary/50 flex items-center justify-center text-xs text-muted-foreground" aria-label="Logo placeholder" />
                    <h1 className="text-lg md:text-xl font-bold font-mono text-foreground tracking-tight">
                      Prism 8
                    </h1>
                  </Link>
                  <span className="hidden md:inline-flex text-[11px] px-2.5 py-0.5 rounded font-mono bg-primary/10 text-primary border border-primary/20">
                    Hedera x402 + Superfluid + The Graph
                  </span>
                </div>
                <nav className="flex items-center gap-3" aria-label="Account actions">
                  <a
                    href="/hermes?force=1"
                    className="bg-secondary text-secondary-foreground px-4 py-2 border border-border hover:bg-secondary/80 transition-colors font-mono text-xs font-semibold flex items-center gap-1.5"
                    aria-label="Open Hermes admin"
                  >
                    <span>🤖</span>
                    <span>Hermes Console</span>
                  </a>
                  <WalletConnectButton />
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border py-8 bg-background font-mono text-xs text-muted-foreground mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">Prism 8</span>
                  <span>·</span>
                  <span>Autonomous Real-Estate Yield Streaming Engine</span>
                </div>
                <div className="flex items-center gap-4">
                  <a href="/.well-known/agent-services.json" target="_blank" className="hover:text-foreground transition-colors">
                    Agent Directory
                  </a>
                  <a href="/api/x402/property-oracle" target="_blank" className="hover:text-foreground transition-colors">
                    x402 Oracle
                  </a>
                  <a href="/api/subgraph" target="_blank" className="hover:text-foreground transition-colors">
                    The Graph
                  </a>
                </div>
              </div>
            </footer>
          </EvmWalletProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
