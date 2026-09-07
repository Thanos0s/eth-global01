"use client";

import React from "react";

export interface HcsAuditBadgeProps {
  topicId?: string;
  sequenceNumber?: number | string;
  txId?: string;
  consensusTimestamp?: string;
  compact?: boolean;
}

export function HcsAuditBadge({
  topicId = "0.0.4491823",
  sequenceNumber = "83526",
  txId,
  consensusTimestamp,
  compact = false,
}: HcsAuditBadgeProps) {
  const hashscanTopicUrl = `https://hashscan.io/testnet/topic/${topicId}`;
  const hashscanTxUrl = txId
    ? `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`
    : `https://hashscan.io/testnet/topic/${topicId}`;

  if (compact) {
    return (
      <a
        href={hashscanTopicUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
        title="Verified on Hedera Consensus Service (HCS)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>HCS #{sequenceNumber}</span>
      </a>
    );
  }

  return (
    <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl text-xs text-slate-300 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-400 tracking-wide uppercase text-[10px]">
            Hedera Consensus Audit Trail (HCS)
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
          Seq #{sequenceNumber}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-900/50 font-mono text-[11px]">
        <div>
          <span className="text-slate-400 text-[10px] block">Topic ID</span>
          <a
            href={hashscanTopicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 hover:underline flex items-center gap-1"
          >
            {topicId} ↗
          </a>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block">Settlement Tx</span>
          <a
            href={hashscanTxUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 hover:underline truncate block"
          >
            {txId ? `${txId.slice(0, 16)}...` : "Confirmed on Testnet ↗"}
          </a>
        </div>
      </div>
    </div>
  );
}
