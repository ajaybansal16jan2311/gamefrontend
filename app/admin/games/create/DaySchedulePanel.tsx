"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTimeToAMPM } from "@/lib/formatTime";
import { apiClient } from "@/lib/apiClient";

type CalendarEvent = { gameId: string; gameName: string; date: string; time: string };

type DaySchedulePanelProps = {
  dateStr: string;
  onClose: () => void;
};

export function DaySchedulePanel({ dateStr, onClose }: DaySchedulePanelProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ events?: CalendarEvent[] }>(
        `/api/admin/calendar-events?start=${dateStr}&end=${dateStr}`
      );
      const list = Array.isArray(data.events) ? data.events : [];
      list.sort((a: CalendarEvent, b: CalendarEvent) => a.time.localeCompare(b.time));
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay]);

  const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 shrink-0">
        <h3 className="font-semibold text-slate-800 truncate pr-2">{label}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">No slots scheduled for this day.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e, i) => (
              <li
                key={`${e.date}-${e.time}-${e.gameId}-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <span className="font-medium text-slate-800">{e.gameName}</span>
                <span className="text-sm text-slate-600">{formatTimeToAMPM(e.time)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
