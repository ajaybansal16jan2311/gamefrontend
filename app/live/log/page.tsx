"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getPublicCurrentResult, getPublicNow, type PublicCurrentResult } from "@/lib/api";
import {
  clearSpinLogs,
  getSpinLogs,
  getSpinLogsFromStorage,
  subscribeSpinLogs,
  type SpinLogEntry,
  type SpinLogType,
} from "../spinDebugStore";

const IST = "Asia/Kolkata";

/* Same as live page – har segment 36°, pointer top pe (12 o'clock) */
const WHEEL_SEGMENTS: { color: string; number: number }[] = [
  { color: "#16a34a", number: 0 },
  { color: "#0ea5e9", number: 1 },
  { color: "#9333ea", number: 2 },
  { color: "#2563eb", number: 3 },
  { color: "#dc2626", number: 4 },
  { color: "#ea580c", number: 5 },
  { color: "#ca8a04", number: 6 },
  { color: "#db2777", number: 7 },
  { color: "#0d9488", number: 8 },
  { color: "#d97706", number: 9 },
];

const SEGMENT_DEG = 360 / WHEEL_SEGMENTS.length; // 36

function formatIST(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatISTFull(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

type WheelLog = {
  segmentIndex: number;
  segmentNumber: number;
  angleCenter: number;
  angleStart: number;
  angleEnd: number;
  color: string;
};

type LogRow = {
  id: string;
  timestamp: number;
  istTime: string;
  istFull: string;
  resultNumber: string;
  digit1: string;
  digit2: string;
  wheel1: WheelLog | null;
  wheel2: WheelLog | null;
  gameName: string | null;
};

function buildWheelLog(digit: string): WheelLog | null {
  const d = digit === "—" || digit === "" ? null : parseInt(digit, 10);
  if (d === null || Number.isNaN(d) || d < 0 || d > 9) return null;
  const seg = WHEEL_SEGMENTS[d];
  return {
    segmentIndex: d,
    segmentNumber: seg.number,
    angleCenter: d * SEGMENT_DEG + SEGMENT_DEG / 2,
    angleStart: d * SEGMENT_DEG,
    angleEnd: (d + 1) * SEGMENT_DEG,
    color: seg.color,
  };
}

function buildLogRow(
  result: PublicCurrentResult | null,
  nowMs: number,
  index: number
): LogRow {
  const istTime = formatIST(nowMs);
  const istFull = formatISTFull(nowMs);
  const resultNumber = result?.resultNumber ?? "—";
  const digit1 = resultNumber.length >= 1 ? resultNumber[0] : "—";
  const digit2 = resultNumber.length >= 2 ? resultNumber[1] : "—";
  return {
    id: `${nowMs}-${index}`,
    timestamp: nowMs,
    istTime,
    istFull,
    resultNumber,
    digit1,
    digit2,
    wheel1: buildWheelLog(digit1),
    wheel2: buildWheelLog(digit2),
    gameName: result?.gameName ?? result?.gameId?.name ?? null,
  };
}

/** One line text for copy – full detail */
function rowToTextLine(r: LogRow): string {
  const w1 = r.wheel1
    ? `segment=${r.wheel1.segmentNumber} angle=${r.wheel1.angleCenter}deg range=${r.wheel1.angleStart}-${r.wheel1.angleEnd}deg color=${r.wheel1.color}`
    : "—";
  const w2 = r.wheel2
    ? `segment=${r.wheel2.segmentNumber} angle=${r.wheel2.angleCenter}deg range=${r.wheel2.angleStart}-${r.wheel2.angleEnd}deg color=${r.wheel2.color}`
    : "—";
  return [
    r.istFull,
    `Time=${r.istTime}`,
    `Result=${r.resultNumber}`,
    `digit1=${r.digit1} digit2=${r.digit2}`,
    `Game=${r.gameName ?? "—"}`,
    `Wheel1: ${w1}`,
    `Wheel2: ${w2}`,
  ].join(" | ");
}

const MAX_LOG_ROWS = 300;

/** Chronological order = reverse of getSpinLogs() (newest first in store). */
function computeOverlappingSpinRequestIds(entries: SpinLogEntry[]): Set<string> {
  const chronological = [...entries].reverse();
  const overlapping = new Set<string>();
  let spinInProgress = false;
  for (const e of chronological) {
    if (e.type === "SPIN_REQUEST") {
      if (spinInProgress) overlapping.add(e.id);
      spinInProgress = true;
    } else if (e.type === "SPIN_COMPLETE" || e.type === "RESET") {
      spinInProgress = false;
    }
  }
  return overlapping;
}

const SPIN_LOG_TYPE_COLORS: Record<SpinLogType, string> = {
  SPIN_REQUEST: "text-amber-400",
  SPIN_IGNORED: "text-slate-500",
  ANIMATION_START: "text-blue-400",
  ANIM_PROGRESS: "text-cyan-400",
  MICRO_START: "text-violet-400",
  SPIN_COMPLETE: "text-emerald-400",
  RESET: "text-slate-400",
  CANCEL_PREVIOUS: "text-orange-400",
  ERROR: "text-red-400",
};

export default function LiveSpinnerLogPage() {
  const { data: currentResult } = useQuery({
    queryKey: ["public", "current-result"],
    queryFn: getPublicCurrentResult,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const { data: nowData } = useQuery({
    queryKey: ["public", "now-time"],
    queryFn: getPublicNow,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const [rows, setRows] = useState<LogRow[]>([]);
  const [spinLogs, setSpinLogs] = useState<SpinLogEntry[]>(() => {
    const mem = getSpinLogs();
    if (mem.length > 0) return mem;
    return getSpinLogsFromStorage();
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [copySpinLogMessage, setCopySpinLogMessage] = useState<string | null>(null);
  const spinLogEndRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);
  const resultRef = useRef<PublicCurrentResult | null>(null);
  const nowMsRef = useRef<number>(Date.now());
  const lastLoggedResultRef = useRef<string | null>(null);

  useEffect(() => {
    setSpinLogs((prev) => {
      const mem = getSpinLogs();
      const stored = getSpinLogsFromStorage();
      if (mem.length >= stored.length) return mem;
      return stored;
    });
    const unsub = subscribeSpinLogs(() => setSpinLogs(getSpinLogs()));
    const onStorage = (e: StorageEvent) => {
      if (e.key === "spin-debug-logs" && e.newValue != null) {
        try {
          const parsed = JSON.parse(e.newValue) as SpinLogEntry[];
          if (Array.isArray(parsed)) setSpinLogs(parsed);
        } catch {
          setSpinLogs(getSpinLogsFromStorage());
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && spinLogEndRef.current) spinLogEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [spinLogs.length, autoScroll]);

  const overlappingIds = computeOverlappingSpinRequestIds(spinLogs);

  const copyAllSpinLogs = () => {
    const fromMemory = getSpinLogs();
    const fromStorage = getSpinLogsFromStorage();
    const logs = fromMemory.length >= fromStorage.length ? fromMemory : fromStorage;
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopySpinLogMessage("Logs copied to clipboard");
        setTimeout(() => setCopySpinLogMessage(null), 2500);
      })
      .catch(() => {
        setCopySpinLogMessage("Clipboard copy failed");
        setTimeout(() => setCopySpinLogMessage(null), 2500);
      });
  };

  resultRef.current = currentResult ?? null;
  nowMsRef.current = nowData?.timestamp ?? Date.now();

  const resultNumber = currentResult?.resultNumber ?? "";

  useEffect(() => {
    if (!resultNumber) return;

    if (lastLoggedResultRef.current === resultNumber) {
      return;
    }

    lastLoggedResultRef.current = resultNumber;

    const nowMs = nowMsRef.current;
    const result = resultRef.current;
    setRows((prev) => {
      const newRow = buildLogRow(result, nowMs, tickRef.current++);
      return [newRow, ...prev].slice(0, MAX_LOG_ROWS);
    });
  }, [resultNumber]);

  const textLog = [...rows].reverse().map(rowToTextLine).join("\n");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  const copyText = () => {
    if (!textLog) return;
    navigator.clipboard.writeText(textLog).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetLogs = () => {
    setRows([]);
    tickRef.current = 0;
    lastLoggedResultRef.current = null;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Spinner Detail Log</h1>
            <p className="mt-1 text-sm text-slate-400">
              Har second log, text form me — copy karke use kar sakte ho
            </p>
          </div>
          <Link
            href="/live"
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            ← Live page
          </Link>
        </div>

        {/* Spin debug log – useSpinEngine lifecycle */}
        <section className="mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-300">Spin debug log (useSpinEngine)</h2>
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Auto-scroll
              </label>
              <button
                type="button"
                onClick={copyAllSpinLogs}
                className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
              >
                Copy All Logs
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSpinLogs();
                  setSpinLogs([]);
                }}
                className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
              >
                Clear logs
              </button>
              {copySpinLogMessage != null && (
                <span
                  className={`text-sm ${copySpinLogMessage.startsWith("Clipboard") ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {copySpinLogMessage}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2 font-mono text-xs">
            {spinLogs.length === 0 ? (
              <p className="py-4 text-center text-slate-500">
                Spin debug logs yahan dikhenge. Live page pe spin karo, then yahan events aayenge.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {spinLogs.map((entry) => {
                  const isError = entry.type === "ERROR";
                  const isOverlapping = entry.type === "SPIN_REQUEST" && overlappingIds.has(entry.id);
                  return (
                    <li
                      key={entry.id}
                      className={`rounded border px-2 py-1.5 ${
                        isError
                          ? "border-red-500/60 bg-red-950/40"
                          : isOverlapping
                            ? "border-amber-500/60 bg-amber-950/20"
                            : "border-slate-700/70 bg-slate-800/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className={`font-semibold ${SPIN_LOG_TYPE_COLORS[entry.type]}`}>
                          {entry.type}
                        </span>
                        <span className="text-slate-500">
                          t={entry.timestamp.toFixed(1)}ms
                        </span>
                      </div>
                      {entry.data != null && Object.keys(entry.data as object).length > 0 && (
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-slate-300">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={spinLogEndRef} />
          </div>
        </section>

        {/* Text format – easy to copy */}
        <section className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-300">Detail log (text – copy karne ke liye)</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyText}
                disabled={!textLog}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {copied ? "Copied!" : "Copy full log"}
              </button>
              <button
                type="button"
                onClick={resetLogs}
                className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
              >
                Reset logs
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            readOnly
            className="w-full min-h-[280px] rounded-xl border border-slate-600 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={textLog || "Log yahan dikhega — har second nayi line add hogi. Thoda wait karo."}
            spellCheck={false}
          />
        </section>

        {/* Table view (optional) */}
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/90">
                <th className="px-3 py-3 font-semibold text-slate-300">Time (IST)</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Full date/time</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Result</th>
                <th className="px-3 py-3 font-semibold text-slate-300">Game</th>
                <th className="px-3 py-3 font-semibold text-amber-400">Wheel 1 (left)</th>
                <th className="px-3 py-3 font-semibold text-amber-400">Wheel 2 (right)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Log start hoga 1 second me — interval ab rukta nahi
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-700/70 hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-200">
                      {r.istTime}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                      {r.istFull}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono font-bold text-amber-400">
                        {r.resultNumber}
                      </span>
                      <span className="ml-2 text-slate-500">
                        (d1: {r.digit1}, d2: {r.digit2})
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 text-slate-400">
                      {r.gameName ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.wheel1 ? (
                        <div className="space-y-0.5">
                          <span
                            className="inline-block h-5 w-5 rounded border border-white/20"
                            style={{ backgroundColor: r.wheel1.color }}
                            title={r.wheel1.color}
                          />
                          <span className="ml-1 font-mono text-white">
                            #{r.wheel1.segmentNumber}
                          </span>
                          <div className="text-xs text-slate-400">
                            angle: {r.wheel1.angleCenter}° ({r.wheel1.angleStart}°–{r.wheel1.angleEnd}°)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.wheel2 ? (
                        <div className="space-y-0.5">
                          <span
                            className="inline-block h-5 w-5 rounded border border-white/20"
                            style={{ backgroundColor: r.wheel2.color }}
                            title={r.wheel2.color}
                          />
                          <span className="ml-1 font-mono text-white">
                            #{r.wheel2.segmentNumber}
                          </span>
                          <div className="text-xs text-slate-400">
                            angle: {r.wheel2.angleCenter}° ({r.wheel2.angleStart}°–{r.wheel2.angleEnd}°)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>Har second nayi line (refs se interval stable — rukta nahi). Max {MAX_LOG_ROWS} rows.</span>
          <span>Upar wala text box select karke copy kar sakte ho ya &quot;Copy full log&quot; use karo.</span>
        </div>
      </div>
    </main>
  );
}
