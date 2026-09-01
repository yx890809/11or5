/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 深空底色
        void: {
          900: "#070a14",
          800: "#0a0e1a",
          700: "#0f1424",
          600: "#161c30",
          500: "#1e2640",
        },
        // 金色 - 杀号推荐
        gold: {
          400: "#fbbf24",
          300: "#fcd34d",
          500: "#f59e0b",
        },
        // 青色 - 数据/链接
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
        },
        // 危险/被杀
        kill: "#f87171",
        // 温号/保留
        warm: "#34d399",
      },
      fontFamily: {
        // 标题：系统粗体，醒目清晰
        display: [
          '"Microsoft YaHei"',
          '"PingFang SC"',
          '"Source Han Sans SC"',
          '"Hiragino Sans GB"',
          "system-ui",
          "sans-serif",
        ],
        // 等宽数字/代码
        mono: [
          '"Consolas"',
          '"Cascadia Code"',
          '"JetBrains Mono"',
          '"SF Mono"',
          '"Microsoft YaHei Mono"',
          "monospace",
        ],
        // 正文：系统中文字体，优先微软雅黑（Windows）和苹方（Mac）
        sans: [
          '"Microsoft YaHei"',
          '"PingFang SC"',
          '"Source Han Sans SC"',
          '"Hiragino Sans GB"',
          '"Noto Sans CJK SC"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      boxShadow: {
        "glow-gold": "0 0 24px rgba(251,191,36,0.55), 0 0 60px rgba(251,191,36,0.25)",
        "glow-cyan": "0 0 18px rgba(34,211,238,0.4)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(251,191,36,0.45), 0 0 48px rgba(251,191,36,0.18)" },
          "50%": { boxShadow: "0 0 36px rgba(251,191,36,0.85), 0 0 80px rgba(251,191,36,0.4)" },
        },
        rowIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        barGrow: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        rowIn: "rowIn 0.4s ease-out both",
        barGrow: "barGrow 0.7s cubic-bezier(0.22,1,0.36,1) both",
        spinSlow: "spinSlow 1.2s linear infinite",
      },
    },
  },
  plugins: [],
};
