import {
  Client,
  TopicId,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";
import { getOperatorClient, getOperatorKey } from "./client";
import { hashscanTxUrl } from "./format";
import { isDemoMode } from "@/lib/demo";

export interface HcsAuditEventPayload {
  event: string;
  invoiceId?: string;
  txId?: string;
  payer?: string;
  service?: string;
  amount?: string;
  propertyId?: string;
  addressHash?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface HcsAuditReceipt {
  topicId: string;
  sequenceNumber: number;
  consensusTimestamp: string;
  txId: string;
  hashscanUrl: string;
  event: string;
}

let cachedTopicId: string | null = process.env.HEDERA_AUDIT_TOPIC_ID ?? null;

export async function getOrCreateAuditTopic(client?: Client): Promise<string> {
  if (cachedTopicId) return cachedTopicId;

  try {
    const hederaClient = client ?? getOperatorClient();
    const operatorKey = getOperatorKey();
    const createTx = await new TopicCreateTransaction()
      .setTopicMemo("LiquidityStream x402 Verifiable Audit Trail")
      .freezeWith(hederaClient)
      .sign(operatorKey);
    const response = await createTx.execute(hederaClient);
    const receipt = await response.getReceipt(hederaClient);
    if (receipt.topicId) {
      cachedTopicId = receipt.topicId.toString();
      return cachedTopicId;
    }
  } catch (err) {
    console.warn("Hedera operator unavailable for live topic creation; using test topic: 0.0.4491823");
  }

  cachedTopicId = "0.0.4491823";
  return cachedTopicId;
}

async function submitHcsMessage(
  topicIdStr: string,
  messageStr: string
): Promise<{ sequenceNumber: number; consensusTimestamp: string; txIdStr: string }> {
  const client = getOperatorClient();
  const operatorKey = getOperatorKey();

  const frozen = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicIdStr))
    .setMessage(messageStr)
    .freezeWith(client);

  const signed = await frozen.sign(operatorKey);
  const response = await signed.execute(client);
  const record = await response.getRecord(client);

  const sequenceNumber = record.receipt.topicSequenceNumber
    ? Number(record.receipt.topicSequenceNumber)
    : 1;
  const consensusTimestamp = record.consensusTimestamp
    ? record.consensusTimestamp.toDate().toISOString()
    : new Date().toISOString();
  const txIdStr = response.transactionId.toString();

  return { sequenceNumber, consensusTimestamp, txIdStr };
}

export async function logHcsAuditEvent(
  payload: HcsAuditEventPayload
): Promise<HcsAuditReceipt> {
  const timestamp = payload.timestamp ?? new Date().toISOString();
  const fullPayload = { ...payload, timestamp, standard: "x402-hcs-audit-v1" };
  const messageStr = JSON.stringify(fullPayload);
  const topicIdStr = await getOrCreateAuditTopic();

  try {
    const { sequenceNumber, consensusTimestamp, txIdStr } = await submitHcsMessage(topicIdStr, messageStr);
    return {
      topicId: topicIdStr,
      sequenceNumber,
      consensusTimestamp,
      txId: txIdStr,
      hashscanUrl: hashscanTxUrl(txIdStr),
      event: payload.event,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!isDemoMode()) {
      throw new Error(`Hedera HCS audit logging failed on live network: ${msg}`);
    }
    const mockSeq = Math.floor(Date.now() / 1000) % 100000;
    const mockTxId = payload.txId ?? `0.0.4491823@${Math.floor(Date.now() / 1000)}.000000000`;
    return {
      topicId: topicIdStr,
      sequenceNumber: mockSeq,
      consensusTimestamp: timestamp,
      txId: mockTxId,
      hashscanUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(mockTxId)}`,
      event: payload.event,
    };
  }
}
