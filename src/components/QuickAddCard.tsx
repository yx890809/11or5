// 快速追加最新一期开奖号码
import { useState, useMemo } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { useLotteryStore } from "@/store";
import { sortRecords } from "@/lib/analyzer";
import Ball from "./Ball";

interface Props {
  latestIssue?: string;
}

/** 尝试从期号中提取末尾数字并 +1 */
function suggestNextIssue(prev: string): string {
  if (!prev) return "";
  const digits = prev.replace(/\D/g, "");
  if (!digits) return prev;
  // 拆分成前缀 + 末尾递增部分
  const match = digits.match(/^(\d+?)(\d{3,4})$/);
  if (match) {
    const prefix = match[1];
    const tail = match[2];
    const nextNum = Number(tail) + 1;
    return prefix + String(nextNum).padStart(tail.length, "0");
  }
  // 纯数字直接 +1
  return String(Number(digits) + 1);
}

export default function QuickAddCard({ latestIssue }: Props) {
  const appendRecord = useLotteryStore((s) => s.appendRecord);
  const records = useLotteryStore((s) => s.records);

  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState("");

  const numbers = useMemo(() => Array.from({ length: 11 }, (_, i) => i + 1), []);

  const toggle = (n: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < 5) next.add(n);
      return next;
    });
  };

  const handleOpen = () => {
    setIssue(suggestNextIssue(latestIssue || ""));
    setPicked(new Set());
    setOpen(true);
    setToast("");
  };

  const handleSubmit = () => {
    if (!issue.trim()) {
      setToast("请填写期号");
      return;
    }
    if (picked.size !== 5) {
      setToast(`请选满 5 个号码（当前 ${picked.size}）`);
      return;
    }
    const sorted = sortRecords(records);
    const duplicates = sorted.find((r) => r.issue === issue.trim());
    appendRecord({
      issue: issue.trim(),
      numbers: Array.from(picked).sort((a, b) => a - b),
    });
    setOpen(false);
    setToast(duplicates ? "已覆盖同期号记录 ✓" : "已追加 ✓");
    setTimeout(() => setToast(""), 2000);
  };

  const reset = () => {
    setPicked(new Set());
    setIssue(suggestNextIssue(latestIssue || ""));
    setToast("");
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gold-400/20 bg-gold-400/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400/20 text-gold-300 ring-1 ring-gold-400/40">
            <Plus className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium text-slate-200">追加最新一期开奖号</div>
            <div className="text-xs text-slate-500">
              {latestIssue ? `上一期：${latestIssue} → 建议期号：${suggestNextIssue(latestIssue)}` : "还没有历史数据"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {toast && (
            <span className="rounded bg-warm/20 px-2.5 py-1 text-xs text-warm">{toast}</span>
          )}
          <button className="btn-gold" onClick={handleOpen}>
            <Plus className="h-4 w-4" /> 快速录入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel border-gold-400/30 ring-1 ring-gold-400/20">
      <div className="panel-header justify-between">
        <span className="flex items-center gap-2 text-gold-300">
          <Plus className="h-4 w-4" /> 追加最新一期
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          收起
        </button>
      </div>
      <div className="space-y-4 p-4">
        {/* 期号 */}
        <div className="flex items-center gap-3">
          <label className="w-16 shrink-0 text-xs text-slate-500">期号</label>
          <input
            className="input-field flex-1 font-mono"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="20260901015"
          />
          {latestIssue && (
            <button
              className="btn-ghost !py-1.5 !px-2.5 text-xs"
              onClick={() => setIssue(suggestNextIssue(latestIssue))}
              title="自动填上一期+1"
            >
              ↵ 用上一期+1
            </button>
          )}
        </div>

        {/* 号码网格 */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">开奖号码（点选 5 个）</span>
            <span className="font-mono text-gold-300">
              已选 {picked.size}/5
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {numbers.map((n) => {
              const selected = picked.has(n);
              const disabled = !selected && picked.size >= 5;
              return (
                <button
                  key={n}
                  onClick={() => toggle(n)}
                  disabled={disabled}
                  className={`ball h-8 w-8 text-xs md:h-10 md:w-10 md:text-sm transition ${
                    selected
                      ? "bg-gold-400 text-void-900 ring-2 ring-gold-300"
                      : disabled
                        ? "bg-white/5 text-slate-600 ring-1 ring-white/10"
                        : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:ring-cyan-400/40"
                  }`}
                >
                  {String(n).padStart(2, "0")}
                </button>
              );
            })}
          </div>
          {/* 已选预览 */}
          {picked.size > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              已选：
              {Array.from(picked)
                .sort((a, b) => a - b)
                .map((n) => (
                  <Ball key={n} num={n} size="sm" variant="gold" />
                ))}
            </div>
          )}
        </div>

        {/* 按钮 */}
        {toast && (
          <div className="rounded-lg border border-kill/30 bg-kill/10 px-3 py-1.5 text-xs text-kill">
            {toast}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={reset}>
            <Trash2 className="h-4 w-4" /> 重选
          </button>
          <button className="btn-gold" onClick={handleSubmit} disabled={picked.size !== 5 || !issue.trim()}>
            <Check className="h-4 w-4" /> 确认追加
          </button>
        </div>
      </div>
    </div>
  );
}
