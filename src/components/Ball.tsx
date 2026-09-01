// 号码球组件
import { cn } from "@/lib/utils";

type Variant = "gold" | "kill" | "warm" | "cold" | "dim";

interface BallProps {
  num: number;
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "xl";
  glow?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-3xl",
};

const variantMap: Record<Variant, string> = {
  gold: "ball-gold",
  kill: "ball-kill",
  warm: "ball-warm",
  cold: "ball-cold",
  dim: "ball-dim",
};

export default function Ball({ num, variant = "dim", size = "md", glow, className }: BallProps) {
  return (
    <span
      className={cn(
        "ball font-mono font-bold",
        sizeMap[size],
        variantMap[variant],
        glow && variant === "gold" && "animate-pulseGlow",
        className,
      )}
    >
      {String(num).padStart(2, "0")}
    </span>
  );
}
