// 投注号码显示卡 — 根据杀号组合查投注组
import { Rocket, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { lookupBetSlip } from "@/data/betSlips";

interface Props {
  killNumbers: number[]; // 杀号，固定 2 个
}

export default function BetSlipCard({ killNumbers }: Props) {
  const [copied, setCopied] = useState(false);

  const slip = killNumbers.length === 2
    ? lookupBetSlip(killNumbers[0], killNumbers[1])
    : null;

  const handleCopy = async () => {
    if (!slip) return;
    const text = slip.map(row => row.map(n => n.toString().padStart(2, "0")).join(" ")).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-orange-400" />
          <span className="font-semibold text-slate-200">投注号码推荐</span>
          <span className="text-xs text-slate-500">杀 {killNumbers.join(",")} → 8 组投注</span>
        </div>
        {slip && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            {copied ? (
              <><CheckCircle2 className="h-3 w-3 text-green-400" /> 已复制</>
            ) : (
              <><Copy className="h-3 w-3" /> 复制全部</>
            )}
          </button>
        )}
      </div>

      {!slip ? (
        <div className="py-6 text-center text-sm text-amber-400/80">
          ⚠️ 杀号组合 {killNumbers.join(",")} 暂无投注号码表
          <div className="mt-2 text-xs text-slate-500">
            已录入杀号组合覆盖 1-4 的两两组合，请提供更多杀号表后继续添加
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {slip.map((row, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              <span className="w-5 shrink-0 text-right text-[10px] text-slate-500">
                {idx + 1}.
              </span>
              <div className="flex flex-wrap gap-1">
                {row.map((n) => (
                  <span
                    key={n}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-[11px] font-bold text-orange-300 ring-1 ring-orange-500/30"
                  >
                    {n.toString().padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
