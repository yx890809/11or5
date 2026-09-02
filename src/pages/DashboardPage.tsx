// 分析看板页
import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Database, Sparkles, Cpu, RefreshCw, KeyRound } from "lucide-react";
import { useLotteryStore } from "@/store";
import { computeStats, recommend, autoAdjustWeights, backtestAndOptimize } from "@/lib/analyzer";
import { fetchThai11x5, getThaiToken, setThaiToken, getThaiTokenExpiry } from "@/lib/api";
import type { BacktestResult } from "@/lib/analyzer";
import { METHOD_LIST } from "@/types";
import KillCard from "@/components/KillCard";
import BetSlipCard from "@/components/BetSlipCard";
import QuickAddCard from "@/components/QuickAddCard";
import HitRateCard from "@/components/HitRateCard";
import FreqChart from "@/components/FreqChart";
import OmitTable from "@/components/OmitTable";
import HistoryTable from "@/components/HistoryTable";
import MethodInfo from "@/components/MethodInfo";
import ParamPanel from "@/components/ParamPanel";

/** 从期号推下一期期号 */
function nextIssue(prev: string): string {
  if (!prev) return "";
  const digits = prev.replace(/\D/g, "");
  if (!digits) return prev;
  const match = digits.match(/^(\d+?)(\d{3,4})$/);
  if (match) {
    const prefix = match[1];
    const tail = match[2];
    const nextNum = Number(tail) + 1;
    return prefix + String(nextNum).padStart(tail.length, "0");
  }
  return String(Number(digits) + 1);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const records = useLotteryStore((s) => s.records);
  const options = useLotteryStore((s) => s.options);
  const savePrediction = useLotteryStore((s) => s.savePrediction);
  const predictionHistory = useLotteryStore((s) => s.predictionHistory);
  const setOptions = useLotteryStore((s) => s.setOptions);
  const clearRecords = useLotteryStore((s) => s.clearRecords);
  const appendRecord = useLotteryStore((s) => s.appendRecord);

  // AI 进化状态
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiResult, setAiResult] = useState<BacktestResult | null>(null);
  const [aiError, setAiError] = useState("");

  // 内置拉取状态
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 泰国分分11选5凭证状态
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSavedAt, setTokenSavedAt] = useState(0); // 触发重渲染显示有效期

  /** 一键拉取泰国分分11选5开奖数据 */
  const fetchLatest = async () => {
    setFetchLoading(true);
    setFetchMsg(null);
    try {
      const res = await fetchThai11x5();
      if (!res.ok || !res.data) {
        setFetchMsg({ type: "err", text: res.error || "拉取失败" });
        return;
      }
      const existingIssues = new Set(records.map((r) => r.issue));
      let newCount = 0;
      for (const rec of res.data) {
        if (!existingIssues.has(rec.issue)) {
          appendRecord({ issue: rec.issue, numbers: rec.numbers });
          newCount++;
        }
      }
      if (newCount === 0) {
        setFetchMsg({ type: "ok", text: `已是最新（${res.data.length} 期全部已存在）` });
      } else {
        setFetchMsg({ type: "ok", text: `新增 ${newCount} 期（泰国分分11选5）` });
      }
    } catch (e) {
      setFetchMsg({ type: "err", text: (e as Error).message || "未知错误" });
    } finally {
      setFetchLoading(false);
      setTimeout(() => setFetchMsg(null), 4000);
    }
  };

  /** 打开凭证设置弹窗 */
  const openTokenModal = () => {
    setTokenInput(getThaiToken());
    setTokenModalOpen(true);
  };

  /** 保存凭证 */
  const saveToken = () => {
    setThaiToken(tokenInput);
    setTokenSavedAt(Date.now());
    setTokenModalOpen(false);
    setFetchMsg({ type: "ok", text: "凭证已保存" });
    setTimeout(() => setFetchMsg(null), 3000);
  };

  const runAiOptimize = () => {
    if (records.length < 15) {
      setAiError("至少需要 15 条历史数据才能启动 AI 进化");
      return;
    }
    setAiRunning(true);
    setAiError("");
    setAiResult(null);
    // 用 setTimeout 让 UI 先渲染出 loading 状态
    setTimeout(() => {
      try {
        const result = backtestAndOptimize(records, options, (done, total) => {
          setAiProgress(Math.round((done / total) * 100));
        });
        setAiResult(result);
        // 自动应用最优权重
        if (result.bestHitRate > 0) {
          setOptions(result.bestOptions);
        }
      } catch (e) {
        setAiError("AI 进化失败: " + (e as Error).message);
      } finally {
        setAiRunning(false);
      }
    }, 50);
  };

  // 自动 AI 进化：每次有新开奖数据来了，静默后台跑一次回测调权重
  const lastAutoIssueRef = useRef<string>("");
  useEffect(() => {
    if (records.length < 15) return;
    const latest = records[records.length - 1];
    if (!latest) return;
    // 同一期号不重复进化（参数调整/页面刷新时不触发）
    if (latest.issue === lastAutoIssueRef.current) return;
    lastAutoIssueRef.current = latest.issue;

    // 后台静默跑，不阻塞 UI
    setTimeout(() => {
      try {
        const result = backtestAndOptimize(records, options);
        if (result.bestHitRate > 0) {
          setOptions(result.bestOptions);
          setAiResult(result); // 更新一下 UI 上显示的最优权重
        }
      } catch {
        // 静默忽略自动进化的错误，不打扰用户
      }
    }, 200);
  }, [records, setOptions]);

  const result = useMemo(() => {
    if (records.length === 0) return null;
    const stats = computeStats(records, options.window);
    const recommendation = recommend(records, options);
    return { stats, recommendation };
  }, [records, options]);

  // 自动保存预测：每次 recommendation 变化（首次加载/参数调整/数据变更）
  // 都保存一条预测记录，用于下次开奖后验证命中率
  const savedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!result || records.length === 0) return;
    const latest = records[records.length - 1];
    const targetIssue = nextIssue(latest.issue);
    const r = result.recommendation;
    // 避免重复保存完全相同的预测
    const key = `${targetIssue}|${r.killNumbers.join(",")}|${options.window}|${JSON.stringify(options.weights)}`;
    if (savedKeyRef.current === key) return;
    savedKeyRef.current = key;

    // 构建每个被杀号对应的方法映射（精确到号码）
    const killMethods: Record<number, string[]> = {};
    for (const num of r.killNumbers) {
      const detail = r.details.find((d) => d.num === num);
      if (detail && detail.methods.length > 0) {
        killMethods[num] = detail.methods;
      } else if (detail) {
        // 兜底：如果这个号没触发任何方法名（score全靠权重加分），
        // 就从它的分数字段里找出得分>0的方法来反推
        const allMethodNames = METHOD_LIST.map((m) => m.name);
        const scoreMap: Record<string, number> = {
          "冷热法": detail.hotScore,
          "极限法": detail.limitScore,
          "首尾差法": detail.headTailScore,
          "遗漏法": detail.omitScore,
          "重号法": detail.repeatScore || 0,
          "邻号法": detail.neighborScore || 0,
          "和值法": detail.sumScore || 0,
        };
        const matched = allMethodNames.filter((n) => (scoreMap[n] || 0) > 0);
        if (matched.length > 0) {
          killMethods[num] = matched;
        }
      }
    }

    const allMethods = Array.from(new Set(Object.values(killMethods).flat()));

    savePrediction({
      targetIssue,
      killNumbers: r.killNumbers,
      methods: allMethods,
      killMethods,
    });
  }, [result, records, options, savePrediction]);

  // 后台AI自动调权：每当有新的验证结果出现时，自动微调权重
  const verifiedCountRef = useRef(0);
  useEffect(() => {
    const verified = predictionHistory.filter((p) => p.hit !== undefined).length;
    // 首次加载跳过，只在验证数量增加时触发
    if (verifiedCountRef.current === 0) {
      verifiedCountRef.current = verified;
      return;
    }
    if (verified > verifiedCountRef.current) {
      verifiedCountRef.current = verified;
      // 有新验证 → 自动调权
      const next = autoAdjustWeights(predictionHistory, options);
      // 只在权重真的有变化时才 set
      const changed = (Object.keys(next.weights) as (keyof typeof next.weights)[]).some(
        (k) => Math.abs(next.weights[k] - options.weights[k]) > 0.001,
      );
      if (changed) {
        setOptions(next);
      }
    }
  }, [predictionHistory, options, setOptions]);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <Database className="h-8 w-8 text-slate-500" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-200">暂无开奖数据</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          点下面的按钮直接从内置开奖源拉取最新数据，或手动录入历史号码
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button className="btn-gold" onClick={fetchLatest} disabled={fetchLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${fetchLoading ? "animate-spin" : ""}`} />
            {fetchLoading ? "拉取中..." : "一键拉取最新开奖"}
          </button>
          <button
            className="btn-outline"
            onClick={() => navigate("/")}
          >
            <Database className="mr-2 h-4 w-4" /> 手动录入
          </button>
        </div>
        {fetchMsg && (
          <p className={`mt-4 text-xs font-mono ${fetchMsg.type === "ok" ? "text-green-400" : "text-kill"}`}>
            {fetchMsg.text}
          </p>
        )}
      </div>
    );
  }

  const { stats, recommendation } = result;
  const latest = records[records.length - 1];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
            分析看板
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            最新一期 <span className="font-mono text-cyan-400">{latest?.issue}</span> · 共 {records.length} 条记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 一键拉取泰国分分11选5 */}
          <button
            className="btn-gold inline-flex items-center gap-1.5 text-xs"
            onClick={fetchLatest}
            disabled={fetchLoading}
            title="从 srth9u.xyz 拉取泰国分分11选5最新开奖数据"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetchLoading ? "animate-spin" : ""}`} />
            {fetchLoading ? "拉取中..." : "一键拉取最新开奖"}
          </button>

          {/* 凭证设置 */}
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-300 hover:bg-white/[0.06]"
            onClick={openTokenModal}
            title="配置泰国分分11选5数据源访问凭证"
          >
            <KeyRound className="h-3.5 w-3.5 text-gold-400" />
            {(() => {
              const tk = getThaiToken();
              if (!tk) return "未配置";
              const exp = getThaiTokenExpiry(tk);
              if (!exp) return "已配置";
              const days = (exp - Date.now()) / 86400000;
              if (days <= 0) return "已过期";
              return `${Math.floor(days)}天后到期`;
            })()}
          </button>

          {/* 提示消息 */}
          {fetchMsg && (
            <span
              className={`text-xs font-mono ${
                fetchMsg.type === "ok" ? "text-green-400" : "text-kill"
              }`}
            >
              {fetchMsg.text}
            </span>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
            <TrendingUp className="h-4 w-4 text-warm" />
            统计窗口 {options.window} 期
          </div>
        </div>
      </header>

      {/* 1. 顶部：杀号推荐卡 + 投注号码卡 并排 */}
      <div className="mb-4 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <KillCard recommendation={recommendation} stats={stats} records={records} />
        <BetSlipCard killNumbers={recommendation.killNumbers} />
      </div>

      {/* 2. 快速追加：独立长条形，恢复原位 */}
      <div className="mb-4">
        <QuickAddCard latestIssue={latest?.issue} />
      </div>

      {/* 3. 中间三栏并排：历史开奖 | AI进化 | 参数调节 */}
      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 历史开奖（左） */}
        <HistoryTable
          records={records}
          stats={stats}
          killNumbers={recommendation.killNumbers}
          onClear={clearRecords}
        />

        {/* AI 策略进化（中） */}
        <div className="panel">
          <div className="panel-header">
            <Cpu className="h-4 w-4 text-gold-400" /> AI 策略进化
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-slate-400">
              用历史数据跑网格回测，自动寻找最优权重组合，让策略不断进化。
            </p>
            <button
              className="btn-gold w-full"
              onClick={runAiOptimize}
              disabled={aiRunning || records.length < 15}
            >
              {aiRunning ? (
                <>
                  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-void-950 border-t-transparent" />
                  进化中 {aiProgress}%
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {records.length < 15 ? "需 15+ 条数据" : "启动 AI 进化"}
                </>
              )}
            </button>

            {/* 进度条 */}
            {aiRunning && (
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all"
                  style={{ width: `${aiProgress}%` }}
                />
              </div>
            )}

            {/* 错误 */}
            {aiError && (
              <div className="rounded border border-kill/30 bg-kill/10 px-2 py-1.5 text-xs text-kill">
                {aiError}
              </div>
            )}

            {/* 结果 */}
            {aiResult && !aiRunning && (
              <div className="space-y-2 rounded-lg border border-gold-400/20 bg-gold-400/5 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">回测命中率</span>
                  <span className="font-mono text-lg font-bold text-gold-300">
                    {(aiResult.bestHitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  测试 {aiResult.tested}/{aiResult.totalTests} 组权重
                </div>
                <div className="border-t border-white/10 pt-2">
                  <div className="mb-1 text-slate-400">最优权重：</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px]">
                    {METHOD_LIST.map((m) => {
                      const key = m.key as keyof typeof aiResult.bestOptions.weights;
                      const v = aiResult.bestOptions.weights[key] ?? 0;
                      return (
                        <span key={m.key} className="flex justify-between">
                          <span className="text-slate-500">{m.name.slice(0, 4)}</span>
                          <span className="text-cyan-400">{v.toFixed(2)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-1 text-[10px] text-green-400">✓ 已自动应用到参数面板</div>
              </div>
            )}
          </div>
        </div>

        {/* 参数调节（右） — 叠加命中率卡 */}
        <div className="space-y-6">
          <ParamPanel defaultCollapsed />
          <HitRateCard defaultCollapsed />
        </div>
      </div>

      {/* 4. 底部：冷热图 + 预测历史 + 遗漏表 + 方法说明 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* 冷热频次（占 2 列） */}
        <div className="lg:col-span-2 space-y-6">
          <FreqChart stats={stats} />

          {/* 预测历史 */}
          {predictionHistory.length > 0 ? (
            <div className="panel">
              <div className="panel-header">
                预测历史（最近 {Math.min(predictionHistory.length, 50)} 条，共 {predictionHistory.length} 条）
              </div>

              {/* 桌面端：表格 */}
              <div className="hidden md:block max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-void-950 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-normal">目标期号</th>
                      <th className="px-3 py-2 text-left font-normal">杀号</th>
                      <th className="px-3 py-2 text-left font-normal">命中方法</th>
                      <th className="px-3 py-2 text-left font-normal">开奖号码</th>
                      <th className="px-3 py-2 text-center font-normal">结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...predictionHistory].reverse().slice(0, 50).map((p, i) => (
                      <tr
                        key={i}
                        className="border-t border-white/5 hover:bg-white/[0.02]"
                      >
                        <td className="px-3 py-2 font-mono text-slate-300">{p.targetIssue}</td>
                        <td className="px-3 py-2 font-mono text-kill">
                          {p.killNumbers.sort((a, b) => a - b).join(", ")}
                        </td>
                        <td className="px-3 py-2 text-cyan-400">{p.methods.join(" ")}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {p.actualNumbers ? p.actualNumbers.sort((a, b) => a - b).join(", ") : "--"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {p.hit === undefined ? (
                            <span className="text-amber-400">待验证</span>
                          ) : p.hit ? (
                            <span className="text-green-400">✓ 命中</span>
                          ) : (
                            <span className="text-red-400">✗ 失败</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 手机端：卡片列表 */}
              <div className="md:hidden max-h-[520px] space-y-2 overflow-y-auto">
                {[...predictionHistory].reverse().slice(0, 50).map((p, i) => (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-slate-400">{p.targetIssue}</span>
                      {p.hit === undefined ? (
                        <span className="text-xs text-amber-400">待验证</span>
                      ) : p.hit ? (
                        <span className="text-xs text-green-400">✓ 命中</span>
                      ) : (
                        <span className="text-xs text-red-400">✗ 失败</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">杀号</span>
                      <span className="font-mono text-kill font-bold">
                        {p.killNumbers.sort((a, b) => a - b).join(" ")}
                      </span>
                      <span className="text-slate-600 mx-1">|</span>
                      <span className="text-slate-500">开奖</span>
                      <span className="font-mono text-slate-300">
                        {p.actualNumbers ? p.actualNumbers.sort((a, b) => a - b).join(" ") : "--"}
                      </span>
                    </div>
                    {p.methods.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-cyan-500 flex flex-wrap gap-1">
                        {p.methods.map((m, j) => (
                          <span key={j} className="rounded bg-cyan-400/10 px-1.5 py-0.5">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* 遗漏表 + 方法说明（2列） */}
        <div className="lg:col-span-2 space-y-6">
          <OmitTable stats={stats} />
          <MethodInfo />
        </div>
      </div>

      {/* 凭证设置弹窗 */}
      {tokenModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setTokenModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/10 bg-void-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gold-400" />
              <h3 className="font-display text-base font-bold text-slate-100">
                泰国分分11选5 · 数据源凭证
              </h3>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-slate-400">
              <p>
                粘贴登录 <span className="font-mono text-cyan-400">srth9u.xyz</span> 后的访问凭证（Token），
                程序即可自动拉取最新开奖数据。
              </p>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-1 font-bold text-slate-300">获取方法（浏览器 F12 三步）：</div>
                <ol className="list-decimal space-y-0.5 pl-4">
                  <li>登录 srth9u.xyz 后按 <span className="font-mono text-cyan-400">F12</span> 打开开发者工具</li>
                  <li>切到 <span className="font-mono text-cyan-400">Console</span>（控制台）标签</li>
                  <li>输入 <span className="font-mono text-cyan-400 break-all">JSON.parse(localStorage.AUTH)</span> 回车，复制输出结果（含引号内全部内容）粘贴到下面</li>
                </ol>
              </div>
              <textarea
                className="h-24 w-full resize-none rounded-lg border border-white/10 bg-void-950 p-3 font-mono text-[11px] text-slate-200 outline-none focus:border-gold-400/50"
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              {tokenInput && (() => {
                const exp = getThaiTokenExpiry(tokenInput);
                if (!exp) return <p className="text-amber-400">⚠ 无法识别有效期（可能不是有效凭证）</p>;
                const days = (exp - Date.now()) / 86400000;
                return days > 0 ? (
                  <p className="text-green-400">✓ 凭证有效，{exp > 0 && `有效期至 ${new Date(exp).toLocaleString("zh-CN")}`}</p>
                ) : (
                  <p className="text-kill">✗ 凭证已过期，请重新获取</p>
                );
              })()}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  className="rounded-lg border border-white/10 px-4 py-2 text-slate-300 hover:bg-white/[0.06]"
                  onClick={() => setTokenModalOpen(false)}
                >
                  取消
                </button>
                <button className="btn-gold" onClick={saveToken} disabled={!tokenInput.trim()}>
                  保存凭证
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
