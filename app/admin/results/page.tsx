"use client";

// API calls use shared axios client via @/lib/api
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDailyPlanner,
  submitResult,
  type DailyPlannerItem,
  type SubmitResultPayload,
} from "@/lib/api";
import { toast } from "sonner";
import { formatTimeToAMPM } from "@/lib/formatTime";

const DAILY_PLANNER_QUERY_KEY = "dailyPlanner";
const DEFAULT_PAGE_SIZE = 20;

function getTodayIST(): string {
  if (typeof window === "undefined") return "";
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getCurrentTimeIST(): string {
  if (typeof window === "undefined") return "00:00";
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getStatusLabel(resultStatus: string): string {
  if (resultStatus === "pending") return "Random";
  return resultStatus;
}

function getStatusBadgeClass(resultStatus: string): string {
  switch (resultStatus) {
    case "Publish":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Random Publish":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "Scheduled":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "pending":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function useCountdown(publishAt: string | undefined, onComplete?: () => void) {
  const [remaining, setRemaining] = useState<string>("");
  const onCompleteFired = useRef(false);
  useEffect(() => {
    if (!publishAt) {
      setRemaining("");
      onCompleteFired.current = false;
      return;
    }
    onCompleteFired.current = false;
    let backupId: ReturnType<typeof setTimeout> | null = null;
    const target = new Date(publishAt).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      if (diff <= 0) {
        setRemaining("Completed");
        if (onComplete && !onCompleteFired.current) {
          onCompleteFired.current = true;
          onComplete();
          // Backup refetch after 1s in case first call was missed (e.g. tab throttling)
          backupId = setTimeout(() => {
            onComplete();
          }, 1000);
        }
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setRemaining(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      if (backupId !== null) clearTimeout(backupId);
    };
  }, [publishAt, onComplete]);
  return remaining;
}

type ModalState = {
  open: boolean;
  item: DailyPlannerItem | null;
  initialValue: string;
  isEdit: boolean;
};

export default function ResultManagerPage() {
  const todayIST = getTodayIST();
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    item: null,
    initialValue: "",
    isEdit: false,
  });
  const [resultInput, setResultInput] = useState("");

  useEffect(() => {
    if (!date && todayIST) setDate(todayIST);
  }, [date, todayIST]);

  useEffect(() => {
    setPage(1);
  }, [date, limit]);

  const queryClient = useQueryClient();
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: [DAILY_PLANNER_QUERY_KEY, date, page, limit],
    queryFn: () => getDailyPlanner(date, { page, limit }),
    enabled: !!date,
    refetchOnMount: "always",
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;

  useEffect(() => {
    if (data?.page != null && data.page !== page) setPage(data.page);
  }, [data?.page, page]);
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load results") : null;
  const isToday = date === todayIST;

  const currentRowRef = useRef<HTMLTableRowElement>(null);
  const currentTimeIST = getCurrentTimeIST();
  const currentRowIndex = useMemo(() => {
    if (!isToday || items.length === 0) return -1;
    const i = items.findIndex((item) => item.resultTime >= currentTimeIST);
    return i === -1 ? items.length - 1 : i;
  }, [items, isToday, currentTimeIST]);

  useEffect(() => {
    if (isToday && items.length > 0 && currentRowIndex >= 0) {
      const t = setTimeout(() => {
        currentRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isToday, items.length, currentRowIndex]);

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitResultPayload) => submitResult(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DAILY_PLANNER_QUERY_KEY, date] });
    },
  });

  const onCountdownComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [DAILY_PLANNER_QUERY_KEY, date] });
  }, [queryClient, date]);

  const openAdd = useCallback((item: DailyPlannerItem) => {
    setModal({
      open: true,
      item,
      initialValue: "",
      isEdit: false,
    });
    setResultInput("");
  }, []);

  const openEdit = useCallback((item: DailyPlannerItem) => {
    setModal({
      open: true,
      item,
      initialValue: item.resultNumber ?? "",
      isEdit: true,
    });
    setResultInput(item.resultNumber ?? "");
  }, []);

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, open: false, item: null }));
    setResultInput("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!modal.item || !date) return;
    const trimmed = resultInput.trim();
    if (!/^\d{2}$/.test(trimmed)) {
      toast.error("Enter only number between 00 to 99");
      return;
    }
    const payload: SubmitResultPayload = {
      gameId: modal.item.gameId,
      date,
      resultNumber: trimmed,
    };
    if (modal.item.resultTime) payload.time = modal.item.resultTime;
    try {
      await submitMutation.mutateAsync(payload);
      closeModal();
    } catch (e) {
      // Error is handled via submitMutation.isError / submitMutation.error in UI if needed
    }
  }, [modal.item, date, resultInput, closeModal, submitMutation]);

  const submitLoading = submitMutation.isPending;
  const submitError = submitMutation.isError
    ? (submitMutation.error instanceof Error ? submitMutation.error.message : "Failed to save result")
    : null;

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Result Manager</h1>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>

        {(error || submitError) && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {submitError ?? error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No results for this date.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Game Name
                  </th>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Game Result
                  </th>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Time
                  </th>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Result Status
                  </th>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Countdown
                  </th>
                  <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <ResultRow
                    key={`${item.gameId}-${item.resultTime}-${idx}`}
                    ref={idx === currentRowIndex ? currentRowRef : undefined}
                    item={item}
                    isToday={isToday}
                    date={date}
                    todayIST={todayIST}
                    onAddResult={openAdd}
                    onEditResult={openEdit}
                    onCountdownComplete={onCountdownComplete}
                  />
                ))}
                </tbody>
            </table>
          )}
          {!loading && items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, total)} of {total}
                </span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal.open && modal.item && (
        <ResultModal
          item={modal.item}
          isEdit={modal.isEdit}
          resultInput={resultInput}
          setResultInput={setResultInput}
          onSubmit={handleSubmit}
          onClose={closeModal}
          loading={submitLoading}
        />
      )}
    </div>
  );
}

const ResultRow = forwardRef<
  HTMLTableRowElement,
  {
    item: DailyPlannerItem;
    isToday: boolean;
    date: string;
    todayIST: string;
    onAddResult: (item: DailyPlannerItem) => void;
    onEditResult: (item: DailyPlannerItem) => void;
    onCountdownComplete?: () => void;
  }
>(function ResultRow(
  { item, isToday, date, todayIST, onAddResult, onEditResult, onCountdownComplete },
  ref
) {
  const hasPublishAt = Boolean(item.publishAt);
  const publishAtTime = item.publishAt ? new Date(item.publishAt).getTime() : 0;
  const isSlotTimePast = hasPublishAt && publishAtTime <= Date.now();
  const isPastDate = date < todayIST;

  const isPublished = item.resultStatus === "Publish" || item.resultStatus === "Random Publish";
  const showAsCompleted =
    isPublished || (hasPublishAt && (isPastDate || isSlotTimePast));
  const showCountdown =
    isToday &&
    (item.resultStatus === "pending" || item.resultStatus === "Scheduled") &&
    item.publishAt &&
    !isSlotTimePast;
  const countdown = useCountdown(
    showCountdown ? item.publishAt : undefined,
    onCountdownComplete
  );

  const action =
    item.resultStatus === "pending"
      ? "add"
      : item.resultStatus === "Scheduled"
        ? "edit"
        : "none";

  return (
    <tr
      ref={ref}
      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
    >
      <td className="py-3.5 px-5 font-medium text-slate-900">{item.name}</td>
      <td className="py-3.5 px-5 text-slate-700 tabular-nums">
        {item.resultNumber ?? "—"}
      </td>
      <td className="py-3.5 px-5 text-slate-700">
        {formatTimeToAMPM(item.resultTime)}
      </td>
      <td className="py-3.5 px-5">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.resultStatus)}`}
        >
          {getStatusLabel(item.resultStatus)}
        </span>
      </td>
      <td className="py-3.5 px-5 font-mono text-sm text-slate-600">
        {showAsCompleted ? "Completed" : showCountdown ? countdown || "—" : "—"}
      </td>
      <td className="py-3.5 px-5">
        {action === "add" && (
          <button
            type="button"
            onClick={() => onAddResult(item)}
            className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
          >
            Add Result
          </button>
        )}
        {action === "edit" && (
          <button
            type="button"
            onClick={() => onEditResult(item)}
            className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
          >
            Edit Result
          </button>
        )}
        {action === "none" && <span className="text-slate-400 text-sm">—</span>}
      </td>
    </tr>
  );
});

function ResultModal({
  item,
  isEdit,
  resultInput,
  setResultInput,
  onSubmit,
  onClose,
  loading,
}: {
  item: DailyPlannerItem;
  isEdit: boolean;
  resultInput: string;
  setResultInput: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          {isEdit ? "Edit Result" : "Add Result"}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {item.name} — {formatTimeToAMPM(item.resultTime)}
        </p>
        <input
          type="text"
          value={resultInput}
          onChange={(e) => setResultInput(e.target.value)}
          placeholder="Result number"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !resultInput.trim()}
            className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
