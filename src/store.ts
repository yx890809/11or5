// 全局状态：开奖数据、算法参数、预测历史（全部 localStorage 持久化）
import { create } from "zustand";
import type {
  AnalyzerOptions,
  LotteryRecord,
  PredictionHistoryItem,
} from "@/types";
import { DEFAULT_OPTIONS, sortRecords } from "@/lib/analyzer";

const LS_KEY = "lottery11x5:records";
const LS_OPT = "lottery11x5:options";
const LS_PRED = "lottery11x5:predictions";

interface LotteryState {
  records: LotteryRecord[];
  options: AnalyzerOptions;
  predictionHistory: PredictionHistoryItem[];

  setRecords: (records: LotteryRecord[]) => void;
  appendRecord: (record: LotteryRecord) => void;
  savePrediction: (item: PredictionHistoryItem) => void;
  setOptions: (options: AnalyzerOptions) => void;
  setWindow: (window: number) => void;
  setWeight: (key: keyof AnalyzerOptions["weights"], value: number) => void;
  clearRecords: () => void;
}

function loadRecords(): LotteryRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function loadOptions(): AnalyzerOptions {
  try {
    const raw = localStorage.getItem(LS_OPT);
    if (!raw) return { ...DEFAULT_OPTIONS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_OPTIONS,
      ...parsed,
      weights: {
        ...DEFAULT_OPTIONS.weights,
        ...(parsed.weights ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}
function loadPredictions(): PredictionHistoryItem[] {
  try {
    const raw = localStorage.getItem(LS_PRED);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** 用新录入的开奖号去验证所有待验证的预测记录 */
function verifyPredictions(
  history: PredictionHistoryItem[],
  newRecord: LotteryRecord,
): PredictionHistoryItem[] {
  const updated = history.map((p) => {
    // 已验证过的跳过
    if (p.hit !== undefined) return p;
    // 预测目标期号 === 新录入期号 → 验证
    if (p.targetIssue !== newRecord.issue) return p;
    const actual = newRecord.numbers;
    // 被杀的号在开奖中出现 → 杀错；都没出现 → 杀对
    const overlap = p.killNumbers.filter((n) => actual.includes(n));
    const hit = overlap.length === 0;

    // 各方法精准验证：根据 killMethods 里每个号对应的方法来判断
    // 如果没有 killMethods（旧数据），则回退到简化逻辑
    const methodHits: Record<string, boolean> = {};
    if (p.killMethods && Object.keys(p.killMethods).length > 0) {
      for (const numStr of Object.keys(p.killMethods)) {
        const num = Number(numStr);
        const methodsForNum = p.killMethods[numStr];
        // 这个号被杀但在开奖中出现了 → 用这个号的所有方法都没命中
        const numHit = !actual.includes(num);
        for (const m of methodsForNum) {
          // 如果同一个方法对应多个号，只要有一个号杀对就算方法命中
          if (methodHits[m] === undefined) {
            methodHits[m] = numHit;
          } else {
            methodHits[m] = methodHits[m] || numHit;
          }
        }
      }
    } else {
      // 旧数据回退
      for (const method of p.methods) {
        methodHits[method] = hit;
      }
    }
    return { ...p, hit, actualNumbers: actual, methodHits };
  });
  localStorage.setItem(LS_PRED, JSON.stringify(updated));
  return updated;
}

export const useLotteryStore = create<LotteryState>((set) => ({
  records: loadRecords(),
  options: loadOptions(),
  predictionHistory: loadPredictions(),

  setRecords: (records) => {
    localStorage.setItem(LS_KEY, JSON.stringify(records));
    set({ records });
  },

  appendRecord: (record) => {
    set((state) => {
      const filtered = state.records.filter((r) => r.issue !== record.issue);
      const merged = sortRecords([...filtered, record]);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));

      // 自动验证预测
      const verifiedHistory = verifyPredictions(state.predictionHistory, record);

      return { records: merged, predictionHistory: verifiedHistory };
    });
  },

  savePrediction: (item) => {
    set((state) => {
      // 同 targetIssue 覆盖旧预测（重复看板刷新时不堆叠）
      const filtered = state.predictionHistory.filter(
        (p) => p.targetIssue !== item.targetIssue,
      );
      const merged = [...filtered, item].slice(-100); // 只保留最近100条
      localStorage.setItem(LS_PRED, JSON.stringify(merged));
      return { predictionHistory: merged };
    });
  },

  setOptions: (options) => {
    localStorage.setItem(LS_OPT, JSON.stringify(options));
    set({ options });
  },

  setWindow: (window) =>
    set((state) => {
      const next = { ...state.options, window };
      localStorage.setItem(LS_OPT, JSON.stringify(next));
      return { options: next };
    }),

  setWeight: (key, value) =>
    set((state) => {
      const next = {
        ...state.options,
        weights: { ...state.options.weights, [key]: value },
      };
      localStorage.setItem(LS_OPT, JSON.stringify(next));
      return { options: next };
    }),

  clearRecords: () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_PRED);
    set({ records: [], predictionHistory: [] });
  },
}));
