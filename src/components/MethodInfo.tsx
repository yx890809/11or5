// 杀号方法说明
import { BookOpen } from "lucide-react";
import { METHOD_LIST } from "@/types";

export default function MethodInfo() {
  return (
    <div className="panel">
      <div className="panel-header">
        <BookOpen className="h-4 w-4 text-cyan-400" /> 杀号方法说明
      </div>
      <div className="space-y-3 p-4 text-sm">
        {METHOD_LIST.map((m, i) => (
          <div key={m.key} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/15 font-mono text-[11px] text-gold-300 ring-1 ring-gold-400/30">
              {i + 1}
            </span>
            <div>
              <div className="font-medium text-slate-200">{m.name}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
