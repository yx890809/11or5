// 杀号推荐卡
import { Crosshair, Flame, Snowflake, TrendingUp, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import type { KillRecommendation, NumberStat, AnalyzerOptions, LotteryRecord } from "@/types";
import { quickBacktest } from "@/lib/analyzer";
import Ball from "./Ball";

interface Props {
  recommendation: KillRecommendation;
  stats: NumberStat[];
  options?: AnalyzerOptions;
  records?: LotteryRecord[];
}

/** 杀 N 个号的理论随机正确率 */
function killSuccessRate(n: number): string {
  const total = 462; // C(11,5)
  const okMap: Record<number, number> = { 1: 252, 2: 126, 3: 56, 4: 21, 5: 6 };
  const ok = okMap[n] ?? 0;
  return ((ok / total) * 100).toFixed(1);
}

export default function KillCard({ recommendation, stats, options, records }: Props) {
  const { killNumbers, details } = recommendation;

  // 跑快速回测对比三种策略
  const bt = useMemo(() => {
    if (!records || records.length < 20) return null;
    return quickBacktest(records, 20);
  }, [records]);
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

  // 算出最高共识度（多少种方法同意）
  const maxConsensus = Math.max(...killDetails.map((d) => d.methods.length));

  return (
    <div className="panel">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-gold-400" /> 下期杀号推荐
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1 text-gold-300">
            <TrendingUp className="h-3 w-3" /> 共识 {maxConsensus}/7 法
          </span>
          <span className="text-slate-600">|</span>
          <span>理论 {(killSuccessRate(killNumbers.length))}%</span>
          <span className="text-slate-600">|</span>
          <span>杀 {killNumbers.length} 个</span>
        </div>
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
                <span className="ml-1 rounded bg-gold-400/15 px-1.5 py-0.5 text-[10px] text-gold-300 ring-1 ring-gold-400/40">
                  {d.methods.length}法共识
                </span>
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

      {/* 策略回测对比 */}
      {bt && bt.total > 0 && (
        <div className="border-t border-white/5 px-4 py-2">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] text-slate-500">
            <BarChart3 className="h-3 w-3" />
            近 {bt.total} 期回测：共识 vs 加权 vs 随机基线
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={`font-mono ${bt.consensus.rate >= bt.random.rate ? "text-green-400" : "text-red-400"}`}>
              共识制 {(bt.consensus.rate * 100).toFixed(0)}% ({bt.consensus.hits}/{bt.total})
            </span>
            <span className="text-slate-600">|</span>
            <span className={`font-mono ${bt.weighted.rate >= bt.random.rate ? "text-green-400" : "text-red-400"}`}>
              加权制 {(bt.weighted.rate * 100).toFixed(0)}% ({bt.weighted.hits}/{bt.total})
            </span>
            <span className="text-slate-600">|</span>
            <span className="font-mono text-slate-500">随机 {killSuccessRate(killNumbers.length)}%</span>
          </div>
          {bt.consensus.rate < 0.27 && bt.weighted.rate < 0.27 && (
            <div className="mt-1 text-[10px] text-red-400">
              ⚠️ 两种算法都低于随机基线，当前参数配置在反向预测！
            </div>
          )}
        </div>
      )}
    </div>
  );
}
