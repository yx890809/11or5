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

/** 内置开奖源拉取（江西11选5，后端代理到 jxlottery.vip） */
export async function fetchBuiltin(source: string = "jx11x5"): Promise<FetchResult> {
  try {
    const resp = await fetch(`${BASE}/lottery/builtin?source=${encodeURIComponent(source)}`);
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      return { ok: false, error: json?.error || `HTTP ${resp.status}` };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "拉取内置数据源失败" };
  }
}

/** 泰国分分11选5凭证的 localStorage key */
export const THAI_TOKEN_KEY = "lottery11x5:thaiToken";

export function getThaiToken(): string {
  try {
    return localStorage.getItem(THAI_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setThaiToken(token: string): void {
  localStorage.setItem(THAI_TOKEN_KEY, token.trim());
}

/** 解析 JWT 的 exp 时间戳（毫秒），无效返回 null */
export function getThaiTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number") return payload.exp * 1000;
    return null;
  } catch {
    return null;
  }
}

/** 泰国分分11选5拉取（后端代理到 srth9u.xyz，token 透传） */
export async function fetchThai11x5(): Promise<FetchResult> {
  const token = getThaiToken();
  if (!token) {
    return { ok: false, error: "未配置访问凭证，请先点击 🔑 按钮配置" };
  }
  try {
    const resp = await fetch(`${BASE}/lottery/thai11x5`, {
      headers: { "x-thai-token": token },
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      return { ok: false, error: json?.error || `HTTP ${resp.status}` };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "拉取泰国分分11选5失败" };
  }
}

/** 解析原始文本 - 智能回退 */
export function parseRaw(raw: string, format: DataFormat): LotteryRecord[] {
  try {
    if (format === "json") {
      const result = parseJson(raw);
      if (result.length > 0) return result;
      // JSON 失败或解析到空数组 → 自动回退文本解析
      return parseText(raw);
    }
    return parseText(raw);
  } catch {
    // JSON 解析抛异常 → 回退文本
    try {
      return parseText(raw);
    } catch {
      return [];
    }
  }
}
