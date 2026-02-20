"use client";

// API calls use shared axios client via @/lib/api
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getUnpublishedScheduledResults,
  submitResult,
  deleteScheduledResult,
  cancelSlot,
  deleteScheduledResultsByGame,
  type UnpublishedItem,
} from "@/lib/api";
import { formatTimeToAMPM } from "@/lib/formatTime";

const UNPUBLISHED_QUERY_KEY = "unpublished";
const DEFAULT_PAGE_SIZE = 20;

function getTodayIST(): string {
  if (typeof window === "undefined") return "";
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getEndDateIST(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

type Tab = "single" | "bulk";

export default function GameManagerPage() {
  const [tab, setTab] = useState<Tab>("single");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [UNPUBLISHED_QUERY_KEY, dateRangeStart, dateRangeEnd, page, limit],
    queryFn: () =>
      getUnpublishedScheduledResults({
        start: dateRangeStart,
        end: dateRangeEnd,
        futureOnly: true,
        page,
        limit,
      }),
    enabled: !!dateRangeStart && !!dateRangeEnd && dateRangeStart <= dateRangeEnd,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;
  useEffect(() => {
    if (queryError) {
      const msg = queryError instanceof Error ? queryError.message : "Failed to load";
      toast.error(msg);
    }
  }, [queryError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dateRangeStart) setDateRangeStart(getTodayIST());
    if (!dateRangeEnd) setDateRangeEnd(getEndDateIST(3));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [dateRangeStart, dateRangeEnd, limit]);

  useEffect(() => {
    if (data?.page != null && data.page !== page) setPage(data.page);
  }, [data?.page, page]);

  const invalidateUnpublished = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [UNPUBLISHED_QUERY_KEY] });
  }, [queryClient]);

  const [editModal, setEditModal] = useState<{
    open: boolean;
    item: UnpublishedItem | null;
    resultNumber: string;
  }>({ open: false, item: null, resultNumber: "" });
  const [selectedBulkGame, setSelectedBulkGame] = useState<{ gameId: string; gameName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    gameId: string;
    gameName: string;
    randomCode: string;
    userInput: string;
  }>({ open: false, gameId: "", gameName: "", randomCode: "", userInput: "" });
  const [deleteConfirmSingle, setDeleteConfirmSingle] = useState<{
    open: boolean;
    item: UnpublishedItem | null;
    randomCode: string;
    userInput: string;
  }>({ open: false, item: null, randomCode: "", userInput: "" });
  const [submitLoading, setSubmitLoading] = useState(false);

  const uniqueGames =
    data?.games ??
    items.reduce<{ gameId: string; gameName: string }[]>(
      (acc, i) => {
        if (!acc.some((g) => g.gameId === i.gameId)) acc.push({ gameId: i.gameId, gameName: i.gameName });
        return acc;
      },
      []
    );

  const handleSingleEdit = useCallback((item: UnpublishedItem) => {
    setEditModal({ open: true, item, resultNumber: item.resultNumber ?? "" });
  }, []);

  const handleSingleEditSubmit = useCallback(async () => {
    const { item, resultNumber } = editModal;
    if (!item || !resultNumber.trim() || resultNumber.length !== 2) {
      toast.error("Enter a 2-digit result number");
      return;
    }
    setSubmitLoading(true);
    try {
      await submitResult({
        gameId: item.gameId,
        date: item.date,
        time: item.time,
        resultNumber: resultNumber.trim(),
      });
      toast.success(`Result updated for ${item.gameName} — ${item.date} ${formatTimeToAMPM(item.time)}`);
      setEditModal((m) => ({ ...m, open: false, item: null, resultNumber: "" }));
      invalidateUnpublished();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitLoading(false);
    }
  }, [editModal, invalidateUnpublished]);

  const openSingleDeleteConfirm = useCallback(
    (item: UnpublishedItem) => {
      setDeleteConfirmSingle({
        open: true,
        item,
        randomCode: String(100000 + Math.floor(Math.random() * 900000)),
        userInput: "",
      });
    },
    []
  );

  const handleSingleDeleteConfirm = useCallback(async () => {
    const { item, randomCode, userInput } = deleteConfirmSingle;
    if (!item) return;
    if (userInput.trim() !== randomCode) {
      toast.error("Wrong code. Enter the 6-digit code shown above.");
      return;
    }
    setDeleteConfirmSingle((c) => ({ ...c, open: false, item: null, userInput: "" }));
    try {
      if (item._id) {
        await deleteScheduledResult(item._id);
        toast.success("Slot deleted successfully");
      } else {
        await cancelSlot({ gameId: item.gameId, date: item.date, time: item.time });
        toast.success("Slot cancelled");
      }
      invalidateUnpublished();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }, [deleteConfirmSingle, invalidateUnpublished]);

  const handleSingleDelete = useCallback(
    async (item: UnpublishedItem) => {
      try {
        if (item._id) {
          await deleteScheduledResult(item._id);
          toast.success("Slot deleted successfully");
        } else {
          await cancelSlot({ gameId: item.gameId, date: item.date, time: item.time });
          toast.success("Slot cancelled");
        }
        invalidateUnpublished();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete");
      }
    },
    [invalidateUnpublished]
  );

  const openBulkDeleteConfirm = useCallback((gameId: string, gameName: string) => {
    setDeleteConfirm({
      open: true,
      gameId,
      gameName,
      randomCode: String(100000 + Math.floor(Math.random() * 900000)),
      userInput: "",
    });
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    const { gameId, gameName, randomCode, userInput } = deleteConfirm;
    if (userInput.trim() !== randomCode) {
      toast.error("Wrong code. Enter the 6-digit code shown above.");
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await deleteScheduledResultsByGame(gameId);
      const cancelled = res.cancelledPendingCount ?? 0;
      const total = res.deletedCount + cancelled;
      if (total === 0) {
        if (res.skippedCount > 0) {
          toast.warning(
            `No future unpublished slots to delete for "${gameName}". All ${res.skippedCount} slot(s) were either already published or in the past.`
          );
        } else {
          toast.warning(`No slots found for "${gameName}" to delete.`);
        }
      } else {
        const parts = [];
        if (res.deletedCount > 0) parts.push(`${res.deletedCount} scheduled deleted`);
        if (cancelled > 0) parts.push(`${cancelled} pending cancelled`);
        const skipMsg = res.skippedCount > 0 ? ` (${res.skippedCount} skipped)` : "";
        toast.success(`${parts.join(", ")} for "${gameName}"${skipMsg}`);
      }
      setDeleteConfirm((c) => ({ ...c, open: false, gameId: "", gameName: "", randomCode: "", userInput: "" }));
      invalidateUnpublished();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSubmitLoading(false);
    }
  }, [deleteConfirm, invalidateUnpublished]);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Game Manager</h1>

        {tab === "single" && (
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="date-from" className="text-sm font-medium text-slate-700">
                From date
              </label>
              <input
                id="date-from"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="date-to" className="text-sm font-medium text-slate-700">
                To date
              </label>
              <input
                id="date-to"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (dateRangeStart > dateRangeEnd) {
                  toast.error("From date must be before or equal to To date");
                  return;
                }
                refetch();
              }}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Load
            </button>
          </div>
        )}

        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab("single")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "single"
                ? "border-slate-600 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setTab("bulk")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "bulk"
                ? "border-slate-600 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Bulk
          </button>
        </div>

        {tab === "single" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex justify-center py-16 text-slate-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-slate-500">No future slots.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Game Name
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Date
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Time
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Result
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={`${item.gameId}-${item.date}-${item.time}`} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{item.gameName}</td>
                      <td className="px-5 py-3.5 text-slate-700">{item.date}</td>
                      <td className="px-5 py-3.5 text-slate-700">{formatTimeToAMPM(item.time)}</td>
                      <td className="px-5 py-3.5 tabular-nums text-slate-700">{item.resultNumber ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        {item._id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSingleEdit(item)}
                              className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openSingleDeleteConfirm(item)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSingleDeleteConfirm(item)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
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
        )}

        {tab === "bulk" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : uniqueGames.length === 0 ? (
              <p className="text-slate-500">No future slots. Select a game after slots are available.</p>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Select game (same name ke saare future slots par action)
                </label>
                <select
                  className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  value={selectedBulkGame ? `${selectedBulkGame.gameId}|||${selectedBulkGame.gameName}` : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setSelectedBulkGame(null);
                      return;
                    }
                    const [gameId, gameName] = v.split("|||");
                    setSelectedBulkGame({ gameId, gameName });
                  }}
                >
                  <option value="">Select game...</option>
                  {uniqueGames.map((g) => (
                    <option key={g.gameId} value={`${g.gameId}|||${g.gameName}`}>
                      {g.gameName}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedBulkGame) {
                        toast.error("Select a game first");
                        return;
                      }
                      openBulkDeleteConfirm(selectedBulkGame.gameId, selectedBulkGame.gameName);
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete all future slots
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single-row edit modal */}
      {editModal.open && editModal.item && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setEditModal((m) => ({ ...m, open: false, item: null, resultNumber: "" }))}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Edit Result</h2>
            <p className="mb-4 text-sm text-slate-500">
              {editModal.item.gameName} — {editModal.item.date} {formatTimeToAMPM(editModal.item.time)}
            </p>
            <input
              type="text"
              maxLength={2}
              value={editModal.resultNumber}
              onChange={(e) => setEditModal((m) => ({ ...m, resultNumber: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
              placeholder="2-digit result"
              className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModal((m) => ({ ...m, open: false, item: null, resultNumber: "" }))}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSingleEditSubmit}
                disabled={submitLoading || editModal.resultNumber.length !== 2}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single-row delete confirm (6-digit code) */}
      {deleteConfirmSingle.open && deleteConfirmSingle.item && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirmSingle((c) => ({ ...c, open: false, item: null, userInput: "" }))}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Confirm delete</h2>
            <p className="mb-2 text-sm text-slate-600">
              {deleteConfirmSingle.item.gameName} — {deleteConfirmSingle.item.date}{" "}
              {formatTimeToAMPM(deleteConfirmSingle.item.time)}
            </p>
            <p className="mb-3 text-sm font-medium text-slate-700">
              Enter this code to confirm: <span className="font-mono text-lg tracking-widest">{deleteConfirmSingle.randomCode}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={deleteConfirmSingle.userInput}
              onChange={(e) =>
                setDeleteConfirmSingle((c) => ({ ...c, userInput: e.target.value.replace(/\D/g, "").slice(0, 6) }))
              }
              placeholder="6-digit code"
              className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSingle((c) => ({ ...c, open: false, item: null, userInput: "" }))}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSingleDeleteConfirm}
                disabled={deleteConfirmSingle.userInput.length !== 6}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirm (6-digit code) */}
      {deleteConfirm.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() =>
            setDeleteConfirm((c) => ({ ...c, open: false, gameId: "", gameName: "", randomCode: "", userInput: "" }))
          }
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Delete all future slots?</h2>
            <p className="mb-3 text-sm text-slate-600">
              This will delete all future (unpublished) slots for <strong>{deleteConfirm.gameName}</strong>. This cannot be undone.
            </p>
            <p className="mb-3 text-sm font-medium text-slate-700">
              Enter this code to confirm: <span className="font-mono text-lg tracking-widest">{deleteConfirm.randomCode}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={deleteConfirm.userInput}
              onChange={(e) =>
                setDeleteConfirm((c) => ({ ...c, userInput: e.target.value.replace(/\D/g, "").slice(0, 6) }))
              }
              placeholder="6-digit code"
              className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm((c) => ({ ...c, open: false, gameId: "", gameName: "", randomCode: "", userInput: "" }))
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={submitLoading || deleteConfirm.userInput.length !== 6}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? "Deleting..." : "Delete all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
