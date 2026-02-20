"use client";

import { useCallback, useEffect, useState } from "react";
import { getBaseUrl } from "@/lib/api";

type CalendarEvent = { gameId: string; gameName: string; date: string; time: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthStartEnd(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
  };
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDaysInMonthView(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
  const rows: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startDay; i++) {
    const d = prevMonthDays - startDay + i + 1;
    const date = new Date(prevYear, prevMonth, d);
    rows.push({ date, dateStr: toDateStr(date), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    rows.push({ date, dateStr: toDateStr(date), isCurrentMonth: true });
  }
  const remaining = 42 - rows.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(nextYear, nextMonth, d);
    rows.push({ date, dateStr: toDateStr(date), isCurrentMonth: false });
  }
  return rows;
}

type CalendarProps = {
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string | null;
};

export function Calendar({ onSelectDate, selectedDate }: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const fetchEvents = useCallback(async () => {
    const base = getBaseUrl();
    if (!base) {
      setEvents([]);
      return;
    }
    const { startStr, endStr } = getMonthStartEnd(year, month);
    setLoading(true);
    try {
      const res = await fetch(
        `${base}/api/admin/calendar-events?start=${startStr}&end=${endStr}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const days = getDaysInMonthView(year, month);
  const eventCountByDate: Record<string, number> = {};
  for (const e of events) {
    eventCountByDate[e.date] = (eventCountByDate[e.date] || 0) + 1;
  }

  const goPrev = () => setViewDate(new Date(year, month - 1));
  const goNext = () => setViewDate(new Date(year, month + 1));
  const monthLabel = viewDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={goPrev}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-slate-800">{monthLabel}</h2>
        <button
          type="button"
          onClick={goNext}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-slate-100 py-2 text-center text-xs font-medium text-slate-600"
            >
              {day}
            </div>
          ))}
          {days.map(({ date, dateStr, isCurrentMonth }) => {
            const count = eventCountByDate[dateStr] || 0;
            const isSelected = selectedDate === dateStr;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate?.(dateStr)}
                className={`
                  min-h-[72px] p-1.5 text-left bg-white hover:bg-slate-50 transition-colors
                  ${!isCurrentMonth ? "text-slate-400" : "text-slate-900"}
                  ${isSelected ? "ring-2 ring-slate-600 ring-inset rounded" : ""}
                `}
              >
                <span className="text-sm font-medium">{date.getDate()}</span>
                {count > 0 && (
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {count} slot{count !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
