"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPublicCurrentResult,
  getPublicNextSlot,
  getPublicPastResults,
  getPublicNow,
  type PublicCurrentResult,
  type PublicNowResponse,
} from "@/lib/api";
import { useSpinEngine } from "./useSpinEngine";

const IST = "Asia/Kolkata";

/** Today’s date in IST as YYYY-MM-DD for date input default */
function getTodayISTYYYYMMDD(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

/** Format YYYY-MM-DD to DD/MM/YYYY for display */
function formatDateDDMMYYYY(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : yyyyMmDd;
}

/** Result number colour cycle – JS-driven so it’s never overridden by Tailwind */
const RESULT_COLORS = [
  { color: "#fbbf24", shadow: "0 0 20px rgba(251,191,36,0.7), 0 0 40px rgba(251,191,36,0.4)" },
  { color: "#38bdf8", shadow: "0 0 20px rgba(56,189,248,0.7), 0 0 40px rgba(56,189,248,0.4)" },
  { color: "#a78bfa", shadow: "0 0 20px rgba(167,139,250,0.7), 0 0 40px rgba(167,139,250,0.4)" },
  { color: "#34d399", shadow: "0 0 20px rgba(52,211,153,0.7), 0 0 40px rgba(52,211,153,0.4)" },
  { color: "#f472b6", shadow: "0 0 20px rgba(244,114,182,0.7), 0 0 40px rgba(244,114,182,0.4)" },
];

function useResultNumberColor() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % RESULT_COLORS.length);
    }, 500);
    return () => clearInterval(id);
  }, []);
  return RESULT_COLORS[index];
}

type NextSlot = Awaited<ReturnType<typeof getPublicNextSlot>>;

function formatISTFromMs(ms: number | null) {
  if (ms == null) return "";
  return new Date(ms).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function useISTClock() {
  const { data } = useQuery<PublicNowResponse | null>({
    queryKey: ["public", "now-time"],
    queryFn: getPublicNow,
    // Abhi ke liye 1 second pe server time poll kar rahe hain.
    // Agar interval change karna ho to yahi value adjust kar sakte hain.
    refetchInterval: 1000,
  });

  if (!data) return "";

  return formatISTFromMs(data.timestamp);
}

function useTodayIST() {
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(
      new Date().toLocaleDateString("en-IN", {
        timeZone: IST,
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
  }, []);
  return date;
}

function useCountdown(
  initialSeconds: number | null,
  toleranceSeconds = 30
): {
  display: string | null;
  seconds: number | null;
  parts: { h: string; m: string; s: string } | null;
} {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);

  // Jab server se naya remainingSeconds aaye, tab sirf tabhi hard reset karo
  // jab difference ±toleranceSeconds se zyada ho.
  useEffect(() => {
    if (initialSeconds == null) {
      setSeconds(null);
      return;
    }

    setSeconds((prev) => {
      if (prev == null) return initialSeconds;
      const diff = Math.abs(initialSeconds - prev);
      return diff > toleranceSeconds ? initialSeconds : prev;
    });
  }, [initialSeconds, toleranceSeconds]);

  // Local per‑second countdown – sirf jab seconds null na ho.
  useEffect(() => {
    if (seconds == null) return;

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev == null) return null;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [seconds == null]);

  if (seconds == null || seconds < 0) {
    return { display: null, seconds: null, parts: null };
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const display = `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0"
  )}:${String(s).padStart(2, "0")}`;

  const parts = {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };

  return { display, seconds, parts };
}

function formatNextSlotTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatResultDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function LivePage() {
  const istClock = useISTClock();
  const todayIST = useTodayIST();

  const queryClient = useQueryClient();

  const { data: currentResult } = useQuery({
    queryKey: ["public", "current-result"],
    queryFn: getPublicCurrentResult,
    refetchInterval: 1000,
  });

  const { data: nextSlot } = useQuery({
    queryKey: ["public", "next-slot"],
    queryFn: getPublicNextSlot,
    refetchInterval: 1000,
  });

  const lastStableResultRef = useRef<PublicCurrentResult | null>(null);
  if (currentResult?.resultNumber != null && currentResult.resultNumber !== "") {
    lastStableResultRef.current = currentResult;
  }
  const spinnerDisplayResult: PublicCurrentResult | null | undefined =
    currentResult ?? lastStableResultRef.current ?? null;

  const [showNextGameMessage, setShowNextGameMessage] = useState(false);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const prevResultKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key =
      currentResult?.resultNumber != null && currentResult?.fullDateTime != null
        ? `${currentResult.resultNumber}_${currentResult.fullDateTime}`
        : null;
    if (key == null) return;
    if (prevResultKeyRef.current != null && prevResultKeyRef.current !== key) {
      setShowNextGameMessage(true);
      setShowPartyPopper(true);
      queryClient.invalidateQueries({ queryKey: ["public", "past-results", 1] });
      const t = setTimeout(() => setShowNextGameMessage(false), 10000);
      const t2 = setTimeout(() => setShowPartyPopper(false), 5000);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
    prevResultKeyRef.current = key;
  }, [currentResult?.resultNumber, currentResult?.fullDateTime, queryClient]);

  const [singleDate, setSingleDate] = useState<string>(() => getTodayISTYYYYMMDD());
  const fromDate = singleDate || undefined;
  const toDate = singleDate || undefined;

  const { data: pastData } = useQuery({
    queryKey: ["public", "past-results", 1, fromDate, toDate],
    queryFn: () =>
      getPublicPastResults({
        page: 1,
        limit: 50,
        ...(fromDate && toDate ? { fromDate, toDate } : {}),
      }),
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-900 text-white">
      {showPartyPopper && <FullPagePartyPopper />}

      <TopSection
        istClock={istClock}
        todayIST={todayIST}
        nextSlot={nextSlot}
        spinnerDisplayResult={spinnerDisplayResult}
        showNextGameMessage={showNextGameMessage}
      />

      {/* Rest of content below fold – centered with space left & right */}
      <section className="relative z-10 w-full bg-slate-900 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-2xl md:max-w-3xl">
          <WinningNumberCard result={currentResult} />
        </div>
      </section>

      {/* Previous draws – centered with space left & right */}
      <section className="relative z-10 w-full bg-slate-900 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-2xl md:max-w-3xl">
          <h2 className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:mb-3 sm:text-xs">
            Previous draws
          </h2>

          <div className="live-date-filters mb-4 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] [color-scheme:dark] sm:px-4 sm:py-4">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
                See previous result
              </span>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="live-date-input w-full min-w-[120px] sm:min-w-[140px] sm:w-auto"
              />
            </label>
          </div>
        </div>

        <p className="mb-3 text-center text-[10px] text-slate-500 sm:mb-4">
          {singleDate
            ? `Showing results for ${formatDateDDMMYYYY(singleDate)} (IST)`
            : "Showing latest results. Select a date above to see past draws."}
        </p>

        {pastData?.items && pastData.items.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            {pastData.items.map((item) => (
              <div
                key={item._id ?? `${item.fullDateTime}-${item.resultNumber}`}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2.5 backdrop-blur-sm transition live-card-3d live-card-glow hover:border-slate-500 hover:bg-slate-700/50 sm:px-6 sm:py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 sm:text-xs md:text-sm">
                    {formatResultDateTime(item.fullDateTime)}
                  </span>
                  <span className="font-mono text-lg font-bold text-amber-400 sm:text-xl md:text-2xl">
                    {item.resultNumber}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 py-6 text-center text-sm text-slate-500 live-card-3d" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}>
            No past results yet.
          </p>
        )}
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-2xl px-3 pb-8 sm:px-4 sm:pb-10 md:max-w-3xl">
        <footer className="flex flex-wrap items-center justify-center gap-2 text-center text-[10px] text-slate-500 sm:gap-4 sm:text-xs">
          <span>All times in IST</span>
          <Link
            href="/live/log"
            className="text-amber-400/90 underline hover:text-amber-400"
          >
            Spinner detail log (har second report)
          </Link>
        </footer>
      </div>
    </main>
  );
}

function TopSection({
  istClock,
  todayIST,
  nextSlot,
  spinnerDisplayResult,
  showNextGameMessage,
}: {
  istClock: string;
  todayIST: string;
  nextSlot: NextSlot | undefined;
  spinnerDisplayResult: PublicCurrentResult | null | undefined;
  showNextGameMessage: boolean;
}) {
  const remainingSeconds: number | null =
    nextSlot != null ? nextSlot.remainingSeconds : null;

  const {
    display: countdownDisplay,
    seconds: countdownSeconds,
    parts: countdownParts,
  } = useCountdown(remainingSeconds);

  const isUrgent =
    countdownSeconds != null &&
    countdownSeconds > 0 &&
    countdownSeconds <= 60;

  return (
    <>
      {/* Dark top bar - full width, 3D + glow */}
      <section
        className="relative z-10 shrink-0 border-b border-slate-600/50 bg-slate-900/95 backdrop-blur-sm live-card-3d"
        style={{
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), 0 0 30px -5px rgba(59,130,246,0.12)",
        }}
      >
        <div className="grid w-full grid-cols-2 gap-1.5 px-2 py-2.5 sm:grid-cols-4 sm:gap-4 sm:px-6 sm:py-4 md:gap-5 md:px-8 lg:px-10 lg:py-5">
          <OrangeBarItem
            label="Next Draw Time"
            value={nextSlot ? formatNextSlotTime(nextSlot.nextSlotTime) : "—"}
          />
          <OrangeBarItem label="Today Date" value={todayIST} />
          <OrangeBarItem label="Now Time" value={istClock || "—"} />
          <TimeToDrawCell
            showNextGameMessage={showNextGameMessage}
            countdownDisplay={countdownDisplay}
          />
        </div>
      </section>

      {/* Spinner section – less top padding on wide so spinner isn’t cut at bottom */}
      <section className="relative z-10 flex flex-col pt-2 pb-2 sm:pt-3 sm:pb-4 md:pt-4 md:pb-6 lg:pt-2 lg:pb-6 xl:pt-3 xl:pb-8">
        <div className="flex h-[260px] min-h-[220px] items-center justify-center gap-2 px-1 py-2 sm:h-[320px] sm:gap-4 sm:px-4 md:h-[360px] md:gap-6 lg:h-[440px] lg:items-start lg:justify-center lg:gap-12 lg:pt-0 xl:h-[520px] xl:gap-16 xl:min-h-[480px]">
          <LuckyDrawSpinner
            result={spinnerDisplayResult}
            countdownDisplay={showNextGameMessage ? null : countdownDisplay}
            countdownSeconds={countdownSeconds}
          />
        </div>
      </section>

      {/* Digital countdown OR "Next game" message for 10s after draw */}
      <section className="relative z-10 mx-auto max-w-2xl px-3 sm:px-4 md:px-6 lg:max-w-3xl">
        {showNextGameMessage ? (
          <NextGameMessage />
        ) : (
          <>
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
              Next draw in
            </p>
            <div className="mt-1.5 flex justify-center gap-1 sm:mt-2 sm:gap-2">
              {countdownParts ? (
                <>
                  <DigitalBox value={countdownParts.h} label="Hrs" urgent={isUrgent} />
                  <span className="flex items-end pb-1 font-mono text-lg font-bold text-slate-500 sm:pb-2 sm:text-2xl">
                    :
                  </span>
                  <DigitalBox value={countdownParts.m} label="Min" urgent={isUrgent} />
                  <span className="flex items-end pb-1 font-mono text-lg font-bold text-slate-500 sm:pb-2 sm:text-2xl">
                    :
                  </span>
                  <DigitalBox value={countdownParts.s} label="Sec" urgent={isUrgent} />
                </>
              ) : (
                <div
                  className="rounded-lg border-2 border-slate-600/50 bg-slate-800/60 px-4 py-2 font-mono text-lg text-slate-400 live-card-3d sm:px-6 sm:py-3 sm:text-2xl"
                  style={{
                    boxShadow:
                      "0 4px 14px rgba(0,0,0,0.35), 0 0 20px -5px rgba(59,130,246,0.1)",
                  }}
                >
                  {countdownDisplay ?? "—"}
                </div>
              )}
            </div>
            {nextSlot && (
              <p className="mt-1.5 text-center text-xs text-slate-400 sm:mt-2 sm:text-sm">
                Draw at{" "}
                <span className="font-semibold text-slate-300">
                  {formatNextSlotTime(nextSlot.nextSlotTime)}
                </span>
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

/** "Next game" message with cycling color animation – shown for 10s after a draw ends */
function NextGameMessage() {
  return (
    <div className="next-game-message-wrap">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
        Next draw starting soon
      </p>
      <div className="next-game-message mt-2 rounded-xl border-2 border-amber-400/70 bg-slate-900/80 px-4 py-3 text-center text-sm font-bold uppercase tracking-wider sm:mt-3 sm:px-10 sm:py-6 sm:text-xl">
        Next game
      </div>
    </div>
  );
}

function DigitalBox({
  value,
  label,
  urgent,
}: {
  value: string;
  label: string;
  urgent: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-2 px-2 py-1.5 text-center font-mono text-lg font-bold tabular-nums live-card-3d live-card-glow transition-shadow sm:px-3 sm:py-2 sm:text-2xl md:px-4 md:text-3xl ${
        urgent
          ? "border-red-500/70 bg-red-950/50 text-red-400 animate-[screenFlicker_3s_ease-in-out_infinite]"
          : "border-slate-500/50 bg-slate-800/80 text-slate-200"
      }`}
      style={urgent ? undefined : { boxShadow: "0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px -5px rgba(59,130,246,0.12)" }}
    >
      <span className="block">{value}</span>
      <span className="mt-0.5 block text-[8px] font-medium uppercase tracking-wider text-slate-500 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

/** Time to Draw box: countdown normally, or "Next game" with color animation when showNextGameMessage */
function TimeToDrawCell({
  showNextGameMessage,
  countdownDisplay,
}: {
  showNextGameMessage: boolean;
  countdownDisplay: string | null;
}) {
  return (
    <div
      className="rounded-lg border border-slate-600/50 bg-slate-800/80 px-1.5 py-1.5 text-center sm:px-3 sm:py-2.5 md:px-4 md:py-2.5 live-card-3d"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px] md:text-xs">
        Time to Draw
      </p>
      {showNextGameMessage ? (
        <p className="next-game-message mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-400 sm:text-sm md:text-base">
          Next game
        </p>
      ) : (
        <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-white sm:text-sm md:text-base">
          {countdownDisplay ?? "—"}
        </p>
      )}
    </div>
  );
}

function OrangeBarItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-600/50 bg-slate-800/80 px-1.5 py-1.5 text-center sm:px-3 sm:py-2.5 md:px-4 md:py-2.5 live-card-3d" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)" }}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[10px] md:text-xs">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-white sm:text-sm md:text-base">
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-center ${
        accent
          ? "border-amber-500/30 bg-amber-950/20"
          : "border-slate-600/40 bg-black/30"
      } backdrop-blur-sm`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

/* Har colour = usi number. Bright colours taaki clearly dikhen. */
const WHEEL_SEGMENTS: { color: string; number: number }[] = [
  { color: "#16a34a", number: 0 },  /* 1 – green */
  { color: "#0ea5e9", number: 1 },  /* 2 – blue */
  { color: "#9333ea", number: 2 },  /* 3 – purple */
  { color: "#2563eb", number: 3 },  /* 4 – dark blue */
  { color: "#dc2626", number: 4 },  /* 5 – red */
  { color: "#ea580c", number: 5 },  /* 6 – orange */
  { color: "#ca8a04", number: 6 },  /* 7 – yellow */
  { color: "#db2777", number: 7 },  /* 8 – pink */
  { color: "#0d9488", number: 8 },  /* 9 – teal */
  { color: "#d97706", number: 9 },  /* 10 – amber */
];

/** Single digit wheel: segments 0-9, golden rim, red pointer (fixed), center digit. rotation applied to wheel only. */
type SingleDigitWheelProps = {
  digit: string;
  rotation: number;
};

function SingleDigitWheel({ digit, rotation }: SingleDigitWheelProps) {
  return (
    <div className="relative flex w-[120px] min-w-[100px] flex-col items-center aspect-square sm:w-[150px] sm:min-w-[140px] md:w-[220px] md:min-w-[200px] lg:w-[320px] lg:min-w-[300px] xl:w-[400px] xl:min-w-[380px]">
      {/* Pointer at top – white arrow, upper edge curved to match wheel circle; subtle shadow */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <svg
          className="h-[14px] w-[20px] sm:h-[20px] sm:w-[28px] md:h-[22px] md:w-[32px] lg:h-[32px] lg:w-[48px] xl:h-[38px] xl:w-[56px]"
          viewBox="0 0 20 14"
          fill="none"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
        >
          {/* Top edge = arc matching circle; tip at bottom center */}
          <path
            d="M 0 0 Q 10 -4 20 0 L 10 14 Z"
            fill="white"
          />
        </svg>
      </div>
      <div className="relative flex w-full flex-1 items-center justify-center [aspect-ratio:1/1]">
        <div
          className="relative h-full w-full max-h-full max-w-full overflow-hidden rounded-full shadow-lg"
          style={{
            border: "3px solid #fbbf24",
            boxShadow:
              "0 0 0 1px rgba(251,191,36,0.5), 0 8px 24px rgba(0,0,0,0.4), 0 0 40px -5px rgba(251,191,36,0.25), 0 0 60px -10px rgba(59,130,246,0.15)",
          }}
        >
          {/* Rotating wheel (segments + labels) – pointer stays fixed */}
          <div
            className="absolute inset-[2px] rounded-full"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${WHEEL_SEGMENTS.map((seg, i) => `${seg.color} ${i * 36}deg ${(i + 1) * 36}deg`).join(", ")})`,
              }}
            />
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angleDeg = i * 36 + 18;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 flex h-full w-full items-center justify-center"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-41%)`,
                  }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-sm font-black tabular-nums sm:h-7 sm:w-7 sm:text-base md:h-8 md:w-8 md:text-lg lg:h-11 lg:w-11 lg:text-xl xl:h-12 xl:w-12 xl:text-2xl"
                    style={{
                      transform: `rotate(${-angleDeg}deg)`,
                      backgroundColor: seg.color,
                      color: "#ffffff",
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      boxShadow: "inset 0 2px 6px rgba(255,255,255,0.35), inset 0 -2px 6px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {seg.number}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Center digit – fixed, does NOT rotate; bigger on wide screens */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex h-[min(20vmin,48px)] w-[min(20vmin,48px)] items-center justify-center rounded-full bg-white lg:h-14 lg:w-14 xl:h-16 xl:w-16"
              style={{
                boxShadow: "0 2px 6px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.9)",
              }}
            >
              <span className="font-mono text-xl font-black tabular-nums text-black sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
                {digit}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two wheels with middle banner (game name + result) – static (no spin logic) */
type LuckyDrawSpinnerProps = {
  result: PublicCurrentResult | null | undefined;
  countdownDisplay: string | null;
  countdownSeconds: number | null;
};

function LuckyDrawSpinner({
  result,
  countdownDisplay,
  countdownSeconds,
}: LuckyDrawSpinnerProps) {
  const resultStyle = useResultNumberColor();
  const { rotation1, rotation2, spinToResult, reset } = useSpinEngine();
  const prevResultRef = useRef<string | null>(null);

  const resultNumber = result?.resultNumber ?? "";
  const digit1 = resultNumber.length >= 1 ? resultNumber[0] : "—";
  const digit2 = resultNumber.length >= 2 ? resultNumber[1] : "—";
  const gameName =
    typeof result?.gameName === "string"
      ? result.gameName
      : result?.gameId?.name ?? "Lucky Draw";

  const middleBoxResult = resultNumber || "—";

  useEffect(() => {
    if (!resultNumber) return;

    if (prevResultRef.current === resultNumber) {
      return; // prevent duplicate spin
    }

    prevResultRef.current = resultNumber;
    spinToResult(resultNumber);
  }, [resultNumber]);

  useEffect(() => {
    if (countdownSeconds !== null && countdownSeconds === 5) {
      reset();
    }
  }, [countdownSeconds, reset]);

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-3 sm:gap-8 md:gap-12 lg:gap-14 xl:gap-20">
      <SingleDigitWheel digit={digit1} rotation={rotation1} />
      {/* Middle: 3D + glow – responsive padding & font size */}
      <div className="flex flex-col items-center gap-1.5 sm:gap-2.5">
        <div
          className="rounded-lg bg-amber-400/95 px-2.5 py-1.5 live-card-3d sm:px-4 sm:py-2"
          style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.3), 0 0 20px -2px rgba(251,191,36,0.3)" }}
        >
          <span className="text-xs font-semibold text-black sm:text-sm md:text-base">{gameName}</span>
        </div>
        <div
          className="flex min-w-[64px] items-center justify-center rounded-xl bg-slate-900/95 px-3 py-2.5 live-card-3d sm:min-w-[88px] sm:px-6 sm:py-4 lg:min-w-[100px] lg:px-8 lg:py-5 xl:min-w-[120px] xl:px-10 xl:py-6"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1), 0 0 25px -2px rgba(59,130,246,0.2)" }}
        >
          <span
            className="font-mono text-2xl font-black tabular-nums leading-none transition-colors duration-300 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
            style={{ color: resultStyle.color, textShadow: resultStyle.shadow }}
          >
            {middleBoxResult || "—"}
          </span>
        </div>
        <div
          className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-lg bg-orange-500 px-1.5 py-1 live-card-3d sm:min-h-[36px] sm:min-w-[36px] sm:px-2 sm:py-1.5"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3), 0 0 15px -2px rgba(249,115,22,0.4)" }}
        >
          <span className="font-mono text-[10px] font-bold tabular-nums text-white sm:text-xs md:text-sm">
            {countdownDisplay ?? "—"}
          </span>
        </div>
      </div>
      <SingleDigitWheel digit={digit2} rotation={rotation2} />
    </div>
  );
}

/** Full-page party popper – heavy confetti + ribbons + stars for 5s when result changes */
function FullPagePartyPopper() {
  const pieces = useMemo(() => {
    const colors = ["#fef08a", "#facc15", "#f59e0b", "#f97316", "#ef4444", "#a78bfa", "#34d399", "#38bdf8"];
    const total = 260;
    return Array.from({ length: total }, (_, i) => {
      const r = Math.random();
      const type: "confetti" | "ribbon" | "star" =
        r < 0.15 ? "star" : r < 0.55 ? "ribbon" : "confetti";

      const baseSize = 4 + Math.random() * 6;

      return {
        id: i,
        type,
        color: colors[i % colors.length],
        left: Math.random() * 100,
        top: -8 + Math.random() * 6,
        delay: Math.random() * 0.6,
        size: baseSize,
        endX: (Math.random() - 0.5) * 90,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {pieces.map((p) => {
        let width = p.size;
        let height = p.size;
        let borderRadius = 2;

        if (p.type === "ribbon") {
          width = p.size * 0.4;
          height = p.size * 4.0;
          borderRadius = 9999;
        } else if (p.type === "star") {
          width = p.size * 3;
          height = p.size * 3;
        }

        const isStar = p.type === "star";

        return (
          <div
            key={p.id}
            className="absolute full-page-confetti-drop flex items-center justify-center"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width,
              height,
              color: isStar ? p.color : undefined,
              backgroundColor: isStar ? "transparent" : p.color,
              borderRadius,
              animationDelay: `${p.delay}s`,
              ["--end-x" as string]: `${p.endX}vw`,
              fontSize: isStar ? `${width}px` : undefined,
            }}
          >
            {isStar ? "★" : null}
          </div>
        );
      })}
    </div>
  );
}

function WinningNumberCard({
  result,
}: {
  result: PublicCurrentResult | null | undefined;
}) {
  const [justDeclared, setJustDeclared] = useState(false);
  const prevResultRef = useRef<string | null>(null);
  const resultStyle = useResultNumberColor();

  useEffect(() => {
    const current = result?.resultNumber ?? null;
    if (current != null && current !== prevResultRef.current) {
      prevResultRef.current = current;
      setJustDeclared(true);
      const t = setTimeout(() => setJustDeclared(false), 2200);
      return () => clearTimeout(t);
    }
    if (current != null) prevResultRef.current = current;
  }, [result?.resultNumber]);

  if (result == null) {
    return (
      <div className="rounded-2xl border-2 border-slate-600/50 bg-slate-800/60 py-6 text-center backdrop-blur-sm live-card-3d live-card-glow transition-shadow sm:py-10" style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 25px -5px rgba(59,130,246,0.1)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm">
          No result yet
        </p>
        <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">Winning number will appear here after draw</p>
      </div>
    );
  }

  const gameName =
    typeof result.gameName === "string"
      ? result.gameName
      : result.gameId?.name ?? "—";

  return (
    <div
      className={`rounded-2xl border-2 py-6 text-center backdrop-blur-sm live-card-3d live-card-glow transition-shadow sm:py-8 ${
        justDeclared
          ? "border-amber-400/60 bg-amber-950/30 animate-[justDeclared_2s_ease-out_forwards]"
          : "border-slate-600/50 bg-slate-800/60"
      }`}
      style={justDeclared ? undefined : { boxShadow: "0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 25px -5px rgba(59,130,246,0.12)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/90 sm:text-xs">
        {justDeclared ? "🎉 Winning number 🎉" : "Latest result"}
      </p>
      <p
        className={`mt-3 font-mono text-5xl font-black tabular-nums transition-colors duration-300 sm:mt-4 sm:text-6xl md:text-7xl ${
          justDeclared ? "animate-[flipIn_0.5s_ease-out_forwards]" : ""
        }`}
        style={{ color: resultStyle.color, textShadow: resultStyle.shadow }}
      >
        {result.resultNumber}
      </p>
      <p className="mt-2 text-[10px] text-slate-400 sm:text-sm">
        {gameName} · {formatResultDateTime(result.fullDateTime)}
      </p>
    </div>
  );
}
