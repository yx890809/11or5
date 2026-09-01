// 参数调节面板
import { SlidersHorizontal } from "lucide-react";
import type { AnalyzerOptions } from "@/types";
import { useLotteryStore } from "@/store";

const WEIGHT_LABELS: { key: keyof AnalyzerOptions["weights"]; label: string }[] = [
  { key: "hotCold", label: "冷热法" },
  { key: "repeat", label: "重号法" },
  { key: "limit", label: "极限法" },
  { key: "headTail", label: "首尾差法" },
  { key: "omit", label: "遗漏法" },
  { key: "neighbor", label: "邻号法" },
  { key: "sum", label: "和值法" },
];

export default function ParamPanel() {
  const options = useLotteryStore((s) => s.options);
  const setWindow = useLotteryStore((s) => s.setWindow);
  const setWeight = useLotteryStore((s) => s.setWeight);
  const setOptions = useLotteryStore((s) => s.setOptions);

  return (
    <div className="panel">
      <div className="panel-header">
        <SlidersHorizontal className="h-4 w-4 text-gold-400" /> 参数调节
      </div>
      <div className="space-y-4 p-4">
        {/* 杀号数量 + 共识门槛 两个新参数 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">杀号数量</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setOptions({ ...options, killCount: n })}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-mono transition ${
                    options.killCount === n
                      ? "bg-gold-400 text-void-950 font-bold"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                  title={n === 1 ? "理论正确率 55%" : n === 2 ? "理论正确率 27%" : "理论正确率 12%"}
                >
                  {n}个
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">共识门槛</span>
              <span className="font-mono text-gold-300">{options.consensusMin}/7</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={options.consensusMin}
              onChange={(e) =>
                setOptions({ ...options, consensusMin: Number(e.target.value) })
              }
              className="w-full accent-gold-400"
            />
          </div>
        </div>

        {/* 窗口 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-400">统计窗口期数</span>
            <span className="font-mono text-gold-300">{options.window}</span>
          </div>
          <input
            type="range"
            min={5}
            max={Math.max(60, options.window)}
            step={5}
            value={options.window}
            onChange={(e) => setWindow(Number(e.target.value))}
            className="w-full accent-gold-400"
          />
        </div>

        {/* 权重 */}
        <div className="space-y-3">
          {WEIGHT_LABELS.map((w) => (
            <div key={w.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-400">{w.label}权重</span>
                <span className="font-mono text-gold-300">
                  {options.weights[w.key].toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={options.weights[w.key]}
                onChange={(e) => setWeight(w.key, Number(e.target.value))}
                className="w-full accent-gold-400"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
