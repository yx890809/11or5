// 分析看板页
import { useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Database } from "lucide-react";
import { useLotteryStore } from "@/store";
import { computeStats, recommend, autoAdjustWeights } from "@/lib/analyzer";
import { METHOD_LIST } from "@/types";
import KillCard from "@/components/KillCard";
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
          请先在数据接入页输入外部开奖数据链接，或手动录入历史号码后再来查看杀号分析
        </p>
        <button className="btn-gold mt-6" onClick={() => navigate("/")}>
          <Database className="h-4 w-4" /> 去接入数据
        </button>
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
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          <TrendingUp className="h-4 w-4 text-warm" />
          统计窗口 {options.window} 期
        </div>
      </header>

      {/* 杀号推荐卡 + 命中率卡 并排 */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <KillCard recommendation={recommendation} stats={stats} />
        <HitRateCard />
      </div>

      {/* 快速追加最新一期 */}
      <div className="mb-6">
        <QuickAddCard latestIssue={latest?.issue} />
      </div>

      {/* 主体网格 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FreqChart stats={stats} />
          <HistoryTable
            records={records}
            stats={stats}
            killNumbers={recommendation.killNumbers}
          />
        </div>
        <div className="space-y-6">
          <ParamPanel />
          <OmitTable stats={stats} />
          <MethodInfo />
        </div>
      </div>

      {/* 预测历史（调试/展示用） */}
      {predictionHistory.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 text-sm font-medium text-slate-400">
            预测历史（最近 10 条）
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-normal">目标期号</th>
                  <th className="px-3 py-2 text-left font-normal">杀号</th>
                  <th className="px-3 py-2 text-left font-normal">命中方法</th>
                  <th className="px-3 py-2 text-left font-normal">开奖号码</th>
                  <th className="px-3 py-2 text-center font-normal">结果</th>
                </tr>
              </thead>
              <tbody>
                {[...predictionHistory].reverse().slice(0, 10).map((p, i) => (
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
        </div>
      )}
    </div>
  );
}
