/**
 * 开奖数据代理接口
 * 解决浏览器跨域限制，拉取外部数据链接并解析
 */
import { Router, type Request, type Response } from "express";

interface LotteryRecord {
  issue: string;
  numbers: number[];
}

const router = Router();

function sanitizeNumbers(nums: unknown): number[] {
  if (!Array.isArray(nums)) return [];
  return Array.from(
    new Set(
      nums
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 11),
    ),
  );
}

/** 解析文本：期号 号1,号2,号3,号4,号5 */
function parseText(raw: string): LotteryRecord[] {
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
    if (numbers.length >= 2) records.push({ issue, numbers });
  }
  return records;
}

/** 解析 JSON：兼容多种字段命名 */
function parseJson(raw: string): LotteryRecord[] {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : data?.data ?? data?.list ?? [];
  const records: LotteryRecord[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const issue = String(item.issue ?? item.expect ?? item.qihao ?? item.period ?? "");
    let numbers: number[] = [];
    const cand = item.numbers ?? item.openCode ?? item.opencode ?? item.code ?? item.result ?? item.kjhm;
    if (Array.isArray(cand)) {
      numbers = sanitizeNumbers(cand);
    } else if (typeof cand === "string") {
      numbers = sanitizeNumbers(cand.split(/[,，\s]+/).map((n) => Number(n)));
    }
    if (issue && numbers.length >= 2) records.push({ issue, numbers });
  }
  return records;
}

/**
 * POST /api/lottery/fetch
 * body: { url, format }
 */
router.post("/fetch", async (req: Request, res: Response): Promise<void> => {
  const { url, format } = req.body ?? {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ success: false, error: "缺少 url 参数" });
    return;
  }
  const fmt: "json" | "text" = format === "json" ? "json" : "text";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (LotteryAnalyzer/1.0)" },
    });
    clearTimeout(timer);
    if (!resp.ok) {
      res.status(502).json({ success: false, error: `目标返回 HTTP ${resp.status}` });
      return;
    }
    const raw = await resp.text();
    let data: LotteryRecord[] = [];
    try {
      data = fmt === "json" ? parseJson(raw) : parseText(raw);
    } catch (e) {
      res.status(200).json({ success: false, error: "解析失败", raw });
      return;
    }
    res.json({ success: true, data, raw });
  } catch (e) {
    res.status(502).json({ success: false, error: (e as Error).message || "拉取失败" });
  }
});

/**
 * POST /api/lottery/parse
 * body: { raw, format }
 */
router.post("/parse", (req: Request, res: Response): void => {
  const { raw, format } = req.body ?? {};
  if (typeof raw !== "string") {
    res.status(400).json({ success: false, error: "缺少 raw 参数" });
    return;
  }
  const fmt: "json" | "text" = format === "json" ? "json" : "text";
  try {
    const data = fmt === "json" ? parseJson(raw) : parseText(raw);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message });
  }
});

export default router;
