// 冷热频次统计图
import { Flame, Snowflake, Circle } from "lucide-react";
import type { NumberStat } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  stats: NumberStat[];
}

export default function FreqChart({ stats }: Props) {
  const maxFreq = Math.max(...stats.map((s) => s.freq), 1);
  const avgFreq = stats.reduce((a, s) => a + s.freq, 0) / (stats.length || 1);

  const colorOf = (s: NumberStat) => {
    if (s.freq >= avgFreq * 1.3) return "bg-kill";
    if (s.currentOmit >= 6) return "bg-cyan-400";
    if (s.freq <= avgFreq * 0.7) return "bg-cyan-400";
    return "bg-warm";
  };

  return (
    <div className="panel">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-kill" /> 冷热频次
        </span>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-kill" />热号</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warm" />温号</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" />冷号</span>
        </div>
      </div>
      <div className="space-y-1.5 p-4">
        {stats.map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            <span className="w-8 font-mono text-xs text-slate-400">
              {String(s.num).padStart(2, "0")}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/5">
              <div
                className={cn("animate-barGrow h-full rounded", colorOf(s))}
                style={{ width: `${(s.freq / maxFreq) * 100}%`, animationDelay: `${i * 40}ms` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs text-slate-400">{s.freq}</span>
            <span className="w-14 text-right font-mono text-[11px] text-slate-500">
              {(s.freqRate * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
        <Circle className="h-3 w-3" />
        窗口平均出现 {avgFreq.toFixed(1)} 次，热号偏热、冷号遗漏较长为杀号候选
      </div>
    </div>
  );
}
