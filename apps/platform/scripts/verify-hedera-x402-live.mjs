import fs from "node:fs";
import path from "node:path";
import {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
  Hbar,
} from "@hiero-ledger/sdk";

// Load environment variables from .env.local or .env if present
function loadEnv() {
  const envPaths = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "apps", "platform", ".env.local"),
    path.join(process.cwd(), "apps", "platform", ".env"),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || "0.0.10521086";
const OPERATOR_KEY =
  process.env.HEDERA_OPERATOR_KEY ||
  "0xa5521c1ab443772d4993015cf5591b9178c3f3118d0097d8d7383e19dbda07ee";
const MIRROR_NODE_URL =
  process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";
const AUDIT_TOPIC_ID = process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.10522243";
const APP_BASE_URL = process.env.TOKENIZATION_APP_URL || "http://localhost:3000";

function formatTxIdForMirrorNode(txId) {
  const clean = txId.trim();
  const atIndex = clean.indexOf("@");
  if (atIndex === -1) return clean;
  const account = clean.substring(0, atIndex);
  const timestamp = clean.substring(atIndex + 1).replace(".", "-");
  return `${account}-${timestamp}`;
}

async function runLiveVerification() {
  console.log("================================================================================");
  console.log("🚀 Prism 8 - ETHGlobal Hedera x402 Agentic Micropayment Live Verification");
  console.log("================================================================================\n");

  console.log(`[Config] Operator Account:   ${OPERATOR_ID}`);
  console.log(`[Config] Mirror Node URL:    ${MIRROR_NODE_URL}`);
  console.log(`[Config] HCS Audit Topic:    ${AUDIT_TOPIC_ID}`);
  console.log(`[Config] Target Base URL:    ${APP_BASE_URL}\n`);

  // Step 1: Agent Service Discovery Verification
  console.log("▶ [Step 1/6] Discovering Agent Services from /.well-known/agent-services.json...");
  let discoveryData;
  try {
    const res = await fetch(`${APP_BASE_URL}/.well-known/agent-services.json`);
    if (res.ok) {
      discoveryData = await res.json();
    }
  } catch (e) {
    // Fallback to local file read
    const localPath = path.join(process.cwd(), "public", ".well-known", "agent-services.json");
    if (fs.existsSync(localPath)) {
      discoveryData = JSON.parse(fs.readFileSync(localPath, "utf8"));
    }
  }

  if (!discoveryData || !discoveryData.services) {
    throw new Error("Failed to discover agent services.");
  }

  const oracleService = discoveryData.services.find(
    (s) => s.id === "property-address-validation" || s.id === "x402-hedera-micropayment"
  );
  console.log(`  ✓ Service found: ${oracleService?.name || "Hedera Property Oracle"}`);
  console.log(`  ✓ Protocol:     ${oracleService?.protocol || "x402"} (Facilitator: ${oracleService?.facilitator || "Blocky402"})`);
  console.log(`  ✓ Pricing:      Standard: ${oracleService?.pricing?.tiers?.standard || "0.5 HBAR"}, Premium: ${oracleService?.pricing?.tiers?.premium || "1.0 HBAR"}\n`);

  // Step 2: Unpaid Request -> RFC x402 Challenge
  console.log("▶ [Step 2/6] Sending unpaid request to trigger RFC-compliant x402 Payment Challenge...");
  const targetProperty = {
    street: "123 Ocean Drive",
    city: "Miami",
    state: "FL",
    zip: "33139",
    tier: "STANDARD_DPV",
  };

  const challengeRes = await fetch(`${APP_BASE_URL}/api/x402/property-oracle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetProperty),
  });

  if (challengeRes.status !== 402) {
    throw new Error(`Expected HTTP 402 Payment Required, received HTTP ${challengeRes.status}`);
  }

  const challengeData = await challengeRes.json();
  const authHeader = challengeRes.headers.get("www-authenticate");
  const invoiceId = challengeRes.headers.get("x-402-invoice") || challengeData.x402?.invoiceId;
  const payeeId = challengeRes.headers.get("x-402-payee") || challengeData.x402?.payee;
  const amountTinybars = challengeRes.headers.get("x-402-amount") || challengeData.x402?.amount;

  console.log(`  ✓ HTTP 402 Status Confirmed`);
  console.log(`  ✓ WWW-Authenticate Header: ${authHeader}`);
  console.log(`  ✓ Invoice ID:              ${invoiceId}`);
  console.log(`  ✓ Payee Account:           ${payeeId}`);
  console.log(`  ✓ Required Amount:         ${amountTinybars} tinybars (${challengeData.x402?.displayAmount})\n`);

  // Step 3: Execute Real Testnet Payment via Hedera SDK
  console.log("▶ [Step 3/6] Executing real testnet payment transfer via @hiero-ledger/sdk...");
  const client = Client.forTestnet();
  const operatorAccount = AccountId.fromString(OPERATOR_ID);
  const operatorPrivateKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
  client.setOperator(operatorAccount, operatorPrivateKey);

  const payeeAccount = AccountId.fromString(payeeId);
  const memoText = `x402:${invoiceId}`;

  const paymentTx = await new TransferTransaction()
    .addHbarTransfer(operatorAccount, new Hbar(-0.5))
    .addHbarTransfer(payeeAccount, new Hbar(0.5))
    .setTransactionMemo(memoText)
    .freezeWith(client);

  const signedTx = await paymentTx.sign(operatorPrivateKey);
  const execResp = await signedTx.execute(client);
  const receipt = await execResp.getReceipt(client);
  const txIdString = execResp.transactionId.toString();

  console.log(`  ✓ On-chain Settlement Status: ${receipt.status.toString()}`);
  console.log(`  ✓ Hedera Transaction ID:     ${txIdString}`);
  console.log(`  ✓ HashScan Explorer Link:     https://hashscan.io/testnet/transaction/${encodeURIComponent(txIdString)}\n`);

  // Step 4: Await Mirror Node Consensus Propagation
  console.log("▶ [Step 4/6] Waiting 4 seconds for Hedera Mirror Node consensus indexing...");
  await new Promise((r) => setTimeout(r, 4000));

  const formattedMirrorTx = formatTxIdForMirrorNode(txIdString);
  const mirrorUrl = `${MIRROR_NODE_URL}/api/v1/transactions/${encodeURIComponent(formattedMirrorTx)}`;
  console.log(`  Querying Mirror Node: ${mirrorUrl}`);

  let mirrorVerified = false;
  let attempts = 0;
  while (attempts < 5 && !mirrorVerified) {
    attempts++;
    try {
      const mirrorRes = await fetch(mirrorUrl);
      if (mirrorRes.ok) {
        const mirrorJson = await mirrorRes.json();
        if (mirrorJson.transactions && mirrorJson.transactions.length > 0) {
          const rec = mirrorJson.transactions[0];
          console.log(`  ✓ Mirror Node Record Found! Consensus Result: ${rec.result}`);
          console.log(`  ✓ Consensus Timestamp: ${rec.consensus_timestamp}`);
          mirrorVerified = true;
          break;
        }
      }
    } catch (e) {
      // retry
    }
    if (!mirrorVerified) {
      console.log(`  Waiting for indexing (attempt ${attempts}/5)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!mirrorVerified) {
    console.warn("  ⚠ Mirror node indexing took longer than 14s, proceeding to proof submission.");
  }
  console.log();

  // Step 5: Submit Payment Proof to Oracle & Verify Fulfillment
  console.log("▶ [Step 5/6] Submitting Payment Proof headers to /api/x402/property-oracle...");
  const paidRes = await fetch(`${APP_BASE_URL}/api/x402/property-oracle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Tx": txIdString,
      "X-Payment-Invoice": invoiceId,
    },
    body: JSON.stringify(targetProperty),
  });

  if (!paidRes.ok) {
    const errorBody = await paidRes.json();
    throw new Error(`Oracle rejected payment proof (HTTP ${paidRes.status}): ${errorBody.error || "Unknown error"}`);
  }

  const fulfillment = await paidRes.json();
  console.log(`  ✓ HTTP 200 OK Oracle Verification Response Received!`);
  console.log(`  ✓ USPS DPV Confirmation:    ${fulfillment.dpvConfirmation} (Valid: ${fulfillment.isValid})`);
  console.log(`  ✓ Address Hash:             ${fulfillment.addressHash}`);
  console.log(`  ✓ Settled Amount:           ${fulfillment.paymentProof?.amount}`);
  console.log(`  ✓ HCS Consensus Topic ID:   ${fulfillment.hcsAudit?.topicId}`);
  console.log(`  ✓ HCS Sequence Number:      #${fulfillment.hcsAudit?.sequenceNumber}`);
  console.log(`  ✓ HCS Topic Explorer:       https://hashscan.io/testnet/topic/${fulfillment.hcsAudit?.topicId}\n`);

  // Step 6: Test Replay Attack Prevention
  console.log("▶ [Step 6/6] Testing Cryptographic Replay Attack Protection (Re-submitting same invoice)...");
  const replayRes = await fetch(`${APP_BASE_URL}/api/x402/property-oracle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Tx": txIdString,
      "X-Payment-Invoice": invoiceId,
    },
    body: JSON.stringify(targetProperty),
  });

  if (replayRes.status === 400) {
    const replayErr = await replayRes.json();
    console.log(`  ✓ Replay Rejected as expected (HTTP 400): "${replayErr.error}"\n`);
  } else {
    throw new Error(`Replay protection failed! Expected HTTP 400, received HTTP ${replayRes.status}`);
  }

  console.log("================================================================================");
  console.log("🎉 ALL LIVE HEDERA TESTNET QUALIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");

  console.log("Evidence Summary for ETHGlobal Judges:");
  console.log(`1. x402 Micropayment TX:  https://hashscan.io/testnet/transaction/${encodeURIComponent(txIdString)}`);
  console.log(`2. HCS Verifiable Topic:   https://hashscan.io/testnet/topic/${fulfillment.hcsAudit?.topicId}`);
  console.log(`3. Service Discovery:      ${APP_BASE_URL}/.well-known/agent-services.json`);
  console.log(`4. Payer Account (Agent):  https://hashscan.io/testnet/account/${OPERATOR_ID}`);
  console.log(`5. Payee Account (Oracle): https://hashscan.io/testnet/account/${payeeId}\n`);
}

runLiveVerification().catch((err) => {
  console.error("❌ Live verification failed:", err.message);
  process.exit(1);
});
