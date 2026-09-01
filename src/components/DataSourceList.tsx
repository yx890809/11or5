// 已保存数据源列表
import { useEffect, useState } from "react";
import { Star, Trash2, Link2, RefreshCw } from "lucide-react";
import type { DataSource } from "@/types";
import * as storage from "@/lib/storage";
import { cn } from "@/lib/utils";

interface Props {
  onUse: (src: DataSource) => void;
}

export default function DataSourceList({ onUse }: Props) {
  const [list, setList] = useState<DataSource[]>([]);

  const refresh = () => setList(storage.listSources());
  useEffect(() => {
    refresh();
  }, []);

  if (list.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
        还没有保存的数据源
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((s) => (
        <div
          key={s.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition",
            s.isDefault
              ? "border-gold-400/40 bg-gold-400/5"
              : "border-white/5 bg-white/[0.02] hover:bg-white/5",
          )}
        >
          <Link2 className="h-4 w-4 shrink-0 text-cyan-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-slate-200">{s.name}</span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                {s.format}
              </span>
            </div>
            <div className="truncate font-mono text-xs text-slate-500">{s.url}</div>
          </div>
          <button
            onClick={() => onUse(s)}
            title="使用此数据源"
            className="rounded p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-cyan-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              storage.setDefault(s.id);
              refresh();
            }}
            title="设为默认"
            className={cn(
              "rounded p-1.5 transition hover:bg-white/10",
              s.isDefault ? "text-gold-300" : "text-slate-500 hover:text-gold-300",
            )}
          >
            <Star className="h-4 w-4" fill={s.isDefault ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => {
              storage.removeSource(s.id);
              refresh();
            }}
            title="删除"
            className="rounded p-1.5 text-slate-500 transition hover:bg-kill/10 hover:text-kill"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
