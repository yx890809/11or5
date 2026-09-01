// 历史开奖表（高亮杀号与冷热）
import { History, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LotteryRecord, NumberStat } from "@/types";
import { sortRecords } from "@/lib/analyzer";
import Ball from "./Ball";

interface Props {
  records: LotteryRecord[];
  stats: NumberStat[];
  killNumbers: number[];
  limit?: number;
  onClear?: () => void;
}

export default function HistoryTable({ records, stats, killNumbers, limit = 20, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  const sorted = sortRecords(records).slice(-limit).reverse();
  const isKill = (n: number) => killNumbers.includes(n);
  const isHot = (n: number) => stats.find((s) => s.num === n)?.isHot;
  const isCold = (n: number) => stats.find((s) => s.num === n)?.isCold;

  const variantOf = (n: number) => {
    if (isKill(n)) return "kill" as const;
    if (isHot(n)) return "kill" as const;
    if (isCold(n)) return "cold" as const;
    return "dim" as const;
  };

  return (
    <div className="panel">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-400" /> 历史开奖
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">最近 {sorted.length} 期</span>
          {onClear && records.length > 0 && (
            confirming ? (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-amber-400">确认清空？</span>
                <button
                  onClick={() => { onClear(); setConfirming(false); }}
                  className="rounded bg-red-500/80 px-2 py-0.5 text-[11px] text-white hover:bg-red-500"
                >确认</button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/15"
                >取消</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                title="清空所有开奖数据"
              >
                <Trash2 className="h-3 w-3" /> 清空
              </button>
            )
          )}
        </div>
      </div>
      <div className="max-h-[360px] overflow-auto p-2">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-void-800">
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-medium">期号</th>
              <th className="px-3 py-2 font-medium">开奖号码</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {sorted.map((r, i) => (
              <tr
                key={r.issue + i}
                className="animate-rowIn border-b border-white/5"
                style={{ animationDelay: `${i * 24}ms` }}
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.issue}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {r.numbers.map((n, idx) => (
                      <Ball key={idx} num={n} size="sm" variant={variantOf(n)} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
