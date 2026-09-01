// 杀号推荐卡
import { Crosshair, Flame, Snowflake } from "lucide-react";
import type { KillRecommendation, NumberStat } from "@/types";
import Ball from "./Ball";

interface Props {
  recommendation: KillRecommendation;
  stats: NumberStat[];
}

export default function KillCard({ recommendation, stats }: Props) {
  const { killNumbers, details } = recommendation;
  const killDetails = killNumbers
    .map((n) => details.find((d) => d.num === n))
    .filter(Boolean) as NonNullable<(typeof details)[number]>[];

  if (killNumbers.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <Crosshair className="h-4 w-4 text-gold-400" /> 杀号推荐
        </div>
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          数据不足，无法生成推荐
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-gold-400" /> 下期杀号推荐
        </span>
        <span className="text-xs text-slate-500">综合 4 种方法评分</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 p-4 md:gap-8 md:p-6">
        {killDetails.map((d, i) => {
          const stat = stats.find((s) => s.num === d.num);
          const isHot = stat ? stat.freqRate >= 0.4 : false;
          return (
            <div key={d.num} className="flex flex-col items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                {isHot ? (
                  <Flame className="h-3.5 w-3.5 text-kill" />
                ) : (
                  <Snowflake className="h-3.5 w-3.5 text-cyan-400" />
                )}
                {isHot ? "偏热号" : "偏冷号"}
              </div>
              <Ball num={d.num} variant="gold" size="xl" glow className="!h-16 !w-16 !text-2xl md:!h-20 md:!w-20 md:!text-3xl" />
              <div className="flex flex-wrap justify-center gap-1.5">
                {d.methods.length > 0 ? (
                  d.methods.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[10px] md:text-[11px] text-gold-300 ring-1 ring-gold-400/30"
                    >
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-600">综合得分</span>
                )}
              </div>
              <div className="font-mono text-xs text-slate-500">得分 {d.score}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
