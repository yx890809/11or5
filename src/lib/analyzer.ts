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

export const DEFAULT_OPTIONS: AnalyzerOptions = {
  window: 30,
  killCount: 1,        // 默认只杀1个号（理论正确率55%，比杀2个的27%高一倍）
  consensusMin: 3,     // 至少3种方法同时指向才杀（宁缺毋滥）
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
    killCount: opts.killCount ?? DEFAULT_OPTIONS.killCount,
    consensusMin: opts.consensusMin ?? DEFAULT_OPTIONS.consensusMin,
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
 * AI 策略进化引擎 - 网格搜索最优权重组合
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
