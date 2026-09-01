// 定位胆分析看板
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, Target, Settings, Sparkles, History, TrendingUp } from "lucide-react";
import { useLotteryStore } from "@/store";
import { computeStats, recommendDan, quickBacktestDan } from "@/lib/analyzer";
import { DAN_METHOD_LIST } from "@/types";

export default function DanPanPage() {
  const navigate = useNavigate();
  const records = useLotteryStore((s) => s.records);
  const [danCount, setDanCount] = useState(2); // 用户可选择定几个胆
  const [window, setWindow] = useState(30);

  const sortedRecords = useMemo(() => [...records].slice(-window), [records, window]);
  const stats = useMemo(() => computeStats(records, window), [records, window]);
  const result = useMemo(() => recommendDan(records, danCount, window), [records, danCount, window]);

  // 定胆历史回测
  const bt = useMemo(
    () => quickBacktestDan(records, danCount, window, 20),
    [records, danCount, window],
  );

  if (!result || result.danNumbers.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <Database className="h-8 w-8 text-slate-500" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-200">暂无开奖数据</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          请先在数据接入页输入外部开奖数据链接，或手动录入历史号码后再来查看定位胆分析
        </p>
        <button className="btn-gold mt-6" onClick={() => navigate("/")}>
          <Database className="h-4 w-4" /> 去接入数据
        </button>
      </div>
    );
  }

  const latest = records[records.length - 1];
  const sortedLatest = [...latest.numbers].sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
            定位胆分析
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            最新一期 <span className="font-mono text-cyan-400">{latest?.issue}</span> · 共 {records.length} 条记录
          </p>
        </div>

        {/* 参数区：定胆数量 + 窗口 */}
        <div className="flex items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gold-400" />
            <span className="text-slate-400">定胆数量</span>
            <select
              className="rounded border border-white/10 bg-void-900 px-2 py-1 text-slate-200 focus:border-gold-400/50 focus:outline-none"
              value={danCount}
              onChange={(e) => setDanCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} 个
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">统计窗口</span>
            <select
              className="rounded border border-white/10 bg-void-900 px-2 py-1 text-slate-200 focus:border-gold-400/50 focus:outline-none"
              value={window}
              onChange={(e) => setWindow(Number(e.target.value))}
            >
              {[10, 20, 30, 50].map((w) => (
                <option key={w} value={w}>
                  {w} 期
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 胆码推荐卡 */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="panel">
          <div className="panel-header">
            <Sparkles className="h-4 w-4 text-gold-300" /> 下一期胆码推荐
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center gap-6">
              {result.danNumbers.map((num, idx) => (
                <div key={num} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400/80 to-amber-500 text-2xl font-bold text-void-950 shadow-lg shadow-gold-400/30 ring-2 ring-gold-300"
                      style={{
                        animation: "pulse 2s ease-in-out infinite",
                        animationDelay: `${idx * 0.2}s`,
                      }}
                    >
                      {String(num).padStart(2, "0")}
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-void-900 text-xs font-bold text-gold-300 ring-1 ring-gold-400/40">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">综合评分</div>
                    <div className="font-mono text-sm font-bold text-cyan-400">
                      {result.allScores.find((s) => s.num === num)?.score.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 命中的定胆方法 */}
            <div className="mt-6 border-t border-white/5 pt-4">
              <div className="mb-2 text-xs text-slate-400">
                推荐胆码命中的定胆方法：
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.danNumbers.flatMap((num) => {
                  const detail = result.allScores.find((s) => s.num === num);
                  return (detail?.methods || []).map((m) => (
                    <span
                      key={`${num}-${m}`}
                      className="rounded bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-300 ring-1 ring-cyan-400/20"
                    >
                      {String(num).padStart(2, "0")} · {m}
                    </span>
                  ));
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 全部号码评分排序 */}
        <div className="panel">
          <div className="panel-header">所有号码胆码评分排序</div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2">
              {result.allScores.map((d, idx) => {
                const isDan = result.danNumbers.includes(d.num);
                const maxScore = Math.max(...result.allScores.map((s) => s.score));
                const pct = maxScore > 0 ? (d.score / maxScore) * 100 : 0;
                return (
                  <div
                    key={d.num}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                      isDan
                        ? "border-gold-400/40 bg-gold-400/5"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isDan
                          ? "bg-gold-400 text-void-950"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`w-8 font-mono text-lg font-bold ${
                        isDan ? "text-gold-300" : "text-slate-300"
                      }`}
                    >
                      {String(d.num).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isDan
                                ? "bg-gradient-to-r from-gold-400 to-amber-300"
                                : "bg-cyan-500/60"
                            }`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-sm text-slate-400">
                          {d.score.toFixed(0)}
                        </span>
                      </div>
                      {d.methods.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.methods.slice(0, 4).map((m) => (
                            <span
                              key={m}
                              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                            >
                              {m}
                            </span>
                          ))}
                          {d.methods.length > 4 && (
                            <span className="text-[10px] text-slate-600">+{d.methods.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 上期开奖 + 定胆方法说明 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 上期开奖展示 */}
        <div className="panel">
          <div className="panel-header">上期开奖</div>
          <div className="p-4">
            <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
              <span>期号：</span>
              <span className="font-mono text-cyan-400">{latest?.issue}</span>
            </div>
            <div className="flex items-center gap-2">
              {sortedLatest.map((n) => (
                <span
                  key={n}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 font-mono text-sm font-bold text-cyan-300 ring-1 ring-cyan-400/30"
                >
                  {String(n).padStart(2, "0")}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <div className="text-slate-500">和值</div>
                <div className="mt-1 font-mono text-lg text-slate-200">
                  {sortedLatest.reduce((a, b) => a + b, 0)}
                </div>
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <div className="text-slate-500">跨度</div>
                <div className="mt-1 font-mono text-lg text-slate-200">
                  {sortedLatest[sortedLatest.length - 1] - sortedLatest[0]}
                </div>
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <div className="text-slate-500">奇偶比</div>
                <div className="mt-1 font-mono text-lg text-slate-200">
                  {sortedLatest.filter((n) => n % 2 === 1).length}:
                  {sortedLatest.filter((n) => n % 2 === 0).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 定胆方法说明 */}
        <div className="panel">
          <div className="panel-header">11 种定胆方法说明</div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto p-4 text-xs">
            {DAN_METHOD_LIST.map((m, i) => (
              <div key={m.key} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 font-mono text-[11px] text-cyan-300 ring-1 ring-cyan-400/30">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-200">{m.name}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500 break-words">
                    {m.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 历史定胆命中率 */}
      {bt.total > 0 && (
        <div className="panel mt-6">
          <div className="panel-header justify-between">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold-300" /> 历史定胆命中率
            </span>
            <span className="text-xs text-slate-500">近 {bt.total} 期回测 · 定 {danCount} 个胆</span>
          </div>

          {/* 三个统计卡片 */}
          <div className="grid grid-cols-3 gap-4 border-b border-white/5 p-4">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
                <TrendingUp className="h-3 w-3" /> 平均单胆命中率
              </div>
              <div className={`mt-1 font-mono text-2xl font-bold ${
                bt.avgHitRate >= 0.4 ? "text-green-400" : bt.avgHitRate >= 0.25 ? "text-amber-400" : "text-red-400"
              }`}>
                {(bt.avgHitRate * 100).toFixed(1)}%
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {(bt.avgHitRate * danCount).toFixed(1)}/{danCount} 个胆命中
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-xs text-slate-400">至少中 1 个</div>
              <div className={`mt-1 font-mono text-2xl font-bold ${
                bt.anyHitRate >= 0.6 ? "text-green-400" : bt.anyHitRate >= 0.4 ? "text-amber-400" : "text-red-400"
              }`}>
                {(bt.anyHitRate * 100).toFixed(1)}%
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {Math.round(bt.anyHitRate * bt.total)}/{bt.total} 期
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-xs text-slate-400">全中（所有胆码）</div>
              <div className={`mt-1 font-mono text-2xl font-bold ${
                bt.fullHitRate >= 0.3 ? "text-green-400" : bt.fullHitRate >= 0.15 ? "text-amber-400" : "text-red-400"
              }`}>
                {(bt.fullHitRate * 100).toFixed(1)}%
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {Math.round(bt.fullHitRate * bt.total)}/{bt.total} 期
              </div>
            </div>
          </div>

          {/* 每期明细 */}
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-void-800">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2 font-medium">期号</th>
                  <th className="px-4 py-2 font-medium">推荐胆码</th>
                  <th className="px-4 py-2 font-medium">开奖号码</th>
                  <th className="px-4 py-2 font-medium">结果</th>
                  <th className="px-4 py-2 font-medium">命中率</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {bt.details.slice().reverse().map((d) => {
                  const isFullHit = d.hits.length === danCount;
                  const isAnyHit = d.hits.length >= 1;
                  return (
                    <tr key={d.issue} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-xs text-slate-400">{d.issue}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {d.danNumbers.map((n) => (
                            <span
                              key={n}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                d.hits.includes(n)
                                  ? "bg-green-400/20 text-green-300 ring-1 ring-green-400/40"
                                  : "bg-red-400/10 text-red-300 ring-1 ring-red-400/30"
                              }`}
                            >
                              {String(n).padStart(2, "0")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {d.actual.map((n) => (
                            <span
                              key={n}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                                d.danNumbers.includes(n)
                                  ? "bg-green-400/20 text-green-300 font-bold ring-1 ring-green-400/40"
                                  : "bg-white/5 text-slate-400"
                              }`}
                            >
                              {String(n).padStart(2, "0")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] ${
                            isFullHit
                              ? "bg-green-400/15 text-green-300 ring-1 ring-green-400/40"
                              : isAnyHit
                              ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40"
                              : "bg-red-400/10 text-red-400 ring-1 ring-red-400/30"
                          }`}
                        >
                          {isFullHit ? "全中" : isAnyHit ? `中${d.hits.length}个` : "未中"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={`font-bold ${
                            d.hitRate >= 0.5 ? "text-green-400" : d.hitRate > 0 ? "text-amber-400" : "text-red-400"
                          }`}
                        >
                          {(d.hitRate * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
