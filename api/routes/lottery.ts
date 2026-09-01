/**
 * 开奖数据代理接口
 * 解决浏览器跨域限制，拉取外部数据链接并解析
 */
import { Router, type Request, type Response, type NextFunction } from "express";

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
router.post("/fetch", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { url, format } = req.body ?? {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ success: false, error: "缺少 url 参数" });
    return;
  }
  const fmt: "json" | "text" = format === "json" ? "json" : "text";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 15000);

    let fetchResp: globalThis.Response;
    try {
      fetchResp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (LotteryAnalyzer/2.0)",
          Accept: "application/json, text/plain, */*",
        },
        redirect: "follow",
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg = (fetchErr as Error).message;
      // 区分不同错误类型
      let hint = "";
      if (msg.includes("aborted") || msg.includes("timeout")) hint = "（请求超时，目标服务器响应太慢）";
      else if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) hint = "（DNS 解析失败或目标服务器不存在）";
      else if (msg.includes("certificate") || msg.includes("SSL")) hint = "（SSL 证书错误）";
      res.status(502).json({
        success: false,
        error: `无法连接到目标服务器: ${msg} ${hint}`,
      });
      return;
    }
    clearTimeout(timer);

    const raw = await fetchResp.text();

    // 即使 HTTP 4xx/5xx 也尝试解析响应内容（有些 API 返回错误 JSON）
    if (!fetchResp.ok) {
      let parsed: unknown = null;
      try { parsed = JSON.parse(raw); } catch { /* ignore */ }

      // 检查目标返回的业务错误
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        res.status(502).json({
          success: false,
          error: `目标返回错误 (HTTP ${fetchResp.status}): ${(parsed as { error: string }).error}`,
          raw,
        });
        return;
      }
      if (parsed && typeof parsed === "object" && "msg" in parsed) {
        res.status(502).json({
          success: false,
          error: `目标返回错误 (HTTP ${fetchResp.status}): ${(parsed as { msg: string }).msg}`,
          raw,
        });
        return;
      }

      res.status(502).json({
        success: false,
        error: `目标返回 HTTP ${fetchResp.status} (${fetchResp.statusText})，内容: ${raw.slice(0, 200)}`,
        raw,
      });
      return;
    }

    // HTTP 2xx — 尝试解析
    let data: LotteryRecord[] = [];
    try {
      data = fmt === "json" ? parseJson(raw) : parseText(raw);
    } catch (parseErr) {
      res.status(200).json({
        success: false,
        error: `解析失败: ${(parseErr as Error).message}（格式不匹配？试试切换格式）`,
        raw: raw.slice(0, 500),
      });
      return;
    }

    if (data.length === 0) {
      res.status(200).json({
        success: false,
        error: "解析成功但未找到有效记录（检查字段名是否匹配: issue/expect/qihao + numbers/openCode/code）",
        raw: raw.slice(0, 500),
      });
      return;
    }

    res.json({ success: true, data, raw: raw.slice(0, 500) });
  } catch (e) {
    next(e); // 交给全局错误处理器（开发模式会打印真实错误）
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

/**
 * GET /api/lottery/builtin
 * 内置开奖源：江西11选5（全国联网）
 * 硬编码目标 jxlottery.vip 的真实 AJAX API，后端代理绕过 CORS
 */
const BUILTIN_SOURCES: Record<string, { url: string; label: string }> = {
  jx11x5: {
    url: "https://www.jxlottery.vip/api/game-lottery/list-lottery-open-code-history?lottery=jx11x5&page=0&size=50",
    label: "江西11选5",
  },
};

router.get("/builtin", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const source = (req.query.source as string) || "jx11x5";
  const cfg = BUILTIN_SOURCES[source];
  if (!cfg) {
    res.status(400).json({ success: false, error: `未知数据源: ${source}` });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const fetchResp = await fetch(cfg.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (LotteryAnalyzer/2.0)",
        Accept: "application/json, text/plain, */*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!fetchResp.ok) {
      res.status(502).json({
        success: false,
        error: `数据源返回 HTTP ${fetchResp.status}`,
      });
      return;
    }

    const raw = await fetchResp.text();
    const json = JSON.parse(raw);

    // jxlottery.vip 结构: { error: 0, data: { list: [...], totalNum } }
    const list: Array<{ issue: string; openCode: string; openTime?: string }> =
      json?.data?.list ?? [];

    const records: (LotteryRecord & { openTime?: string })[] = [];
    const seenIssues = new Set<string>();

    for (const item of list) {
      if (!item?.issue || !item?.openCode) continue;
      if (seenIssues.has(item.issue)) continue;
      seenIssues.add(item.issue);

      // openCode 格式: "04,09,08,10,06"
      const numbers = sanitizeNumbers(
        item.openCode.split(",").map((s) => Number(s.trim())),
      );
      if (numbers.length >= 2) {
        records.push({
          issue: item.issue,
          numbers,
          openTime: item.openTime,
        });
      }
    }

    if (records.length === 0) {
      res.status(200).json({
        success: false,
        error: "数据源解析成功但未找到有效开奖记录",
        raw: raw.slice(0, 500),
      });
      return;
    }

    res.json({
      success: true,
      data: records,
      totalNum: json?.data?.totalNum ?? records.length,
      source: cfg.label,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg?.includes("aborted")) {
      res.status(504).json({ success: false, error: "数据源请求超时（15s）" });
      return;
    }
    next(e);
  }
});

export default router;
