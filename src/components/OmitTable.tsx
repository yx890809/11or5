// 遗漏与连开统计表
import { Hourglass, Repeat } from "lucide-react";
import type { NumberStat } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  stats: NumberStat[];
}

export default function OmitTable({ stats }: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <Hourglass className="h-4 w-4 text-cyan-400" /> 遗漏 / 连开
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-medium">号码</th>
              <th className="px-3 py-2 text-right font-medium">当前遗漏</th>
              <th className="px-3 py-2 text-right font-medium">历史最大</th>
              <th className="px-3 py-2 text-right font-medium">连开</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {stats.map((s) => {
              const extreme = s.maxOmit > 0 && s.currentOmit >= s.maxOmit * 0.9;
              const hot = s.consecutive >= 5;
              return (
                <tr key={s.num} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <span className="text-slate-300">{String(s.num).padStart(2, "0")}</span>
                  </td>
                  <td className={cn("px-3 py-2 text-right", extreme ? "text-cyan-400" : "text-slate-400")}>
                    {s.currentOmit}
                    {extreme && <span className="ml-1 text-[10px]">极</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{s.maxOmit}</td>
                  <td className={cn("px-3 py-2 text-right", hot ? "text-kill" : "text-slate-400")}>
                    <span className="inline-flex items-center gap-1">
                      {s.consecutive}
                      {hot && <Repeat className="h-3 w-3" />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
