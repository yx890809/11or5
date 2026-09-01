// 11选5 杀号算法核心
import type {
  LotteryRecord,
  NumberStat,
  ScoreDetail,
  KillRecommendation,
  AnalyzerOptions,
  HitRateStats,
  PredictionHistoryItem,
} from "@/types";

export const DEFAULT_OPTIONS: AnalyzerOptions = {
  window: 30,
  weights: {
    hotCold: 0.25,
    limit: 0.15,
    headTail: 0.10,
    omit: 0.10,
    repeat: 0.20,
    neighbor: 0.10,
    sum: 0.10,
  },
};

/** 兜底：把传入的 options 补全为完整结构（防止旧版 localStorage 残缺字段） */
function normalizeOptions(opts?: Partial<AnalyzerOptions>): AnalyzerOptions {
  if (!opts) return { ...DEFAULT_OPTIONS };
  return {
    window: opts.window ?? DEFAULT_OPTIONS.window,
    weights: {
      ...DEFAULT_OPTIONS.weights,
      ...(opts.weights ?? {}),
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

  const details: ScoreDetail[] = stats.map((s) => {
    const methods: string[] = [];

    // 冷热分：最热(频次最高) 与 最冷(遗漏最长) 取大者，极端者得高分
    const freqPart = norm01(s.freq, minFreq, maxFreq); // 越热越高
    const omitPart = s.currentOmit / maxOmit; // 越冷越高
    const hotRaw = Math.max(freqPart, omitPart);
    const hotScore = Math.round(hotRaw * 100 * options.weights.hotCold);
    if (hotRaw >= 0.75) methods.push("冷热法");

    // 极限分：连开 >= 3 期（11选5每期5个号，同一号连中3期已属罕见）
    let limitRaw = 0;
    if (s.consecutive >= 4) {
      limitRaw = 1;
      methods.push("极限法");
    } else if (s.consecutive >= 3) {
      limitRaw = 0.6;
      methods.push("极限法");
    }
    const limitScore = Math.round(limitRaw * 100 * options.weights.limit);

    // 首尾差分
    let htRaw = 0;
    if (headTailActive && s.num === headTailDiff) {
      htRaw = 1;
      methods.push("首尾差法");
    }
    const headTailScore = Math.round(htRaw * 100 * options.weights.headTail);

    // 遗漏值分：当前遗漏 >= 历史90% 视为极端冷态可杀
    let omitRaw = 0;
    if (s.maxOmit > 0 && s.currentOmit >= s.maxOmit * 0.9) {
      omitRaw = 1;
      methods.push("遗漏法");
    } else if (s.maxOmit > 0 && s.currentOmit >= s.maxOmit * 0.7) {
      omitRaw = 0.5;
    }
    const omitScore = Math.round(omitRaw * 100 * options.weights.omit);

    // 重号杀号：连续 3 期以上每期都开出的号码，下期大概率不再重
    let repeatRaw = 0;
    if (s.repeatStreak >= 4) {
      repeatRaw = 1;
      methods.push("重号法");
    } else if (s.repeatStreak >= 3) {
      repeatRaw = 0.7;
      methods.push("重号法");
    }
    const repeatScore = Math.round(repeatRaw * 100 * options.weights.repeat);

    // 邻号远离杀号：距离上期所有号码差距都 >= 3（即号码周围3格内都没上期开奖号）
    let neighborRaw = 0;
    if (lastNums.length > 0) {
      const minDist = Math.min(...lastNums.map((n) => Math.abs(s.num - n)));
      if (minDist >= 3) {
        neighborRaw = 1;
        methods.push("邻号法");
      } else if (minDist === 2) {
        neighborRaw = 0.5;
        methods.push("邻号法");
      }
    }
    const neighborScore = Math.round(neighborRaw * 100 * options.weights.neighbor);

    // 和值极值杀号：最近3期和值偏大 → 杀大号；偏小 → 杀小号
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

    const score = hotScore + limitScore + headTailScore + omitScore + repeatScore + neighborScore + sumScore;

    return {
      num: s.num,
      score,
      methods: Array.from(new Set(methods)),
      hotScore,
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
 * 推荐 2 个杀号
 * 优先保证"一热一冷"组合，提升稳健性
 */
export function recommend(
  records: LotteryRecord[],
  options: AnalyzerOptions = DEFAULT_OPTIONS,
): KillRecommendation {
  options = normalizeOptions(options);
  const { stats, details } = scoreNumbers(records, options);
  const byScore = [...details].sort((a, b) => b.score - a.score);

  const kill: ScoreDetail[] = [];
  if (byScore.length === 0) {
    return { killNumbers: [], details };
  }
  // 第一名直接入选
  kill.push(byScore[0]);

  // 找一个与第一名互补的（若第一名偏热，则补一个偏冷的；反之亦然）
  const firstStat = stats.find((s) => s.num === kill[0].num)!;
  const firstIsHot = firstStat && firstStat.freqRate >= 0.4;
  const candidates = byScore.filter((d) => d.num !== kill[0].num);
  let second: ScoreDetail | undefined;
  if (firstIsHot) {
    // 偏热 → 补偏冷（遗漏最大者）
    second = [...candidates].sort((a, b) => {
      const oa = stats.find((s) => s.num === a.num)!.currentOmit;
      const ob = stats.find((s) => s.num === b.num)!.currentOmit;
      // 综合遗漏与得分
      return ob * 10 + b.score - (oa * 10 + a.score);
    })[0];
  } else {
    // 偏冷 → 补偏热（频次最高者）
    second = [...candidates].sort((a, b) => {
      const fa = stats.find((s) => s.num === a.num)!.freq;
      const fb = stats.find((s) => s.num === b.num)!.freq;
      return fb * 10 + b.score - (fa * 10 + a.score);
    })[0];
  }
  if (second) kill.push(second);

  return {
    killNumbers: kill.map((k) => k.num),
    details: byScore,
  };
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

/** 根据各方法命中率自动微调权重 */
export function autoAdjustWeights(
  history: PredictionHistoryItem[],
  current: AnalyzerOptions,
): AnalyzerOptions {
  const stats = computeHitRate(history);
  if (stats.totalVerified < 5) return current; // 数据太少不动
  const W = { ...current.weights };
  const CLAMP = { min: 0.05, max: 0.45 };
  const STEP = 0.03;

  // 方法名 → options.weights 的 key
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
    if (!m || m.total < 3) continue; // 样本太少不动
    if (m.rate > 0.65) {
      W[key] = Math.min(CLAMP.max, W[key] + STEP);
    } else if (m.rate < 0.40) {
      W[key] = Math.max(CLAMP.min, W[key] - STEP);
    }
  }

  // 归一化：让权重总和回到 ~1.0
  const sum = Object.values(W).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const k of Object.keys(W) as (keyof AnalyzerOptions["weights"])[]) {
      W[k] = Math.round((W[k] / sum) * 100) / 100;
    }
  }

  return { ...current, weights: W };
}
