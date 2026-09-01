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
  { key: "hotCold", name: "冷热法", desc: "只杀冷号！热号下期75%概率继续出不能杀。当前遗漏≥55%历史最大遗漏的冷号，继续遗漏概率高，可杀。" },
  { key: "limit", name: "极限法", desc: "不杀连开号！连开号有延续性。只杀'刚断连开+遗漏1-4期'的号 — 热完冷却中，下期大概率不出。" },
  { key: "headTail", name: "首尾差法", desc: "上期首尾号相减的差值，下期普遍绝杀（形态逻辑）；若差值在本期已出现则保留。" },
  { key: "omit", name: "遗漏法", desc: "当前遗漏≥历史最大遗漏70%的号 — 持续冷态可能继续冷，可杀。" },
  { key: "repeat", name: "重号排除法", desc: "上期5个号有75%概率继续出→保护不杀。在剩下6个非重号中，遗漏排名前3的可杀（非重号中最冷的）。" },
  { key: "neighbor", name: "邻号法", desc: "距离上期所有号码差距≥2的孤立号，出现概率低（邻号±1是11选5主流形态），可杀。" },
  { key: "sum", name: "和值法", desc: "最近3期和值连续偏大→杀大号（≥9），连续偏小→杀小号（≤3），均值回归逻辑。" },
  { key: "parity", name: "奇偶法", desc: "近3期连续偏奇→反向杀奇；连续偏偶→反向杀偶。均值回归：偏太久会反弹。" },
  { key: "bigSmall", name: "大小法", desc: "近3期连续偏大→反向杀大（≥6）；连续偏小→反向杀小（≤5）。均值回归逻辑。" },
  { key: "prime", name: "质合法", desc: "近3期连续偏质（2,3,5,7,11）→反向杀质；连续偏合→反向杀合。均值回归。" },
  { key: "road", name: "012路法", desc: "0路(3,6,9)/1路(1,4,7,10)/2路(2,5,8,11)，某路近期出现远超理论值→该路号可杀。" },
  { key: "span", name: "跨度法", desc: "近3期跨度都≤6（偏小）→杀大号(≥8)；跨度都≥9（偏大）→杀小号(≤4)。跨度9/8是最常见值。" },
  { key: "ac", name: "AC值法", desc: "AC值是组合复杂度指标。对组合复杂度贡献最低的号（加上后不增加差值多样性）→不太可能出→杀。" },
  { key: "tail", name: "尾数法", desc: "近10期尾数0-9中，连续5期以上没出的尾数称为冷尾。冷尾对应的号→可杀。" },
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
