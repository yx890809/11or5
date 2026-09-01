// 杀号方法说明 - 移动端可折叠
import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { METHOD_LIST } from "@/types";

export default function MethodInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <button
        className="flex w-full items-center justify-between panel-header"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-cyan-400" /> 杀号方法说明
          <span className="md:hidden text-[10px] text-slate-500">(点击展开)</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {/* 桌面端始终展开，移动端默认折叠 */}
      <div className={`space-y-3 p-4 text-sm md:block ${open ? "block" : "hidden"}`}>
        {METHOD_LIST.map((m, i) => (
          <div key={m.key} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/15 font-mono text-[11px] text-gold-300 ring-1 ring-gold-400/30">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-200">{m.name}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-500 break-words">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
