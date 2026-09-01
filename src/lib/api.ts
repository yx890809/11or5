// 后端接口调用
import type { DataFormat, LotteryRecord } from "@/types";
import { parseJson, parseText } from "./analyzer";

const BASE = "/api";

export interface FetchResult {
  ok: boolean;
  data?: LotteryRecord[];
  raw?: string;
  error?: string;
}

/** 通过后端代理拉取外部数据 */
export async function fetchLottery(url: string, format: DataFormat): Promise<FetchResult> {
  try {
    const resp = await fetch(`${BASE}/lottery/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      // 若后端不可用，回退到前端直连尝试
      return await directFetch(url, format);
    }
    return { ok: true, data: json.data, raw: json.raw };
  } catch (e) {
    // 后端代理失败时回退前端直连（可能受 CORS 限制）
    return await directFetch(url, format);
  }
}

/** 前端直连拉取（CORS 允许时可用） */
async function directFetch(url: string, format: DataFormat): Promise<FetchResult> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    const raw = await resp.text();
    const data = parseRaw(raw, format);
    if (data.length === 0) {
      return { ok: false, error: "解析到0条记录，请检查格式或链接", raw };
    }
    return { ok: true, data, raw };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "拉取失败，可能受跨域限制" };
  }
}

/** 解析原始文本 */
export function parseRaw(raw: string, format: DataFormat): LotteryRecord[] {
  try {
    if (format === "json") return parseJson(raw);
    return parseText(raw);
  } catch {
    return [];
  }
}
