// 数据预览表
import type { LotteryRecord } from "@/types";
import { sortRecords } from "@/lib/analyzer";
import Ball from "./Ball";

interface Props {
  records: LotteryRecord[];
  limit?: number;
}

export default function DataPreview({ records, limit = 30 }: Props) {
  const sorted = sortRecords(records).slice(-limit).reverse();

  if (records.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        暂无数据，请拉取或手动录入
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-void-700/90 backdrop-blur">
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 font-medium">期号</th>
            <th className="px-3 py-2 font-medium">开奖号码</th>
            <th className="px-3 py-2 text-right font-medium">和值</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {sorted.map((r, i) => (
            <tr
              key={r.issue + i}
              className="animate-rowIn border-b border-white/5 hover:bg-white/[0.03]"
              style={{ animationDelay: `${i * 18}ms` }}
            >
              <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.issue}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {r.numbers.map((n, idx) => (
                    <Ball key={idx} num={n} size="sm" variant="dim" />
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-right text-cyan-400">
                {r.numbers.reduce((a, b) => a + b, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
