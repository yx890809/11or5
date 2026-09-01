// 侧边导航
import { NavLink } from "react-router-dom";
import { Database, LayoutDashboard, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "数据接入", icon: Database },
  { to: "/dashboard", label: "分析看板", icon: LayoutDashboard },
];

export default function Sidebar() {
  return (
    <aside className="flex h-full w-16 flex-col items-center gap-2 border-r border-white/5 bg-void-900/60 py-4 md:w-56 md:items-stretch md:px-3">
      <div className="flex items-center gap-2 px-1 md:mb-6 md:px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/40">
          <Crosshair className="h-5 w-5" />
        </span>
        <div className="hidden md:block">
          <div className="font-display text-sm font-bold tracking-wider text-gold-300">11选5</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">杀号终端</div>
        </div>
      </div>
      <nav className="mt-2 flex flex-1 flex-col gap-1 md:mt-0">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition md:px-3",
                  isActive
                    ? "bg-gold-400/10 text-gold-300 ring-1 ring-gold-400/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{l.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="hidden px-3 pb-1 text-[10px] text-slate-600 md:block">
        数据仅供参考 · 理性购彩
      </div>
    </aside>
  );
}
