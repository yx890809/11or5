// 命中率统计卡片（可折叠）
import { useMemo, useState } from "react";
import { Target, TrendingUp, TrendingDown, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useLotteryStore } from "@/store";
import { computeHitRate, autoAdjustWeights, backtestPerMethod } from "@/lib/analyzer";
import { METHOD_LIST } from "@/types";

export default function HitRateCard({ defaultCollapsed = true }: { defaultCollapsed?: boolean }) {
  const predictionHistory = useLotteryStore((s) => s.predictionHistory);
  const records = useLotteryStore((s) => s.records);
  const options = useLotteryStore((s) => s.options);
  const setOptions = useLotteryStore((s) => s.setOptions);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const stats = useMemo(() => computeHitRate(predictionHistory), [predictionHistory]);

  // 实时回测兜底数据 — 给每个方法算独立命中率
  const btPerMethod = useMemo(() => backtestPerMethod(records, 20, 2), [records]);

  // 合并：历史记录有数据的用历史，没有的用回测
  const mergedPerMethod = useMemo(() => {
    const merged: Record<string, { hit: number; total: number; rate: number; source: "history" | "backtest" }> = {};
    for (const meta of METHOD_LIST) {
      const hist = stats.perMethod[meta.name];
      const bt = btPerMethod[meta.name];
      if (hist && hist.total > 0) {
        merged[meta.name] = { ...hist, source: "history" };
      } else if (bt && bt.total > 0) {
        merged[meta.name] = { ...bt, source: "backtest" };
      } else {
        merged[meta.name] = { hit: 0, total: 0, rate: 0, source: "backtest" };
      }
    }
    return merged;
  }, [stats.perMethod, btPerMethod]);

  const latestVerified = useMemo(
    () => [...predictionHistory].reverse().find((p) => p.hit !== undefined),
    [predictionHistory],
  );

  const pendingCount = useMemo(
    () => predictionHistory.filter((p) => p.hit === undefined).length,
    [predictionHistory],
  );

  const handleAutoAdjust = () => {
    const next = autoAdjustWeights(predictionHistory, options);
    setOptions(next);
  };

  const hasEnoughData = stats.totalVerified >= 5;

  const hitRatePct = stats.totalVerified > 0 ? Math.round(stats.overallHitRate * 100) : null;
  const isAboveRandom = stats.overallHitRate >= 0.65;

  return (
    <div className="panel border-cyan-400/20">
      {/* 折叠头部 */}
      <button
        className="panel-header w-full justify-between hover:bg-white/[0.02]"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-cyan-300">
            <Target className="h-4 w-4" /> 杀号命中率
          </span>
          {/* 折叠态的精简指标 */}
          {hitRatePct !== null ? (
            <span
              className={`text-sm font-bold ${
                isAboveRandom ? "text-green-400" : "text-amber-400"
              }`}
            >
              {hitRatePct}%
              {pendingCount > 0 && (
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-normal text-amber-300">
                  {pendingCount} 待验证
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-slate-500">暂无数据</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && hasEnoughData && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAutoAdjust();
              }}
              className="flex items-center gap-1 rounded bg-gold-400/10 px-2 py-1 text-xs text-gold-300 hover:bg-gold-400/20"
            >
              <RefreshCw className="h-3 w-3" /> 自动调权
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* 折叠内容 */}
      {!collapsed && (
        <div className="space-y-4 p-4">
          {/* 总体命中率大数字 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gold-400/20 bg-gold-400/5 p-3 text-center">
              <div className="text-2xl font-bold text-gold-300">
                {hitRatePct ?? "--"}
                <span className="text-sm">%</span>
              </div>
              <div className="text-xs text-slate-500">近1000期命中率</div>
              <div className="mt-0.5 text-[10px] text-slate-600">{stats.totalVerified} 次验证</div>
            </div>
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-cyan-300">
                {stats.recentCount > 0 ? Math.round(stats.recentHitRate * 100) : "--"}
                {stats.recentCount >= 3 &&
                  (stats.recentHitRate >= stats.overallHitRate ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ))}
              </div>
              <div className="text-xs text-slate-500">近10期命中率</div>
              <div className="mt-0.5 text-[10px] text-slate-600">{stats.recentCount} 条样本</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-2xl font-bold text-slate-300">
                {stats.totalVerified > 0
                  ? (stats.overallHitRate * (2 / 11) + (1 - stats.overallHitRate) * (9 / 11)).toFixed(2)
                  : "--"}
              </div>
              <div className="text-xs text-slate-500">综合预期值</div>
              <div className="mt-0.5 text-[10px] text-slate-600">vs 随机基准 0.82</div>
            </div>
          </div>

          {/* 连中 / 连挂 统计行 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-green-400/20 bg-green-400/5 p-3 text-center">
              <div className={`text-2xl font-bold ${stats.currentWinStreak > 0 ? "text-green-300" : "text-slate-500"}`}>
                {stats.totalVerified > 0 ? stats.currentWinStreak : "--"}
                <span className="text-sm">期</span>
              </div>
              <div className="text-xs text-slate-500">当前连中</div>
              <div className="mt-0.5 text-[10px] text-slate-600">
                {stats.currentWinStreak >= 3 ? <span className="text-green-400">🔥 连中火力</span> : ""}
              </div>
            </div>
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-center">
              <div className={`text-2xl font-bold ${stats.currentLoseStreak > 0 ? "text-red-300" : "text-slate-500"}`}>
                {stats.totalVerified > 0 ? stats.currentLoseStreak : "--"}
                <span className="text-sm">期</span>
              </div>
              <div className="text-xs text-slate-500">当前连挂</div>
              <div className="mt-0.5 text-[10px] text-slate-600">
                {stats.currentLoseStreak >= 3 ? <span className="text-red-400">⚠️ 警惕</span> : ""}
              </div>
            </div>
            <div className="rounded-lg border border-green-400/10 bg-green-400/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-green-200/80">
                {stats.maxWinStreak > 0 ? stats.maxWinStreak : "--"}
                <span className="text-sm">期</span>
              </div>
              <div className="text-xs text-slate-500">历史最长连中</div>
            </div>
            <div className="rounded-lg border border-red-400/10 bg-red-400/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-red-200/80">
                {stats.maxLoseStreak > 0 ? stats.maxLoseStreak : "--"}
                <span className="text-sm">期</span>
              </div>
              <div className="text-xs text-slate-500">历史最长连挂</div>
            </div>
          </div>

          {/* 基准说明 */}
          {stats.totalVerified > 0 && (
            <div className="rounded-lg bg-white/5 p-2.5 text-xs text-slate-400">
              💡 <span className="text-slate-300">随机杀号基准：</span>
              从11个号里随机杀2个，两个都不出的概率是
              C(9,2)/C(11,2) = <span className="text-slate-200">0.65（65%）</span>。
              你的命中率
              <span className={isAboveRandom ? "text-green-400" : "text-red-400"}>
                {" "}{hitRatePct}%
              </span>
              {isAboveRandom ? " 高于" : " 低于"} 随机水平。
            </div>
          )}

          {/* 各方法单独命中率 - 始终显示全部7个 */}
          <div>
            <div className="mb-2 text-xs text-slate-500">各方法命中率</div>
            <div className="space-y-1.5">
              {METHOD_LIST.map((meta) => {
                const m = mergedPerMethod[meta.name] ?? { hit: 0, total: 0, rate: 0, source: "backtest" as const };
                const rate = m.rate;
                const barColor =
                  rate >= 0.65
                    ? "bg-green-400"
                    : rate >= 0.5
                      ? "bg-cyan-400"
                      : m.total > 0
                        ? "bg-amber-400"
                        : "bg-white/10";
                return (
                  <div key={meta.key} className="flex items-center gap-2 text-xs" title={meta.desc}>
                    <span className="w-16 shrink-0 text-slate-300">
                      {meta.name}
                      {m.source === "backtest" && (
                        <span className="ml-1 text-[9px] text-slate-600">回测</span>
                      )}
                    </span>
                    <div className="flex-1 rounded bg-white/5">
                      <div
                        className={`h-2 rounded ${barColor} transition-all`}
                        style={{ width: `${Math.round(rate * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-slate-400">
                      {m.total > 0 ? `${Math.round(rate * 100)}% (${m.hit}/${m.total})` : "--"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 最近一条验证结果 */}
          {latestVerified && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs">
                {latestVerified.hit ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className={latestVerified.hit ? "text-green-400" : "text-red-400"}>
                  最近验证：期号 {latestVerified.targetIssue} —{" "}
                  {latestVerified.hit ? "杀号命中 ✓" : "杀号失败 ✗"}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                杀的：
                <span className="ml-1 font-mono text-kill">
                  {latestVerified.killNumbers.sort((a, b) => a - b).join(", ")}
                </span>
                <span className="mx-2">|</span>
                开奖：
                <span className="ml-1 font-mono text-slate-300">
                  {latestVerified.actualNumbers?.sort((a, b) => a - b).join(", ")}
                </span>
                <span className="mx-2">|</span>
                方法：
                <span className="ml-1 text-cyan-400">{latestVerified.methods.join(" ")}</span>
              </div>
            </div>
          )}

          {stats.totalVerified === 0 && (
            <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-xs text-slate-500">
              还没有预测记录。<br />
              进入看板页，每次刷新杀号推荐时会自动保存预测；
              下一期开奖数据录入后自动验证命中率。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
