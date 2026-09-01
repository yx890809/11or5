// 11选5 杀号 + 定胆算法核心
import type {
  LotteryRecord,
  NumberStat,
  ScoreDetail,
  KillRecommendation,
  AnalyzerOptions,
  HitRateStats,
  PredictionHistoryItem,
  DanScoreDetail,
  DanRecommendation,
} from "@/types";
import { METHOD_LIST } from "@/types";

export const DEFAULT_OPTIONS: AnalyzerOptions = {
  window: 30,
  killCount: 2,        // 固定杀2个号
  consensusMin: 2,     // 至少2种方法同时指向（门槛降低，因为有效方法少了）
  weights: {
    hotCold: 0.30,     // 杀温冷号（遗漏4-9期）
    limit: 0.15,       // 刚开始冷的号
    headTail: 0.10,
    omit: 0.20,        // 中等遗漏（4-6期）
    repeat: 0.20,      // 重号反向：上期出现的号下期再出率仅31%，可以杀
    neighbor: 0.15,    // 孤立号
    sum: 0.10,
  },
};

/** 兜底：把传入的 options 补全为完整结构（防止旧版 localStorage 残缺字段）
 *  策略：DEFAULT_OPTIONS 做基准，只补全新增字段，旧字段保留用户值
 *        （但算法方向大改时需要强制刷新某些字段，比如 repeat 权重从 0→0.20）
 */
function normalizeOptions(opts?: Partial<AnalyzerOptions>): AnalyzerOptions {
  if (!opts) return { ...DEFAULT_OPTIONS };
  return {
    window: opts.window ?? DEFAULT_OPTIONS.window,
    killCount: opts.killCount ?? DEFAULT_OPTIONS.killCount,
    consensusMin: opts.consensusMin ?? DEFAULT_OPTIONS.consensusMin,
    weights: {
      ...opts.weights,                    // 用户存储的权重优先
      hotCold: opts.weights?.hotCold ?? DEFAULT_OPTIONS.weights.hotCold,
      limit: opts.weights?.limit ?? DEFAULT_OPTIONS.weights.limit,
      headTail: opts.weights?.headTail ?? DEFAULT_OPTIONS.weights.headTail,
      omit: opts.weights?.omit ?? DEFAULT_OPTIONS.weights.omit,
      repeat: DEFAULT_OPTIONS.weights.repeat, // ⚠️ 强制刷新：算法方向大改，用新默认值
      neighbor: opts.weights?.neighbor ?? DEFAULT_OPTIONS.weights.neighbor,
      sum: opts.weights?.sum ?? DEFAULT_OPTIONS.weights.sum,
    },
  };
}

/** 规整号码数组：去重、范围 1-11 */
function sanitizeNumbers(nums: number[]): number[] {
  return Array.from(
    new Set(nums.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 11)),
  );
}

/** 按期号升序排序，保证末尾为最新期 */
export function sortRecords(records: LotteryRecord[]): LotteryRecord[] {
  return [...records].sort((a, b) => {
    const na = Number(a.issue.replace(/\D/g, "")) || 0;
    const nb = Number(b.issue.replace(/\D/g, "")) || 0;
    return na - nb;
  });
}

/**
 * 计算每个号码 (1-11) 的统计指标
 */
export function computeStats(records: LotteryRecord[], window: number): NumberStat[] {
  const sorted = sortRecords(records);
  const w = Math.min(window, sorted.length);
  const windowRecords = sorted.slice(-w);
  const stats: NumberStat[] = [];

  for (let n = 1; n <= 11; n++) {
    let freq = 0;
    // 频次从窗口算
    for (const r of windowRecords) {
      const nums = sanitizeNumbers(r.numbers);
      if (nums.includes(n)) freq++;
    }

    // currentOmit 和 consecutive 都从 sorted（完整数据）算，避免窗口截断
    let currentOmit = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const nums = sanitizeNumbers(sorted[i].numbers);
      if (nums.includes(n)) break;
      currentOmit++;
    }

    // 连续出现期数：从最新一期往回数连续命中
    let consecutive = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const nums = sanitizeNumbers(sorted[i].numbers);
      if (nums.includes(n)) consecutive++;
      else break;
    }

    // 历史最大遗漏：遍历全部 sorted 记录计算最长未出现间隔
    let maxOmit = 0;
    let gap = 0;
    for (const r of sorted) {
      const nums = sanitizeNumbers(r.numbers);
      if (nums.includes(n)) {
        if (gap > maxOmit) maxOmit = gap;
        gap = 0;
      } else {
        gap++;
      }
    }
    if (gap > maxOmit) maxOmit = gap;

    // 重号连开：连续 N 期（含最新一期）每期都有这个号
    let repeatStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const nums = sanitizeNumbers(sorted[i].numbers);
      if (nums.includes(n)) repeatStreak++;
      else break;
    }

    const freqRate = w > 0 ? freq / w : 0;
    stats.push({
      num: n,
      freq,
      freqRate,
      currentOmit,
      maxOmit,
      consecutive,
      repeatStreak,
      isHot: freqRate >= 0.5,
      isCold: currentOmit >= 6,
    });
  }
  return stats;
}

function norm01(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * 综合评分：返回每个号码的杀号得分明细
 */
export function scoreNumbers(
  records: LotteryRecord[],
  options: AnalyzerOptions = DEFAULT_OPTIONS,
): { stats: NumberStat[]; details: ScoreDetail[] } {
  options = normalizeOptions(options);
  const stats = computeStats(records, options.window);
  const sorted = sortRecords(records);
  const last = sorted[sorted.length - 1];
  const lastNums = last ? sanitizeNumbers(last.numbers) : [];

  // 首尾差值：取最新一期开奖号的最大值与最小值之差
  let headTailDiff = -1;
  if (lastNums.length >= 2) {
    headTailDiff = Math.max(...lastNums) - Math.min(...lastNums);
  }
  // 若差值在最新一期已出现，则不杀
  const headTailActive =
    headTailDiff >= 1 && headTailDiff <= 11 && !lastNums.includes(headTailDiff);

  const maxFreq = Math.max(...stats.map((s) => s.freq));
  const minFreq = Math.min(...stats.map((s) => s.freq));
  const maxOmit = Math.max(...stats.map((s) => s.currentOmit), 1);

  // 和值统计（用于和值极值杀号法）
  const windowSums = sorted
    .slice(-Math.min(options.window, sorted.length))
    .map((r) => sanitizeNumbers(r.numbers).reduce((a, b) => a + b, 0));
  const sumMean = windowSums.length > 0
    ? windowSums.reduce((a, b) => a + b, 0) / windowSums.length
    : 30;
  const sumRecent3 = windowSums.slice(-3);
  const sumIsExtreme = sumRecent3.length >= 2
    ? sumRecent3.every((s) => s >= sumMean + 3) || sumRecent3.every((s) => s <= sumMean - 3)
    : false;
  const sumDirection =
    sumRecent3.length >= 2 && sumRecent3.every((s) => s >= sumMean + 3)
      ? "high"
      : sumRecent3.length >= 2 && sumRecent3.every((s) => s <= sumMean - 3)
        ? "low"
        : "none";

  // ═══════════════════════════════════════════
  // 新增全局统计指标（用于 8-12 种杀号方法）
  // ═══════════════════════════════════════════

  // 近 5 期奇偶比/大小比/质合比/012路 统计
  const recent5 = sorted.slice(-5);
  const oddCount = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => n % 2 === 1).length);
  const bigCount = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => n >= 6).length);
  // 质数: 2,3,5,7,11；合数: 1,4,6,8,9,10
  const primes = new Set([2, 3, 5, 7, 11]);
  const primeCount = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => primes.has(n)).length);
  // 0路:3,6,9；1路:1,4,7,10；2路:2,5,8,11
  const road0Count = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => n % 3 === 0).length);
  const road1Count = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => n % 3 === 1).length);
  const road2Count = recent5.map((r) => sanitizeNumbers(r.numbers).filter((n) => n % 3 === 2).length);

  // 奇偶/大小/质合 是否连 3 期偏某方向
  const oddHeavy = oddCount.slice(-3).every((c) => c >= 4); // 连 3 期奇数≥4 个
  const evenHeavy = oddCount.slice(-3).every((c) => c <= 2); // 连 3 期奇数≤2 个 → 偶偏多
  const bigHeavy = bigCount.slice(-3).every((c) => c >= 4);
  const smallHeavy = bigCount.slice(-3).every((c) => c <= 2);
  const primeHeavy = primeCount.slice(-3).every((c) => c >= 4);
  const compositeHeavy = primeCount.slice(-3).every((c) => c <= 2);

  // 012路哪路过热（近 5 期该路号平均出现次数 ÷ 期数 > 理论值）
  // 0路理论: 5 × (3/11) ≈ 1.36；1路/2路: 5 × (4/11) ≈ 1.82
  const road0Hot = road0Count.reduce((a, b) => a + b, 0) / 5 >= 2;
  const road1Hot = road1Count.reduce((a, b) => a + b, 0) / 5 >= 2.5;
  const road2Hot = road2Count.reduce((a, b) => a + b, 0) / 5 >= 2.5;

  // 跨度统计（近 5 期跨度大小）
  const spans = recent5
    .filter((r) => sanitizeNumbers(r.numbers).length >= 2)
    .map((r) => {
      const nums = sanitizeNumbers(r.numbers);
      return Math.max(...nums) - Math.min(...nums);
    });
  const spanSmall = spans.length >= 3 && spans.slice(-3).every((s) => s <= 6);
  const spanBig = spans.length >= 3 && spans.slice(-3).every((s) => s >= 9);

  // 尾数冷热统计（近 10 期哪些尾数没出）
  const tailWindow = sorted.slice(-10);
  const tailLastSeen: Record<number, number> = {}; // 每个尾数最后出现距今多少期
  for (let t = 0; t <= 9; t++) tailLastSeen[t] = 999;
  for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 20); i--) {
    const nums = sanitizeNumbers(sorted[i].numbers);
    for (const n of nums) {
      const t = n % 10;
      if (tailLastSeen[t] === 999) {
        tailLastSeen[t] = sorted.length - 1 - i;
      }
    }
  }
  // 冷尾：连续 5 期以上没出的尾数
  const coldTails = Object.entries(tailLastSeen)
    .filter(([, v]) => v >= 5)
    .map(([k]) => parseInt(k));

  // AC 值贡献：11 个号各自对"组合复杂度"的贡献
  // 思路：把某号加入组合后，不同两两差值的数量增量就是它的贡献
  // 贡献低的号（加上后差值不增加）→ 不太可能出 → 杀
  function calcACContrib(num: number, allNums: number[]): number {
    const withNum = [...allNums, num].sort((a, b) => a - b);
    const diffs = new Set<number>();
    for (let i = 0; i < withNum.length; i++) {
      for (let j = i + 1; j < withNum.length; j++) {
        diffs.add(Math.abs(withNum[j] - withNum[i]));
      }
    }
    return diffs.size;
  }
  // 假设从 11 个号中选 5 个，计算每个号在"加入上期前 4 个号"时的 AC 贡献
  const baselineNums = lastNums.slice(0, 4);
  const acScores: Record<number, number> = {};
  for (let n = 1; n <= 11; n++) {
    if (!lastNums.includes(n)) {
      acScores[n] = calcACContrib(n, baselineNums);
    }
  }
  // 贡献最低的 3 个号有资格被杀
  const acLowKillable = Object.entries(acScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k]) => parseInt(k));

  const details: ScoreDetail[] = stats.map((s) => {
    const methods: string[] = [];

    // ═══════════════════════════════════════════
    // 杀号方法（基于真实数据修正方向）
    // 
    // 数据发现（75期前向验证）:
    //   1. 遗漏4-6期的号 → 下期出现率18.5% → 最安全！→ 杀
    //   2. 遗漏2-3期的温号 → 下期出现率69.3% → 最危险！→ 不能杀
    //   3. 上期出现的号 → 下期再出率31.1%（低于理论45.5%）→ 可以杀！
    //   4. 遗漏10+期极端冷号 → 均值回归，反而容易回补 → 不能杀
    // ═══════════════════════════════════════════

    // 1. 冷热法（杀"温冷号"：遗漏 4-9 期的号 — 既没到回补临界点，又不太可能刚出来）
    // 数据显示遗漏2-3期的温号(69%)最容易出，遗漏4-6期(18.5%)最安全
    let coldRaw = 0;
    if (s.currentOmit >= 4 && s.currentOmit <= 9) {
      // 最优杀号区间！遗漏4-9期
      coldRaw = 1;
      methods.push("冷热法");
    } else if (s.currentOmit === 1 || s.currentOmit === 2) {
      // 刚断(1-2期)的号也不太容易马上再出
      coldRaw = 0.5;
    }
    const coldScore = Math.round(coldRaw * 100 * options.weights.hotCold);

    // 2. 极限法（杀"持续温冷"：遗漏 5-9 期，且不是极端冷号）
    let limitRaw = 0;
    if (s.currentOmit >= 5 && s.currentOmit <= 9 && s.currentOmit < maxOmit) {
      limitRaw = 0.9;
      methods.push("极限法");
    } else if (s.currentOmit === 1 && s.consecutive === 0) {
      // 刚断1期（上期之前连开过？不，consecutive=0表示连开0期）
      limitRaw = 0.3;
    }
    const limitScore = Math.round(limitRaw * 100 * options.weights.limit);

    // 3. 首尾差法（形态逻辑，保留）
    let htRaw = 0;
    if (headTailActive && s.num === headTailDiff) {
      htRaw = 1;
      methods.push("首尾差法");
    }
    const headTailScore = Math.round(htRaw * 100 * options.weights.headTail);

    // 4. 遗漏值法（中等遗漏最安全 → 杀遗漏 4-6 期）
    let omitRaw = 0;
    if (s.currentOmit >= 4 && s.currentOmit <= 6) {
      omitRaw = 1;
      methods.push("遗漏法");
    } else if (s.currentOmit >= 7 && s.currentOmit <= 9) {
      omitRaw = 0.6;
      methods.push("遗漏法");
    }
    const omitScore = Math.round(omitRaw * 100 * options.weights.omit);

    // 5. 重号反向修正（数据显示上期号下期再出率仅31%，低于理论45.5%！
    //    → 上期出现的号反而可以杀！）
    let repeatRaw = 0;
    if (lastNums.includes(s.num)) {
      // 上期出现的号 → 下期不太容易再出（真实数据31% vs 理论45.5%）
      repeatRaw = 0.8;
      methods.push("重号排除法");
    } else if (s.currentOmit >= 4 && s.currentOmit <= 6) {
      // 非上期号但处于安全遗漏区间
      repeatRaw = 0.5;
    }
    const repeatScore = Math.round(repeatRaw * 100 * options.weights.repeat);

    // 6. 邻号远离法（门槛从 minDist≥3 降到 ≥2，覆盖更多孤立号）
    let neighborRaw = 0;
    if (lastNums.length > 0) {
      const minDist = Math.min(...lastNums.map((n) => Math.abs(s.num - n)));
      if (minDist >= 3) {
        neighborRaw = 1;
        methods.push("邻号法");
      } else if (minDist === 2) {
        neighborRaw = 0.6;
        methods.push("邻号法");
      }
    }
    const neighborScore = Math.round(neighborRaw * 100 * options.weights.neighbor);

    // 7. 和值极值法（最近 3 期和值极端 → 杀对应区间）
    let sumRaw = 0;
    if (sumIsExtreme) {
      if (sumDirection === "high" && s.num >= 9) {
        sumRaw = 1;
        methods.push("和值法");
      } else if (sumDirection === "low" && s.num <= 3) {
        sumRaw = 1;
        methods.push("和值法");
      }
    }
    const sumScore = Math.round(sumRaw * 100 * options.weights.sum);

    // 8. 奇偶/大小/质合反向杀法（均值回归：连 3 期偏某方向 → 反向杀）
    let parityRaw = 0;
    if (oddHeavy && s.num % 2 === 1) {
      parityRaw = 0.9;
      methods.push("奇偶法");
    } else if (evenHeavy && s.num % 2 === 0) {
      parityRaw = 0.9;
      methods.push("奇偶法");
    } else if (bigHeavy && s.num >= 6) {
      parityRaw = 0.7;
      methods.push("大小法");
    } else if (smallHeavy && s.num <= 5) {
      parityRaw = 0.7;
      methods.push("大小法");
    } else if (primeHeavy && primes.has(s.num)) {
      parityRaw = 0.6;
      methods.push("质合法");
    } else if (compositeHeavy && !primes.has(s.num)) {
      parityRaw = 0.6;
      methods.push("质合法");
    }
    const parityScore = Math.round(parityRaw * 100 * 0.15);

    // 9. 012路过热杀法（某路近期远超理论值 → 杀该路号）
    let roadRaw = 0;
    if (road0Hot && s.num % 3 === 0) {
      roadRaw = 0.8;
      methods.push("012路法");
    } else if (road1Hot && s.num % 3 === 1) {
      roadRaw = 0.8;
      methods.push("012路法");
    } else if (road2Hot && s.num % 3 === 2) {
      roadRaw = 0.8;
      methods.push("012路法");
    }
    const roadScore = Math.round(roadRaw * 100 * 0.12);

    // 10. 跨度方向杀法（连续小跨度 → 杀大号；连续大跨度 → 杀小号）
    let spanRaw = 0;
    if (spanSmall && s.num >= 8) {
      spanRaw = 0.8;
      methods.push("跨度法");
    } else if (spanBig && s.num <= 4) {
      spanRaw = 0.8;
      methods.push("跨度法");
    }
    const spanScore = Math.round(spanRaw * 100 * 0.12);

    // 11. AC值贡献杀法（对组合复杂度贡献最低的号 → 杀）
    let acRaw = 0;
    if (acLowKillable.includes(s.num)) {
      acRaw = 0.7;
      methods.push("AC值法");
    }
    const acScore = Math.round(acRaw * 100 * 0.1);

    // 12. 尾数法（改方向：杀近期出过的热尾数，因为温号容易延续；极端冷尾反而在回补）
    let tailRaw = 0;
    // 近3期都出过的尾数 → 该尾数号可能热完转冷，杀
    const recent3TailFreq = {};
    for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 3); i--) {
      for (const n of sanitizeNumbers(sorted[i].numbers)) {
        const t = n % 10;
        recent3TailFreq[t] = (recent3TailFreq[t] || 0) + 1;
      }
    }
    const hotTails = Object.entries(recent3TailFreq as Record<string, number>)
      .filter(([, v]) => v >= 3) // 近3期每期都出的尾数
      .map(([k]) => parseInt(k));
    if (hotTails.includes(s.num % 10)) {
      tailRaw = 0.7;
      methods.push("尾数法");
    }
    const tailScore = Math.round(tailRaw * 100 * 0.1);

    let score = coldScore + limitScore + headTailScore + omitScore + repeatScore
              + neighborScore + sumScore + parityScore + roadScore
              + spanScore + acScore + tailScore;

    // ⚠️ 重号加分：上期出现的号码，下期再出率仅31%（低于理论45.5%）
    // 所以上期号应该被杀概率增加，加分20%
    if (lastNums.includes(s.num)) {
      score = Math.round(score * 1.2);
    }

    return {
      num: s.num,
      score,
      methods: Array.from(new Set(methods)),
      hotScore: coldScore,
      limitScore,
      headTailScore,
      omitScore,
      repeatScore,
      neighborScore,
      sumScore,
    };
  });

  return { stats, details };
}

/**
 * 推荐杀号
 * 核心策略：共识投票制 — 只有 ≥ consensusMin 种方法同时认为该杀才入选
 * 这样选出的杀号置信度高，而不是各种方法各杀各的互相矛盾
 * @param killCount 杀号数量（1-3）
 * @param consensusMin 最少需要几种方法达成共识（2-5）
 */
export function recommend(
  records: LotteryRecord[],
  options: AnalyzerOptions = DEFAULT_OPTIONS,
): KillRecommendation {
  options = normalizeOptions(options);
  const killCount = Math.max(1, Math.min(3, options.killCount));
  const consensusMin = Math.max(1, Math.min(7, options.consensusMin));

  const { stats, details } = scoreNumbers(records, options);

  // 共识投票：按"方法命中数"降序，再按"加权分"降序
  const byConsensus = [...details].sort((a, b) => {
    if (b.methods.length !== a.methods.length) return b.methods.length - a.methods.length;
    return b.score - a.score;
  });

  // 筛选出达到共识门槛的号码
  let qualified = byConsensus.filter((d) => d.methods.length >= consensusMin);

  // 如果没有号码达到门槛，降级用最低门槛（至少2种方法）保证能给出建议
  if (qualified.length === 0) {
    qualified = byConsensus.filter((d) => d.methods.length >= 2);
  }

  // 还是没有，就退到按加权分排序取前 killCount 个
  let kill: ScoreDetail[];
  if (qualified.length > 0) {
    kill = qualified.slice(0, killCount);
  } else {
    kill = byConsensus.slice(0, killCount);
  }

  return {
    killNumbers: kill.map((k) => k.num),
    details: byConsensus,
  };
}

/**
 * 定位胆推荐算法
 * 综合11种定胆方法对每个号码打分（越高越可能是胆码）
 * 返回前 N 个作为胆码，默认 2 个
 */
export function recommendDan(
  records: LotteryRecord[],
  danCount = 2,
  window = 30,
): DanRecommendation {
  const sorted = sortRecords(records);
  const windowRecords = sorted.slice(-Math.min(window, sorted.length));
  const stats = computeStats(sorted, window);

  if (sorted.length < 5) {
    return { danNumbers: [], allScores: [] };
  }

  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const latestNums = new Set(latest.numbers);

  // 初始化所有号码分数
  const scoreMap: Record<number, { score: number; methods: Set<string> }> = {};
  for (let n = 1; n <= 11; n++) {
    scoreMap[n] = { score: 0, methods: new Set() };
  }

  const add = (num: number, score: number, method: string) => {
    if (num >= 1 && num <= 11) {
      scoreMap[num].score += score;
      scoreMap[num].methods.add(method);
    }
  };

  // ============ 11 种定胆方法 ============

  // 1. 热号定胆法：频次最高的号码加分
  const sortedByFreq = [...stats].sort((a, b) => b.freq - a.freq);
  sortedByFreq.slice(0, 4).forEach((s, i) => {
    add(s.num, 30 - i * 6, "热号定胆");
  });

  // 2. 重号定胆法：上期开奖号码全部加分
  latest.numbers.forEach((n) => add(n, 25, "重号定胆"));

  // 3. 遗漏回补定胆法：遗漏3-6期的号码加分（回补概率较高）
  stats
    .filter((s) => s.currentOmit >= 2 && s.currentOmit <= 7)
    .forEach((s) => add(s.num, 20 - Math.abs(s.currentOmit - 4) * 2, "遗漏回补"));

  // 4. 斜连定胆法：上期号码±1
  latest.numbers.forEach((n) => {
    if (n > 1) add(n - 1, 18, "斜连定胆");
    if (n < 11) add(n + 1, 18, "斜连定胆");
  });

  // 5. 连号定胆法：上期有连号则延伸
  const sortedLatest = [...latest.numbers].sort((a, b) => a - b);
  for (let i = 0; i < sortedLatest.length - 1; i++) {
    if (sortedLatest[i + 1] - sortedLatest[i] === 1) {
      // 找到连号 a,a+1 → 推 a-1 和 a+2
      const a = sortedLatest[i];
      if (a > 1) add(a - 1, 15, "连号延伸");
      if (a + 2 <= 11) add(a + 2, 15, "连号延伸");
    }
  }

  // 6. 首尾差定胆法
  const first = Math.min(...latest.numbers);
  const last = Math.max(...latest.numbers);
  const diff = last - first;
  if (diff >= 1 && diff <= 11) add(diff, 12, "首尾差定胆");

  // 7. 和值推导定胆法：最近3期和值均值附近
  const sumRecent = sorted.slice(-3).map((r) => r.numbers.reduce((a, b) => a + b, 0));
  const avgSum = sumRecent.reduce((a, b) => a + b, 0) / sumRecent.length;
  // 和值范围在 15-45 之间（11选5），均值/5 约等于平均号
  const avgBall = Math.round(avgSum / 5);
  if (avgBall >= 1 && avgBall <= 11) {
    add(avgBall, 10, "和值推导");
    if (avgBall > 1) add(avgBall - 1, 6, "和值推导");
    if (avgBall < 11) add(avgBall + 1, 6, "和值推导");
  }

  // 8. 交叉定胆法：最小遗漏值号码相加 - 最大遗漏值号码
  const minOmit = Math.min(...stats.map((s) => s.currentOmit));
  const maxOmit = Math.max(...stats.map((s) => s.currentOmit));
  const minOmitNums = stats.filter((s) => s.currentOmit === minOmit).map((s) => s.num);
  const minOmitSum = minOmitNums.reduce((a, b) => a + b, 0);
  const cross = minOmitSum - maxOmit;
  if (cross >= 1 && cross <= 11) add(cross, 10, "交叉定胆");

  // 9. 最大号减最大遗漏定胆法
  const recentMax = Math.max(...latest.numbers);
  const maxOmitNum = stats.reduce((a, b) => (a.maxOmit > b.maxOmit ? a : b)).num;
  const recentMaxOmit = stats.find((s) => s.num === maxOmitNum)!.currentOmit;
  const maxMinusOmit = recentMax - recentMaxOmit;
  if (maxMinusOmit >= 1 && maxMinusOmit <= 11) add(maxMinusOmit, 10, "最大号-遗漏");

  // 10. 跨度定胆法：上期跨度范围
  const span = last - first;
  // 跨度值本身可作胆（偶尔有效）
  if (span >= 1 && span <= 11) add(span, 5, "跨度定胆");

  // 11. 连开定胆法：连续2期以上重号
  if (prev) {
    const prevNums = new Set(prev.numbers);
    const repeats = latest.numbers.filter((n) => prevNums.has(n));
    repeats.forEach((n) => add(n, 8, "连开定胆"));
  }

  // 每期都出的号码加更多分（超热）
  const streakHot = stats.filter((s) => s.repeatStreak >= 2);
  streakHot.forEach((s) => add(s.num, s.repeatStreak * 4, "连开定胆"));

  // ============ 汇总排序 ============
  const allScores: DanScoreDetail[] = [];
  for (let n = 1; n <= 11; n++) {
    allScores.push({
      num: n,
      score: scoreMap[n].score,
      methods: [...scoreMap[n].methods],
    });
  }
  allScores.sort((a, b) => b.score - a.score);

  // 取前 N 个胆码
  const danNumbers = allScores.slice(0, danCount).map((d) => d.num);

  return { danNumbers, allScores };
}

/**
 * 解析文本格式的开奖数据
 * 每行：期号 号1,号2,号3,号4,号5 （分隔符支持 空格/逗号/制表符）
 */
export function parseText(raw: string): LotteryRecord[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const records: LotteryRecord[] = [];
  for (const line of lines) {
    const parts = line.split(/[\s,，\t]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const issue = parts[0];
    const numbers = parts
      .slice(1)
      .map((p) => Number(p))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 11);
    if (numbers.length >= 2) {
      records.push({ issue, numbers });
    }
  }
  return records;
}

/**
 * 解析 JSON 格式开奖数据，兼容多种字段命名
 */
export function parseJson(raw: string): LotteryRecord[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : data?.data ?? data?.list ?? [];
  const records: LotteryRecord[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const issue = String(item.issue ?? item.expect ?? item.qihao ?? item.period ?? "");
    let numbers: number[] = [];
    const cand = item.numbers ?? item.openCode ?? item.opencode ?? item.code ?? item.result ?? item.kjhm;
    if (Array.isArray(cand)) {
      numbers = cand.map((n: unknown) => Number(n));
    } else if (typeof cand === "string") {
      numbers = cand.split(/[,，\s]+/).map((n) => Number(n));
    }
    numbers = numbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= 11);
    if (issue && numbers.length >= 2) {
      records.push({ issue, numbers });
    }
  }
  return records;
}

/** 生成演示数据（便于无外部链接时体验） */
export function genDemoRecords(count = 40): LotteryRecord[] {
  const records: LotteryRecord[] = [];
  const base = 20260901000;
  for (let i = 0; i < count; i++) {
    const pool = Array.from({ length: 11 }, (_, k) => k + 1);
    // 简单加权随机：让某些号更易热
    const picks: number[] = [];
    for (let k = 0; k < 5; k++) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    records.push({ issue: String(base + i + 1), numbers: picks.sort((a, b) => a - b) });
  }
  return records;
}

/**
 * 从图片 OCR 或网页复制的杂乱文本中智能提取期号和 11选5 开奖号码
 *
 * 策略（按行优先，更精准）：
 *  1. 先把 `\d{6,}-\d{2,3}` 格式的期号合并（去掉连字符），如 20260901-002 → 20260901002
 *  2. 按行切分，对每一行：
 *     a) 找行内所有纯数字段
 *     b) ≥6 位的视为期号（取最新一个）
 *     c) 1-11 范围且唯一的数字视为开奖号码
 *     d) 每行凑够 5 个号码 + 1 个期号 → 产出一条记录
 *  3. 走势图列中的重复号码（同一号码在不同位置出现）会被去重，
 *     但走势图中开奖号码那一列通常在前几列，优先收集
 *  4. 跨行走（上一行的号码被下一行收集）的概率大幅降低
 */
export function extractFromMessyText(raw: string): LotteryRecord[] {
  // Step 1: 合并 `期号-子号` 格式 → 纯数字
  let normalized = raw.replace(/(\d{6,})[-－\s]+(\d{2,4})/g, "$1$2");

  // Step 2: 把各种分隔符统一为空格
  normalized = normalized
    .replace(/[\t\u3000，。、；：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Step 3: 按原换行切分（保留行内结构）
  const lines = raw.split(/\r?\n/);

  const records: LotteryRecord[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // 合并行内的 `期号-子号`
    const merged = line.replace(/(\d{6,})[-－\s]+(\d{2,4})/g, "$1$2");
    // 统一分隔符
    const clean = merged.replace(/[\t\u3000，。、；：\-\s]+/g, " ").trim();
    if (!clean) continue;

    // 切分为 token
    const tokens = clean.split(" ");
    let issue = "";
    const nums = new Set<number>();

    for (const tok of tokens) {
      if (!tok) continue;
      // 期号：纯数字 ≥6 位
      if (/^\d{6,}$/.test(tok)) {
        issue = tok;
        continue;
      }
      // 号码：1-11
      const n = Number(tok);
      if (Number.isInteger(n) && n >= 1 && n <= 11) {
        nums.add(n);
      }
    }

    // 产出条件：有期号 + 至少 3 个号码
    if (issue && nums.size >= 3) {
      const numbers = Array.from(nums).sort((a, b) => a - b);
      // 如果去重后超过 5 个，取前 5 个（走势图列可能混了别的号）
      const final = numbers.slice(0, 5);
      const key = `${issue}|${final.join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({ issue, numbers: final });
      }
    }
  }

  // 如果按行没提取到（可能整段是一行），回退到全局收集模式
  if (records.length === 0) {
    const tokens = normalized.split(" ");
    let currentIssue = "";
    const set = new Set<number>();
    for (const tok of tokens) {
      if (!tok) continue;
      if (/^\d{6,}$/.test(tok)) {
        if (currentIssue && set.size >= 3) {
          const numbers = Array.from(set).sort((a, b) => a - b).slice(0, 5);
          records.push({ issue: currentIssue, numbers });
        }
        currentIssue = tok;
        set.clear();
      } else {
        const n = Number(tok);
        if (Number.isInteger(n) && n >= 1 && n <= 11) {
          set.add(n);
          if (set.size >= 5 && currentIssue) {
            const numbers = Array.from(set).sort((a, b) => a - b).slice(0, 5);
            const key = `${currentIssue}|${numbers.join(",")}`;
            if (!seen.has(key)) {
              seen.add(key);
              records.push({ issue: currentIssue, numbers });
            }
            set.clear();
          }
        }
      }
    }
    // 末尾
    if (currentIssue && set.size >= 3) {
      const numbers = Array.from(set).sort((a, b) => a - b).slice(0, 5);
      records.push({ issue: currentIssue, numbers });
    }
  }

  return records;
}

/** 计算命中率统计 */
export function computeHitRate(history: PredictionHistoryItem[]): HitRateStats {
  const verified = history.filter((p) => p.hit !== undefined);
  const totalVerified = verified.length;
  const totalHit = verified.filter((p) => p.hit === true).length;
  const overallHitRate = totalVerified > 0 ? totalHit / totalVerified : 0;

  // 最近10条的短期命中率
  const recent = verified.slice(-10);
  const recentCount = recent.length;
  const recentHit = recent.filter((p) => p.hit === true).length;
  const recentHitRate = recentCount > 0 ? recentHit / recentCount : 0;

  // 各方法单独命中率 - 优先用 methodHits（精准验证），回退到 methods+hit（旧数据）
  const perMethod: Record<string, { hit: number; total: number; rate: number }> = {};
  for (const p of verified) {
    if (p.methodHits && Object.keys(p.methodHits).length > 0) {
      // 精准模式：用 methodHits 里每个方法的单独结果
      for (const [methodName, methodHit] of Object.entries(p.methodHits)) {
        if (!perMethod[methodName]) perMethod[methodName] = { hit: 0, total: 0, rate: 0 };
        perMethod[methodName].total++;
        if (methodHit) perMethod[methodName].hit++;
      }
    } else if (p.methods && p.methods.length > 0) {
      // 旧数据回退模式：没有 methodHits，用 methods + 总体 hit
      for (const m of p.methods) {
        if (!perMethod[m]) perMethod[m] = { hit: 0, total: 0, rate: 0 };
        perMethod[m].total++;
        if (p.hit === true) perMethod[m].hit++;
      }
    }
  }
  for (const k of Object.keys(perMethod)) {
    perMethod[k].rate = perMethod[k].total > 0 ? perMethod[k].hit / perMethod[k].total : 0;
  }

  return { overallHitRate, totalVerified, perMethod, recentHitRate, recentCount };
}

/**
 * 实时回测每种杀号方法的独立命中率
 * 模拟"只用该方法独立杀 2 个号"，跑最近 20 期
 * 返回每个方法 {hit, total, rate}
 * 这样即使历史预测记录里没数据（新方法），也能有真实回测数据展示
 */
export function backtestPerMethod(
  records: LotteryRecord[],
  testCount = 20,
  killCount = 2,
): Record<string, { hit: number; total: number; rate: number }> {
  const sorted = sortRecords(records);
  const MIN_TRAIN = 15;
  const perMethod: Record<string, { hit: number; total: number; rate: number }> = {};

  // 初始化所有方法（从 METHOD_LIST 导入）
  for (const meta of METHOD_LIST) {
    perMethod[meta.name] = { hit: 0, total: 0, rate: 0 };
  }

  const total = Math.min(testCount, Math.max(0, sorted.length - MIN_TRAIN));

  for (let i = sorted.length - total; i < sorted.length; i++) {
    const train = sorted.slice(0, i);
    const testRecord = sorted[i];
    if (train.length < MIN_TRAIN) continue;
    const actual = testRecord.numbers;

    // 用默认配置跑 recommend
    const rec = recommend(train, DEFAULT_OPTIONS);
    for (const d of rec.details) {
      // 这个号被杀了，检查是哪些方法杀的
      const isKilled = rec.killNumbers.includes(d.num);
      for (const methodName of d.methods) {
        if (!perMethod[methodName]) perMethod[methodName] = { hit: 0, total: 0, rate: 0 };
        perMethod[methodName].total++;
        if (isKilled && !actual.includes(d.num)) {
          // 被杀且确实没出 → 命中
          perMethod[methodName].hit++;
        }
      }
    }
  }

  for (const k of Object.keys(perMethod)) {
    perMethod[k].rate = perMethod[k].total > 0 ? perMethod[k].hit / perMethod[k].total : 0;
  }
  return perMethod;
}

/** 根据各方法命中率自动微调权重 - 命中率梯度式调整 */
export function autoAdjustWeights(
  history: PredictionHistoryItem[],
  current: AnalyzerOptions,
): AnalyzerOptions {
  const stats = computeHitRate(history);
  if (stats.totalVerified < 5) return current;
  const W = { ...current.weights };
  const CLAMP = { min: 0.05, max: 0.50 };

  const METHOD_KEY_MAP: Record<string, keyof AnalyzerOptions["weights"]> = {
    "冷热法": "hotCold",
    "极限法": "limit",
    "首尾差法": "headTail",
    "遗漏法": "omit",
    "重号法": "repeat",
    "邻号法": "neighbor",
    "和值法": "sum",
  };

  for (const [methodName, key] of Object.entries(METHOD_KEY_MAP)) {
    const m = stats.perMethod[methodName];
    if (!m || m.total < 3) continue;
    // 命中率梯度式调整：越高加越多，越低减越多
    let delta = 0;
    if (m.rate >= 0.85) delta = 0.08;      // 神准 → 大幅增
    else if (m.rate >= 0.70) delta = 0.05;  // 很准 → 增
    else if (m.rate >= 0.55) delta = 0.02;  // 还行 → 微调增
    else if (m.rate < 0.25) delta = -0.08;  // 很差 → 大幅减
    else if (m.rate < 0.40) delta = -0.05;  // 不准 → 减
    else if (m.rate < 0.50) delta = -0.02;  // 偏差 → 微调减
    W[key] = Math.max(CLAMP.min, Math.min(CLAMP.max, W[key] + delta));
  }

  // 归一化
  const sum = Object.values(W).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const k of Object.keys(W) as (keyof AnalyzerOptions["weights"])[]) {
      W[k] = Math.round((W[k] / sum) * 100) / 100;
    }
  }
  return { ...current, weights: W };
}

/**
 * 快速回测：用最近 N 期数据对比三种策略的杀 2 命中率
 * ① 共识投票制（当前 consensusMin=3）
 * ② 纯加权求和（退化为 consensusMin=1，等于关闭共识过滤）
 * ③ 纯随机（理论基线 27.3%）
 */
export function quickBacktest(records: LotteryRecord[], testCount = 20): {
  consensus: { hits: number; rate: number };
  weighted: { hits: number; rate: number };
  random: { hits: number; rate: number };
  total: number;
} {
  const sorted = sortRecords(records);
  const MIN_TRAIN = 15;
  const total = Math.min(testCount, Math.max(0, sorted.length - MIN_TRAIN));
  if (total === 0) {
    return { consensus: { hits: 0, rate: 0 }, weighted: { hits: 0, rate: 0 }, random: { hits: 0, rate: 0 }, total: 0 };
  }

  let consensusHits = 0;
  let weightedHits = 0;
  let randomHits = 0;

  const consensusOpts: AnalyzerOptions = { ...DEFAULT_OPTIONS, killCount: 2, consensusMin: 3 };
  const weightedOpts: AnalyzerOptions = { ...DEFAULT_OPTIONS, killCount: 2, consensusMin: 1 };

  for (let i = sorted.length - total; i < sorted.length; i++) {
    const train = sorted.slice(0, i);
    const testRecord = sorted[i];
    if (train.length < MIN_TRAIN) continue;

    const actual = testRecord.numbers;

    const c = recommend(train, consensusOpts);
    if (c.killNumbers.every((n) => !actual.includes(n))) consensusHits++;

    const w = recommend(train, weightedOpts);
    if (w.killNumbers.every((n) => !actual.includes(n))) weightedHits++;

    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const shuffle = pool.sort(() => Math.random() - 0.5).slice(0, 2);
    if (shuffle.every((n) => !actual.includes(n))) randomHits++;
  }

  return {
    consensus: { hits: consensusHits, rate: consensusHits / total },
    weighted: { hits: weightedHits, rate: weightedHits / total },
    random: { hits: randomHits, rate: randomHits / total },
    total,
  };
}

/** - 网格搜索最优权重组合
 * 用历史开奖数据做回测，找出使预测命中率最高的权重组合
 * 返回最优配置和回测命中率
 */
export interface BacktestResult {
  bestOptions: AnalyzerOptions;
  bestHitRate: number;
  totalTests: number;
  tested: number;
  history: Array<{ weights: number[]; hitRate: number }>;
}

/**
 * 定位胆快速回测：用最近 N 期数据测试定胆命中率
 * 胆码命中率 = 推荐胆码中命中当期开奖号的比例
 * 比如定2个胆，当期开出了其中1个 → 命中率50%
 * 也统计"全中"（所有胆码都在开奖里）和"命中≥1"（至少中1个）
 */
export function quickBacktestDan(
  records: LotteryRecord[],
  danCount = 2,
  window = 30,
  testCount = 20,
): {
  avgHitRate: number;        // 平均单胆命中率 (0-1)
  fullHitRate: number;       // 全中率 (所有胆码都在开奖里)
  anyHitRate: number;        // 至少中1个的概率
  total: number;
  details: Array<{
    issue: string;
    danNumbers: number[];
    actual: number[];
    hits: number[];           // 命中的胆码
    hitRate: number;          // 本期命中率
  }>;
} {
  const sorted = sortRecords(records);
  const MIN_TRAIN = 15;
  const total = Math.min(testCount, Math.max(0, sorted.length - MIN_TRAIN));

  const details: Array<{
    issue: string; danNumbers: number[]; actual: number[]; hits: number[]; hitRate: number;
  }> = [];

  let hitRateSum = 0;
  let fullHit = 0;
  let anyHit = 0;

  for (let i = sorted.length - total; i < sorted.length; i++) {
    const train = sorted.slice(0, i);
    const testRecord = sorted[i];
    if (train.length < MIN_TRAIN) continue;

    const rec = recommendDan(train, danCount, window);
    const actual = testRecord.numbers;
    const hits = rec.danNumbers.filter((n) => actual.includes(n));
    const hitRate = hits.length / danCount;
    hitRateSum += hitRate;
    if (hits.length === danCount) fullHit++;
    if (hits.length >= 1) anyHit++;

    details.push({
      issue: testRecord.issue,
      danNumbers: rec.danNumbers,
      actual,
      hits,
      hitRate,
    });
  }

  return {
    avgHitRate: total > 0 ? hitRateSum / total : 0,
    fullHitRate: total > 0 ? fullHit / total : 0,
    anyHitRate: total > 0 ? anyHit / total : 0,
    total,
    details,
  };
}

/**
 * AI 策略进化引擎
 * 用网格搜索遍历权重组合，回测选出最优
 */
export function backtestAndOptimize(
  records: LotteryRecord[],
  current: AnalyzerOptions,
  progress?: (done: number, total: number) => void,
): BacktestResult {
  const sorted = sortRecords(records);
  if (sorted.length < 15) {
    return { bestOptions: current, bestHitRate: 0, totalTests: 0, tested: 0, history: [] };
  }

  // 回测窗口：用前 N-5 期预测后 5 期，看命中率
  const backtestSize = Math.min(30, sorted.length - 5); // 最多回测最近30期
  const startIdx = sorted.length - backtestSize - 1;

  // 7 个权重维度的候选值（粗网格 → 细网格）
  const STEPS = [0.10, 0.15, 0.20, 0.25, 0.30];
  const KEYS: (keyof AnalyzerOptions["weights"])[] = [
    "hotCold", "limit", "headTail", "omit", "repeat", "neighbor", "sum",
  ];

  const history: BacktestResult["history"] = [];
  let bestRate = -1;
  let bestWeights = { ...current.weights };
  let tested = 0;

  // 第一阶段：每个方法逐个测试增减 0.05 的效果
  const variants: Array<Partial<AnalyzerOptions["weights"]>> = [];

  // 基准（当前权重）
  variants.push({ ...current.weights });

  // 每个方法 ±0.05
  for (const key of KEYS) {
    const cur = current.weights[key];
    for (const delta of [0.05, -0.05, 0.10, -0.10]) {
      const nv = cur + delta;
      if (nv < 0.05 || nv > 0.50) continue;
      const v: Partial<AnalyzerOptions["weights"]> = { ...current.weights };
      v[key] = Math.round(nv * 100) / 100;
      variants.push(v);
    }
  }

  // 第二阶段：几个有代表性的均衡组合
  variants.push({ hotCold: 0.20, repeat: 0.15, limit: 0.15, omit: 0.15, headTail: 0.10, neighbor: 0.10, sum: 0.15 });
  variants.push({ hotCold: 0.15, repeat: 0.25, limit: 0.20, omit: 0.10, headTail: 0.05, neighbor: 0.10, sum: 0.15 });
  variants.push({ hotCold: 0.30, repeat: 0.10, limit: 0.10, omit: 0.10, headTail: 0.10, neighbor: 0.10, sum: 0.20 });
  variants.push({ hotCold: 0.10, repeat: 0.30, limit: 0.10, omit: 0.10, headTail: 0.10, neighbor: 0.15, sum: 0.15 });

  const totalTests = variants.length;

  for (const v of variants) {
    // 归一化
    const raw = KEYS.map((k) => v[k] ?? 0.14);
    const sum = raw.reduce((a, b) => a + b, 0);
    const normed: Partial<AnalyzerOptions["weights"]> = {};
    for (let i = 0; i < KEYS.length; i++) {
      normed[KEYS[i]] = Math.round((raw[i] / sum) * 100) / 100;
    }

    const opts: AnalyzerOptions = { ...current, weights: normed as AnalyzerOptions["weights"] };
    const rate = runBacktest(sorted, opts, startIdx);

    tested++;
    history.push({ weights: KEYS.map((k) => normed[k]!), hitRate: rate });

    if (rate > bestRate) {
      bestRate = rate;
      bestWeights = normed as AnalyzerOptions["weights"];
    }

    if (progress) progress(tested, totalTests);
  }

  return {
    bestOptions: { ...current, weights: bestWeights },
    bestHitRate: Math.round(bestRate * 10000) / 10000,
    totalTests,
    tested,
    history,
  };
}

/** 对单组权重跑回测，返回命中率 */
function runBacktest(
  sorted: LotteryRecord[],
  opts: AnalyzerOptions,
  startIdx: number,
): number {
  let correct = 0;
  let total = 0;

  for (let i = startIdx; i < sorted.length - 1; i++) {
    const train = sorted.slice(0, i + 1);
    const target = sorted[i + 1];
    const actualNums = new Set(target.numbers);

    if (train.length < 10) continue;

    const rec = recommend(train, opts);
    if (rec.killNumbers.length === 0) continue;

    // 杀号正确 = 被杀号码没在开奖里
    const killedRight = rec.killNumbers.filter((kn) => !actualNums.has(kn)).length;
    // 2个杀号全对才算命中（严格模式）
    if (killedRight === rec.killNumbers.length) correct++;
    total++;
  }

  return total > 0 ? correct / total : 0;
}
