# LiquidityStream: 5-Minute Hackathon Demo Script
**Autonomous Real-Estate Yield Streaming Engine with Hedera x402 & Superfluid**

- **Target Audience:** ETHGlobal Judges (Hedera, Superfluid, Chainlink tracks)
- **Presenter Role:** Platform Operator / Admin pair programming with Hermes Agent
- **Key Takeaway:** Real-world physical real estate verified via x402 oracle on Hedera, fractionalized via Hedera Token Service (HTS), and streaming rental yield per-second via Superfluid CFA on Base Sepolia.

---

## ⏱️ Video & Live Demo Breakdown (Total Time: 4:30)

### [0:00 - 0:45] 1. The Hook: The Agentic Economy's Missing Piece
* **Screen:** Storefront homepage (`http://localhost:8080/` or deployment URL) showing the **LiquidityStream Engine** banner.
* **Talking Points:**
  > "The agentic economy needs payment rails that move at machine speed—sub-second finality, predictable sub-cent fees, and no smart contract overhead. Hedera is built for this, but autonomous agents have lacked real services to buy without API keys or credit cards.
  >
  > Today, we introduce **LiquidityStream**: an autonomous real-estate yield streaming engine powered by **Hedera x402**, **Superfluid CFA**, **Chainlink Functions**, and the **Hermes AI Agent**."
* **Action:** Highlight the live Agent Discovery Directory link (`/.well-known/agent-services.json`) showing metered machine-readable endpoints.

---

### [0:45 - 1:45] 2. The x402 Handshake: Machine-to-Machine Physical Property Validation
* **Screen:** Click **"Tokenize Property (x402)"** or type in Hermes Admin Console:
  `"Tokenize 456 Oak Avenue, Miami FL 33101 with $3,800 monthly rent."`
* **Visual Flow:**
  1. **Step 1:** Hermes queries `/api/x402/property-oracle`.
  2. **Step 2:** The server returns `HTTP 402 Payment Required` with the **Blocky402** facilitator challenge requesting 0.5 HBAR.
  3. **Step 3:** Hermes autonomously signs and settles the 0.5 HBAR micropayment on Hedera Testnet—zero human intervention.
  4. **Step 4:** The payment receipt is verified and immediately submitted to an **HCS (Hedera Consensus Service) Topic**.
  5. **Step 5:** The oracle runs USPS Address Validation:
     * Status: **DELIVERABLE**
     * USPS DPV Confirmation: **Code Y**
     * Deterministic Address Hash: Anchored in `PropertyRegistry.sol`.
* **Talking Points:**
  > "Notice what just happened: Hermes bought real data at machine speed. No credit card, no API key, no monthly subscription. The payment was settled on Hedera Testnet with sub-second finality, and the consensus receipt is permanently verifiable on HashScan."

---

### [1:45 - 2:45] 3. Native HTS Minting & Investor World ID Acquisition
* **Screen:** Open the token details workspace (`/tokens/456-oak-ave`).
* **Actions:**
  1. Show the deployed **Hedera Token Service (HTS)** token representing 1,000 fractional property shares.
  2. Connect an investor wallet (HashPack or MetaMask via WalletConnect).
  3. Complete the World ID check.
  4. Hermes approves the request and distributes the HTS fractional shares to the investor.
* **Talking Points:**
  > "Ownership is backed natively by Hedera Token Service (HTS), giving us native compliance controls—kyc, freeze, and wipe—without heavy EVM gas overhead."

---

### [2:45 - 3:45] 4. Per-Second Rental Yield Streaming (Superfluid CFA)
* **Screen:** The **Investor Stream Dashboard**.
* **Visual Flow:**
  1. Point to the live ticking yield counter: **`+$0.00162037 / sec`**.
  2. Watch the investor balance ticking continuously upward every fraction of a second.
  3. Click **"Trigger Tenant Rent Deposit"** in the **Rent Simulator Panel** ($3,800 inflow).
  4. Observe the stream update, with simulated fiat converting to `fUSDCx` Super Tokens in `YieldVault.sol`.
  5. Click **"Claim Yield"** to trigger a Hedera Scheduled Transaction settlement.
* **Talking Points:**
  > "Rent is traditionally paid once a month. With LiquidityStream, rental yield is unlocked continuously. Every single second, the investor's balance streams in real-time via Superfluid Constant Flow Agreements on Base Sepolia, backed by automated batch settlement via Hedera Scheduled Transactions."

---

### [3:45 - 4:30] 5. Verifiable Audit Trail & Compliance Freeze
* **Screen:** Click the **Hedera Consensus Audit Trail (HCS)** badge in the dashboard.
* **Actions:**
  1. Open the HashScan explorer showing the HCS Topic messages, sequence numbers, and consensus timestamps.
  2. Explain the compliance policy: If USPS records or property title ever fail an audit, Hermes immediately executes `emergencyFreezeAll()`, freezing the HTS token and cutting the Superfluid stream instantly.
* **Closing:**
  > "LiquidityStream unites the speed and efficiency of Hedera x402 with continuous Superfluid streaming and Chainlink real-world validation. This is how the agentic real-world economy gets built."

---

## 🛠️ Rapid Demo Checklist for Presenter
- [ ] Next.js Storefront running on `http://localhost:8080/` (or Railway root)
- [ ] Hermes Console accessible at `http://localhost:8080/hermes`
- [ ] Testnet wallet connected with HBAR testnet funds
- [ ] Base Sepolia RPC configured for Superfluid CFA inspection
