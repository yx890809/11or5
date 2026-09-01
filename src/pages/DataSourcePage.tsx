// 数据接入页
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Download, Save, ClipboardPaste, Sparkles, ArrowRight, Loader2, Image } from "lucide-react";
import type { DataFormat, DataSource, LotteryRecord } from "@/types";
import { fetchLottery, parseRaw } from "@/lib/api";
import { genDemoRecords, extractFromMessyText } from "@/lib/analyzer";
import * as storage from "@/lib/storage";
import { useLotteryStore } from "@/store";
import DataPreview from "@/components/DataPreview";
import DataSourceList from "@/components/DataSourceList";

type Tab = "url" | "manual" | "img";

export default function DataSourcePage() {
  const navigate = useNavigate();
  const setRecords = useLotteryStore((s) => s.setRecords);

  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DataFormat>("json");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");
  const [imgRaw, setImgRaw] = useState("");
  const [preview, setPreview] = useState<LotteryRecord[]>([]);

  // 切换 tab 时自动设置合适的默认格式
  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "manual") setFormat("text");
    else if (t === "url") setFormat("json");
  };

  const handleFetch = async (src?: { url: string; format: DataFormat }) => {
    const targetUrl = src?.url ?? url;
    const targetFmt = src?.format ?? format;
    if (!targetUrl) {
      setError("请输入数据链接");
      return;
    }
    setLoading(true);
    setError("");
    const result = await fetchLottery(targetUrl, targetFmt);
    setLoading(false);
    if (!result.ok || !result.data || result.data.length === 0) {
      setError(result.error || "未解析到有效数据");
      if (result.raw) setRaw(result.raw);
      return;
    }
    setPreview(result.data);
  };

  const handleParseManual = () => {
    setError("");
    const data = parseRaw(raw, format);
    if (data.length === 0) {
      setError(
        "解析到 0 条记录。请确认每行包含「期号（6位+）+ 5个1-11的号码」，支持空格/逗号分隔。\n" +
          "示例：020047 1 5 2 2 6  或  20260901-002 03,07,08,01,05",
      );
      return;
    }
    setPreview(data);
  };

  const handleSave = () => {
    if (!url) {
      setError("请先填写数据链接");
      return;
    }
    storage.addSource({
      name: name || `数据源 ${storage.listSources().length + 1}`,
      url,
      format,
      isDefault: storage.listSources().length === 0,
    });
    setName("");
  };

  const loadRecords = (records: LotteryRecord[]) => {
    setRecords(records);
    navigate("/dashboard");
  };

  const useSource = (src: DataSource) => {
    setUrl(src.url);
    setFormat(src.format);
    handleFetch(src);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
          数据接入
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          接入外部开奖数据链接，或手动录入历史号码，程序将基于此进行杀号分析
        </p>
      </header>

      {/* 方式切换 */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => switchTab("url")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            tab === "url"
              ? "bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/40"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          <Link2 className="h-4 w-4" /> 外部链接
        </button>
        <button
          onClick={() => switchTab("manual")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            tab === "manual"
              ? "bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/40"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          <ClipboardPaste className="h-4 w-4" /> 手动录入
        </button>
        <button
          onClick={() => switchTab("img")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            tab === "img"
              ? "bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/40"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          <Image className="h-4 w-4" /> 图片文本提取
        </button>
      </div>

      {tab === "url" ? (
        <section className="panel mb-6">
          <div className="panel-header">
            <Link2 className="h-4 w-4 text-cyan-400" /> 外部数据链接
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="input-field flex-1"
                placeholder="https://example.com/11x5/history.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <select
                className="input-field md:w-32"
                value={format}
                onChange={(e) => setFormat(e.target.value as DataFormat)}
              >
                <option value="json">JSON 格式</option>
                <option value="text">文本格式</option>
              </select>
              <button className="btn-gold" onClick={() => handleFetch()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                拉取数据
              </button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="input-field flex-1"
                placeholder="数据源名称（可选，用于保存）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn-ghost" onClick={handleSave}>
                <Save className="h-4 w-4" /> 保存为数据源
              </button>
            </div>
            <div className="rounded-lg border border-white/5 bg-void-900/40 p-3 text-xs text-slate-500">
              <div className="mb-1 font-semibold text-slate-400">支持的数据格式：</div>
              <div className="mb-1">JSON：<code className="text-cyan-400">[{"{issue, numbers}"}]</code></div>
              <div>文本：每行 <code className="text-cyan-400">期号 号1,号2,号3,号4,号5</code>（分隔符支持空格/逗号）</div>
            </div>
          </div>
        </section>
      ) : tab === "manual" ? (
        <section className="panel mb-6">
          <div className="panel-header">
            <ClipboardPaste className="h-4 w-4 text-cyan-400" /> 手动录入 / 粘贴
          </div>
          <div className="space-y-3 p-4">
            <textarea
              className="input-field min-h-[160px] font-mono text-xs leading-relaxed"
              placeholder={
                "020047  1  5  2  2  6\n" +
                "020046  7  5  4  1  6\n" +
                "020045  7  2  3  3  8\n" +
                "…（每行：期号 + 空格 + 5个号码，支持多种分隔符）"
              }
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="flex gap-3">
              <select
                className="input-field w-32"
                value={format}
                onChange={(e) => setFormat(e.target.value as DataFormat)}
              >
                <option value="json">JSON 格式</option>
                <option value="text">文本格式</option>
              </select>
              <button className="btn-gold" onClick={handleParseManual}>
                <Sparkles className="h-4 w-4" /> 解析数据
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "img" ? (
        <section className="panel mb-6">
          <div className="panel-header">
            <Image className="h-4 w-4 text-cyan-400" /> 图片文本智能提取
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-slate-400">
              <strong className="text-cyan-400">使用方法：</strong>
              从 11选5 走势图/开奖页面复制文字内容（包括期号、开奖号码、走势图标记等），
              粘贴到下方文本框。程序会自动从杂乱文本中识别期号（6位以上纯数字）和开奖号码（1-11）。
              <br />
              <span className="text-slate-500">
                示例：从开奖表格网页选中复制，或对图片做 OCR（微信/夸克扫描王）后粘贴文字。
              </span>
            </div>
            <textarea
              className="input-field min-h-[200px] font-mono text-xs leading-relaxed"
              placeholder={
                "期号      开奖号码\n20260901-002  1 3 10 8 4\n20260901-003  6 9 11 10 8\n...（随便什么格式都行）"
              }
              value={imgRaw}
              onChange={(e) => setImgRaw(e.target.value)}
            />
            <button
              className="btn-gold"
              onClick={() => {
                setError("");
                const data = extractFromMessyText(imgRaw);
                if (data.length === 0) {
                  setError(
                    "没能从文本里提取到有效记录。请确认文本中包含期号（6位以上数字）和 1-11 的号码，或换更清晰的文本试试。",
                  );
                  return;
                }
                setPreview(data);
              }}
            >
              <Sparkles className="h-4 w-4" /> 智能提取期号与号码
            </button>
          </div>
        </section>
      ) : null}

      {error && (
        <div className="mb-4 rounded-lg border border-kill/30 bg-kill/10 px-4 py-2.5 text-sm text-kill">
          {error}
        </div>
      )}

      {/* 预览 */}
      <section className="panel mb-6">
        <div className="panel-header justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" /> 数据预览
          </span>
          {preview.length > 0 && (
            <span className="text-xs text-slate-500">{preview.length} 条记录</span>
          )}
        </div>
        <div className="p-3">
          <DataPreview records={preview} />
        </div>
        {preview.length > 0 && (
          <div className="border-t border-white/5 p-3">
            <button className="btn-gold w-full" onClick={() => loadRecords(preview)}>
              载入并分析 <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* 数据源列表 */}
      <section className="panel">
        <div className="panel-header">
          <Save className="h-4 w-4 text-cyan-400" /> 我的数据源
        </div>
        <div className="p-3">
          <DataSourceList onUse={useSource} />
        </div>
      </section>

      {/* 演示入口 */}
      <div className="mt-6 flex justify-center">
        <button
          className="btn-ghost"
          onClick={() => {
            const demo = genDemoRecords(40);
            setPreview(demo);
            loadRecords(demo);
          }}
        >
          <Sparkles className="h-4 w-4 text-gold-400" /> 没有链接？载入演示数据体验
        </button>
      </div>
    </div>
  );
}
