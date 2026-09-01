// 11选5 杀号软件 - 类型定义

/** 单期开奖记录 */
export interface LotteryRecord {
  /** 期号 */
  issue: string;
  /** 5个开奖号码 (1-11) */
  numbers: number[];
}

/** 数据格式 */
export type DataFormat = "json" | "text";

/** 已保存的数据源 */
export interface DataSource {
  id: string;
  name: string;
  url: string;
  format: DataFormat;
  isDefault?: boolean;
  createdAt: number;
}

/** 单个号码的统计指标 */
export interface NumberStat {
  num: number; // 01-11
  freq: number; // 窗口内出现次数
  freqRate: number; // 出现率 0-1
  currentOmit: number; // 当前遗漏期数
  maxOmit: number; // 历史最大遗漏
  consecutive: number; // 当前连开期数
  repeatStreak: number; // 重号连开期数（连续N期都在）
  isHot: boolean;
  isCold: boolean;
}

/** 单号码的杀号得分明细 */
export interface ScoreDetail {
  num: number;
  score: number; // 0-100
  methods: string[]; // 命中的方法名
  hotScore: number;
  limitScore: number;
  headTailScore: number;
  omitScore: number;
  repeatScore: number;
  neighborScore: number;
  sumScore: number;
}

/** 推荐结果 */
export interface KillRecommendation {
  killNumbers: number[];
  details: ScoreDetail[];
}

/** 算法参数 */
export interface AnalyzerOptions {
  /** 统计窗口期数 */
  window: number;
  /** 杀号数量 1-3（默认1个，命中率翻倍：杀1个理论55% vs 杀2个理论27%） */
  killCount: number;
  /** 最少需要几种方法同时指向才杀（共识门槛 1-7，默认3） */
  consensusMin: number;
  /** 各方法权重 0-1 */
  weights: {
    hotCold: number;
    limit: number;
    headTail: number;
    omit: number;
    repeat: number;
    neighbor: number;
    sum: number;
  };
}

/** 杀号方法说明 */
export interface MethodMeta {
  key: string;
  name: string;
  desc: string;
}

export const METHOD_LIST: MethodMeta[] = [
  {
    key: "hotCold",
    name: "冷热杀号法",
    desc: "统计窗口内频次，开奖号多产生于次冷次热号；最热（频次最高）与最冷（遗漏最长）号得分最高。",
  },
  {
    key: "limit",
    name: "极限杀号法",
    desc: "连开5期以上、斜连超4期的号码已达极限，下期大概率被打破，可作杀号处理。",
  },
  {
    key: "headTail",
    name: "首尾球差法",
    desc: "上期首尾号相减的差值，下期普遍绝杀；若差值在本期已出现则保留。",
  },
  {
    key: "omit",
    name: "遗漏值法",
    desc: "当前遗漏接近或超过历史最大遗漏90%的号码，继续遗漏概率降低，但极端冷态可杀。",
  },
  {
    key: "repeat",
    name: "重号杀号法",
    desc: "连续3期以上重号的号码（每期都开出），下期大概率不再重号，可杀。11选5每期重号约1-2个，连重3期已属罕见。",
  },
  {
    key: "neighbor",
    name: "邻号远离杀号法",
    desc: "距离上期所有5个号码差距都>2的号码，出现概率极低（邻号±1/±2是11选5主流形态），可杀。",
  },
  {
    key: "sum",
    name: "和值极值杀号法",
    desc: "最近3期和值连续偏大或偏小（偏离窗口均值），下期和值大概率回归，极端号段（超大和值→杀大号，偏小和值→杀小号）可杀。",
  },
];

/** 定位胆方法说明（11种） */
export const DAN_METHOD_LIST: MethodMeta[] = [
  { key: "hotDan", name: "热号定胆法", desc: "近期出现频率最高的号码作为胆码，热号有延续性" },
  { key: "repeatDan", name: "重号定胆法", desc: "上期开奖号码中选1-2个作为胆码，每期约75%概率出现重号" },
  { key: "omitDan", name: "遗漏回补定胆法", desc: "遗漏3-6期的号码有较高回补概率，选遗漏值中等的号码" },
  { key: "neighborDan", name: "斜连定胆法", desc: "上期开奖号±1的邻号（斜连），每期几乎都有" },
  { key: "consecDan", name: "连号定胆法", desc: "上期开出连号如05,06，则关注04/07做胆" },
  { key: "headTailDan", name: "首尾差定胆法", desc: "上期首尾球相减差值作为胆码" },
  { key: "sumDan", name: "和值推导定胆法", desc: "最近3期和值走势推导胆码范围" },
  { key: "crossDan", name: "交叉定胆法", desc: "最小遗漏值号码相加减最大遗漏值号码" },
  { key: "maxMinDan", name: "最大号减最大遗漏定胆法", desc: "上期最大开奖号 - 最大遗漏期数 = 胆码" },
  { key: "spanDan", name: "跨度定胆法", desc: "上期跨度（最大-最小）范围附近的号码" },
  { key: "streakDan", name: "连开定胆法", desc: "连续2期以上开出的号码继续做胆" },
];

/** 单号码定胆得分明细 */
export interface DanScoreDetail {
  num: number;
  score: number; // 0-100（越高越可能是胆）
  methods: string[]; // 命中的定胆方法
}

/** 定位胆推荐结果 */
export interface DanRecommendation {
  danNumbers: number[]; // 推荐的胆码（按用户选择数量）
  allScores: DanScoreDetail[]; // 所有号码的胆码评分排序
}

/** 单条预测记录（用于命中率回溯） */
export interface PredictionHistoryItem {
  /** 杀号是针对"哪一期"的（即开出来验证的那一期） */
  targetIssue: string;
  /** 当时杀掉的号码 */
  killNumbers: number[];
  /** 命中的杀号方法名（去重后的集合） */
  methods: string[];
  /** 每个被杀号对应的杀号方法（号码 → 方法名数组），用于精准验证 */
  killMethods?: Record<number, string[]>;
  /** 验证结果：杀号正确 → true（被杀的号确实没出），错误 → false，未验证 → undefined */
  hit?: boolean;
  /** 开奖号码（用于展示对比） */
  actualNumbers?: number[];
  /** 每个方法单独是否命中（方法名 → 是否命中） */
  methodHits?: Record<string, boolean>;
}

/** 命中率统计 */
export interface HitRateStats {
  /** 总命中率（杀对的条数 / 已验证条数） */
  overallHitRate: number;
  /** 已验证总条数 */
  totalVerified: number;
  /** 各方法单独命中率 */
  perMethod: Record<string, { hit: number; total: number; rate: number }>;
  /** 最近 N 条的命中率（短期趋势） */
  recentHitRate: number;
  /** 最近多少条 */
  recentCount: number;
}
