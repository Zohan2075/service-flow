"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useSync } from "@/lib/sync";
import type {
  CommentsConfig,
  CommentBox,
  CommentCategory,
} from "@/types/comments";
import { createCommentBox, createCommentCategory } from "@/types/comments";

/* ---------- helpers ---------- */

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function fmtDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CATEGORY_COLORS = [
  "#2B579A", "#B060A0", "#3B8F6B", "#C8503A", "#D98E1F", "#4A8FBF",
  "#8C5A2B", "#5A7D3B", "#7D4A9A", "#C0392B", "#16A085", "#8E44AD",
];

const CATEGORY_ICONS = ["category", "forum", "record_voice_over", "groups", "campaign", "mic", "chat", "volunteer_activism"];

/* ---------- labels ---------- */

const L = {
  en: {
    title: "Comments",
    subtitle: "Square timer book for tracking meeting comments.",
    addCategory: "Add Category",
    addBox: "Add",
    categoryName: "Category name",
    boxName: "Comment",
    categoryHint: "New category",
    boxHint: "Comment",
    removeCategory: "Delete category",
    removeCategoryConfirm: "Delete this category and all its comments?",
    removeBox: "Delete",
    removeBoxConfirm: "Delete this comment?",
    start: "Start",
    stop: "Stop",
    reset: "Reset",
    edit: "Edit",
    done: "Done",
    active: "Running",
    idle: "No timer running",
    noCategories: "No categories yet. Add one to start timing comments.",
    minutes: "min",
    seconds: "s",
    quickAdd: "Add comment",
    editTime: "Edit time",
    saving: "Saving",
    saved: "Saved",
    offline: "Offline — saved locally",
    saveError: "Save error",
    retry: "Retry",
  },
  es: {
    title: "Comentarios",
    subtitle: "Libro de temporizadores para medir comentarios de la reunión.",
    addCategory: "Agregar Categoría",
    addBox: "Agregar",
    categoryName: "Nombre de la categoría",
    boxName: "Comentario",
    categoryHint: "Nueva categoría",
    boxHint: "Comentario",
    removeCategory: "Eliminar categoría",
    removeCategoryConfirm: "¿Eliminar esta categoría y todos sus comentarios?",
    removeBox: "Eliminar",
    removeBoxConfirm: "¿Eliminar este comentario?",
    start: "Iniciar",
    stop: "Detener",
    reset: "Reiniciar",
    edit: "Editar",
    done: "Listo",
    active: "En curso",
    idle: "Ningún temporizador en curso",
    noCategories: "Aún no hay categorías. Agrega una para empezar a medir comentarios.",
    minutes: "min",
    seconds: "s",
    quickAdd: "Agregar comentario",
    editTime: "Editar tiempo",
    saving: "Guardando",
    saved: "Guardado",
    offline: "Sin conexión — guardado localmente",
    saveError: "Error al guardar",
    retry: "Reintentar",
  },
} as const;

type Lang = "en" | "es";
function pick<T>(lang: Lang, en: T, es: T): T {
  return lang === "es" ? es : en;
}

/* ---------- types ---------- */

interface Props {
  lang: Lang;
  weekId: string;
  config: CommentsConfig;
  onConfigChange: (cfg: CommentsConfig) => void;
}

/* ---------- main component ---------- */

export default function CommentsView({
  lang,
  weekId,
  config,
  onConfigChange,
}: Props) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingTimeBoxId, setEditingTimeBoxId] = useState<string | null>(null);
  const [timeMinutes, setTimeMinutes] = useState("0");
  const [timeSeconds, setTimeSeconds] = useState("0");
  const [now, setNow] = useState(() => Date.now());
  const editingRef = useRef<HTMLInputElement | null>(null);
  const updateCommentBox = useStore((s) => s.updateCommentBox);

  const t = (key: keyof typeof L.en) => pick(lang, L.en[key], L.es[key]);

  const boxes = useMemo(() => config.boxesByWeek[weekId] ?? [], [config.boxesByWeek, weekId]);

  // Tick once per second while any box is running so live durations update.
  const anyRunning = useMemo(
    () => boxes.some((box) => Boolean(box.runningSinceISO)),
    [boxes],
  );
  useEffect(() => {
    if (!anyRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [anyRunning]);

  useEffect(() => {
    if (editingRef.current) {
      editingRef.current.focus();
      editingRef.current.select();
    }
  }, [editingCategoryId, editingBoxId]);

  const sortedCategories = useMemo(
    () => [...config.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [config.categories],
  );

  const boxesByCategory = useMemo(() => {
    const map = new Map<string, CommentBox[]>();
    sortedCategories.forEach((cat) => map.set(cat.id, []));
    boxes.forEach((box) => {
      const list = map.get(box.categoryId);
      if (list) list.push(box);
    });
    return map;
  }, [boxes, sortedCategories]);

  const liveSecFor = useCallback(
    (box: CommentBox): number => {
      const base = box.accumulatedSec;
      if (!box.runningSinceISO) return base;
      return base + Math.max(0, Math.floor((now - Date.parse(box.runningSinceISO)) / 1000));
    },
    [now],
  );

  const categoryTotalSec = useCallback(
    (categoryId: string): number =>
      (boxesByCategory.get(categoryId) ?? []).reduce((sum, box) => sum + liveSecFor(box), 0),
    [boxesByCategory, liveSecFor],
  );

  const runningBox = useMemo(
    () => boxes.find((box) => Boolean(box.runningSinceISO)) ?? null,
    [boxes],
  );

  const setWeekBoxes = useCallback(
    (nextBoxes: CommentBox[]) => {
      onConfigChange({
        ...config,
        boxesByWeek: { ...config.boxesByWeek, [weekId]: nextBoxes },
      });
    },
    [config, onConfigChange, weekId],
  );

  const runDurationSec = useCallback((target: CommentBox, timestamp: number): number => {
    const startMs = Date.parse(target.runningSinceISO ?? "");
    return Number.isFinite(startMs) ? Math.max(0, Math.round((timestamp - startMs) / 1000)) : 0;
  }, []);

  // Finalize a running box: accumulate its duration (no log entry — per-week
  // accumulated times replace the session log).
  const stopBoxAt = useCallback(
    (target: CommentBox, timestamp: number): CommentBox => ({
      ...target,
      accumulatedSec: target.accumulatedSec + runDurationSec(target, timestamp),
      runningSinceISO: undefined,
    }),
    [runDurationSec],
  );

  // AUTO-ADD: when a stopped box accumulated time (>0s), append a fresh empty
  // box right after it in the same category, ready for the next comment.
  const insertAutoAddBox = useCallback(
    (list: CommentBox[], stoppedId: string, stoppedDuration: number): CommentBox[] => {
      if (stoppedDuration <= 0) return list;
      const index = list.findIndex((b) => b.id === stoppedId);
      if (index === -1) return list;
      const next = [...list];
      next.splice(index + 1, 0, createCommentBox(next[index].categoryId, t("boxHint")));
      return next;
    },
    [t],
  );

  // Toggle a box's timer: stop the currently-running box (auto-adding a fresh
  // box after it when it accumulated time), then start or stop the tapped box.
  const handleToggle = useCallback(
    (box: CommentBox) => {
      const timestamp = Date.now();
      let nextBoxes = [...boxes];
      const running = boxes.find((b) => Boolean(b.runningSinceISO));

      if (running && running.id !== box.id) {
        nextBoxes = nextBoxes.map((b) => (b.id === running.id ? stopBoxAt(running, timestamp) : b));
        nextBoxes = insertAutoAddBox(nextBoxes, running.id, runDurationSec(running, timestamp));
      }

      if (box.runningSinceISO) {
        nextBoxes = nextBoxes.map((b) => (b.id === box.id ? stopBoxAt(box, timestamp) : b));
        nextBoxes = insertAutoAddBox(nextBoxes, box.id, runDurationSec(box, timestamp));
      } else {
        nextBoxes = nextBoxes.map((b) =>
          b.id === box.id
            ? { ...b, runningSinceISO: new Date(timestamp).toISOString() }
            : b,
        );
      }

      setWeekBoxes(nextBoxes);
    },
    [boxes, setWeekBoxes, stopBoxAt, insertAutoAddBox, runDurationSec],
  );

  const handleReset = useCallback(
    (box: CommentBox) => {
      updateCommentBox(weekId, box.id, { accumulatedSec: 0, runningSinceISO: undefined });
    },
    [updateCommentBox, weekId],
  );

  const startEditCategory = (cat: CommentCategory) => {
    setEditingCategoryId(cat.id);
    setDraft(cat.name);
  };
  const startEditBox = (box: CommentBox) => {
    setEditingBoxId(box.id);
    setDraft(box.name);
  };
  const commitEdit = () => {
    const name = draft.trim();
    if (editingCategoryId) {
      const cat = config.categories.find((c) => c.id === editingCategoryId);
      if (cat && name) onConfigChange({ ...config, categories: config.categories.map((c) => (c.id === editingCategoryId ? { ...c, name } : c)) });
    } else if (editingBoxId) {
      const box = boxes.find((b) => b.id === editingBoxId);
      if (box && name) updateCommentBox(weekId, editingBoxId, { name });
    }
    setEditingCategoryId(null);
    setEditingBoxId(null);
    setDraft("");
  };
  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingBoxId(null);
    setDraft("");
  };

  const addCategory = () => {
    const sortOrder = Math.max(0, ...config.categories.map((c) => c.sortOrder)) + 1;
    const cat = createCommentCategory(
      t("categoryHint"),
      CATEGORY_COLORS[config.categories.length % CATEGORY_COLORS.length],
      CATEGORY_ICONS[config.categories.length % CATEGORY_ICONS.length],
      sortOrder,
    );
    onConfigChange({ ...config, categories: [...config.categories, cat] });
    setEditingCategoryId(cat.id);
    setDraft("");
  };

  const removeCategory = (cat: CommentCategory) => {
    if (!window.confirm(t("removeCategoryConfirm"))) return;
    const timestamp = Date.now();
    // Finalize any running timer inside the category before dropping the boxes,
    // mirroring the stop logic in handleToggle (prevents lost run time).
    const boxesByWeek: Record<string, CommentBox[]> = {};
    for (const [wk, list] of Object.entries(config.boxesByWeek)) {
      const finalized = list.map((b) =>
        b.categoryId === cat.id && b.runningSinceISO ? stopBoxAt(b, timestamp) : b
      );
      boxesByWeek[wk] = finalized.filter((b) => b.categoryId !== cat.id);
    }
    onConfigChange({
      ...config,
      categories: config.categories.filter((c) => c.id !== cat.id),
      boxesByWeek,
    });
  };

  const addBox = (categoryId: string) => {
    const box = createCommentBox(categoryId, t("boxHint"));
    setWeekBoxes([...boxes, box]);
    setEditingBoxId(box.id);
    setDraft("");
  };

  const removeBox = (box: CommentBox) => {
    if (!window.confirm(t("removeBoxConfirm"))) return;
    const timestamp = Date.now();
    // Finalize the run before removing the box (prevents lost run time).
    if (box.runningSinceISO) stopBoxAt(box, timestamp);
    setWeekBoxes(boxes.filter((b) => b.id !== box.id));
  };

  // Quick "+" in the active strip: add a box to the running box's category,
  // or to the first category when nothing is running.
  const quickAdd = () => {
    const categoryId = runningBox?.categoryId ?? sortedCategories[0]?.id;
    if (!categoryId) return;
    addBox(categoryId);
  };

  // ── mm:ss time editor (only when the box is NOT running) ────────────────
  const startEditTime = (box: CommentBox) => {
    if (box.runningSinceISO) return;
    setEditingTimeBoxId(box.id);
    setTimeMinutes(String(Math.floor(box.accumulatedSec / 60)));
    setTimeSeconds(String(box.accumulatedSec % 60));
  };
  const commitTimeEdit = () => {
    if (!editingTimeBoxId) return;
    const minutes = Math.min(9999, Math.max(0, Math.floor(Number(timeMinutes) || 0)));
    const seconds = Math.min(59, Math.max(0, Math.floor(Number(timeSeconds) || 0)));
    updateCommentBox(weekId, editingTimeBoxId, { accumulatedSec: minutes * 60 + seconds });
    setEditingTimeBoxId(null);
  };
  const cancelTimeEdit = () => {
    setEditingTimeBoxId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 p-4 md:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-slate-400 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SaveStatus t={t} />
        </div>
      </div>

      {/* Active timer strip */}
      {(runningBox || sortedCategories.length > 0) && (
        <div className="shrink-0 sticky top-0 z-10 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-surface via-surface to-surface/95 backdrop-blur shadow-lg shadow-slate-200/50 dark:shadow-black/25">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex size-3 shrink-0" aria-hidden="true">
              {runningBox ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-primary" />
                </>
              ) : (
                <span className="inline-flex size-3 rounded-full bg-slate-300 dark:bg-slate-600" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-wider font-bold text-primary">
                {runningBox ? t("active") : t("title")}
              </p>
              <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-100">
                {runningBox ? (runningBox.name || t("boxName")) : t("idle")}
              </p>
            </div>
            {runningBox && (
              <span className="shrink-0 font-mono text-2xl font-black leading-none tabular-nums text-slate-800 dark:text-slate-100">
                {fmtDuration(liveSecFor(runningBox))}
              </span>
            )}
            <button
              onClick={quickAdd}
              disabled={sortedCategories.length === 0}
              className="shrink-0 flex items-center justify-center size-11 rounded-xl bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              title={t("quickAdd")}
              aria-label={t("quickAdd")}
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-6">
        {sortedCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">forum</span>
            <p className="text-sm text-slate-400 max-w-xs">{t("noCategories")}</p>
          </div>
        )}

        {sortedCategories.map((cat) => {
          const catBoxes = boxesByCategory.get(cat.id) ?? [];
          const catTotal = categoryTotalSec(cat.id);
          return (
            <section key={cat.id} className="space-y-3">
              {/* Category header */}
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {editingCategoryId === cat.id ? (
                  <input
                    ref={editingRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    placeholder={t("categoryName")}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <button
                    onClick={() => startEditCategory(cat)}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    title={t("edit")}
                  >
                    <span>{cat.name || t("categoryName")}</span>
                    <span className={cn("material-symbols-outlined text-base", anyRunning ? "text-primary" : "text-slate-400")}>
                      edit
                    </span>
                  </button>
                )}
                <span className="text-xs font-bold text-slate-400 tabular-nums ml-auto">
                  {catBoxes.length} · {fmtDuration(catTotal)}
                </span>
                <button
                  onClick={() => addBox(cat.id)}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  {t("addBox")}
                </button>
                <button
                  onClick={() => removeCategory(cat)}
                  className="text-slate-300 hover:text-red-500 dark:text-slate-600 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  title={t("removeCategory")}
                  aria-label={t("removeCategory")}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>

              {/* Box grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {catBoxes.map((box) => {
                  const isRunning = Boolean(box.runningSinceISO);
                  const liveSec = liveSecFor(box);
                  return (
                    <div
                      key={box.id}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 aspect-square transition-all",
                        isRunning
                          ? "bg-primary text-white border-transparent shadow-lg"
                          : "bg-surface border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40"
                      )}
                      style={isRunning ? undefined : { borderTopColor: cat.color, borderTopWidth: 3 }}
                    >
                      {isRunning && (
                        <span className="absolute top-2 right-2 material-symbols-outlined text-sm animate-pulse">timelapse</span>
                      )}

                      {editingBoxId === box.id ? (
                        <div className="w-full px-1">
                          <input
                            ref={editingRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            placeholder={t("boxHint")}
                            className="w-full text-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditBox(box)}
                          className={cn(
                            "inline-flex items-center justify-center gap-1 w-full text-sm font-bold px-2 py-1 rounded-lg transition-colors",
                            isRunning
                              ? "bg-white/20 text-white hover:bg-white/30 shadow-sm"
                              : "text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary",
                          )}
                          title={t("edit")}
                        >
                          <span className="truncate">{box.name || t("boxName")}</span>
                          <span className={cn("material-symbols-outlined text-sm shrink-0", isRunning ? "text-white/80" : "text-slate-400")}>
                            edit
                          </span>
                        </button>
                      )}

                      {editingTimeBoxId === box.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={timeMinutes}
                            onChange={(e) => setTimeMinutes(e.target.value)}
                            onBlur={commitTimeEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") cancelTimeEdit();
                            }}
                            aria-label={t("minutes")}
                            className="w-14 text-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-xs font-bold text-slate-400">{t("minutes")}</span>
                          <span className="text-lg font-black text-slate-400">:</span>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={timeSeconds}
                            onChange={(e) => setTimeSeconds(e.target.value)}
                            onBlur={commitTimeEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") cancelTimeEdit();
                            }}
                            aria-label={t("seconds")}
                            className="w-12 text-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-xs font-bold text-slate-400">{t("seconds")}</span>
                        </div>
                      ) : (
                        <span className="text-3xl font-extrabold tabular-nums tracking-tight">
                          {fmtDuration(liveSec)}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(box)}
                          className={cn(
                            "flex items-center justify-center gap-1 px-3 py-2 min-h-11 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            isRunning
                              ? "bg-white/20 text-white hover:bg-white/30"
                              : "bg-primary text-white hover:bg-primary/90"
                          )}
                          aria-label={isRunning ? t("stop") : t("start")}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isRunning ? "pause" : "play_arrow"}
                          </span>
                          {isRunning ? t("stop") : t("start")}
                        </button>
                        <button
                          onClick={() => startEditTime(box)}
                          disabled={isRunning}
                          className={cn(
                            "flex items-center justify-center p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            isRunning
                              ? "text-white/30 cursor-not-allowed"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                          )}
                          title={t("editTime")}
                          aria-label={t("editTime")}
                        >
                          <span className="material-symbols-outlined text-sm">schedule</span>
                        </button>
                        <button
                          onClick={() => handleReset(box)}
                          className={cn(
                            "flex items-center justify-center p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            isRunning
                              ? "text-white/90 hover:text-white hover:bg-white/20"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                          )}
                          title={t("reset")}
                          aria-label={t("reset")}
                        >
                          <span className="material-symbols-outlined text-sm">restart_alt</span>
                        </button>
                        <button
                          onClick={() => removeBox(box)}
                          className={cn(
                            "flex items-center justify-center p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            isRunning
                              ? "text-white/90 hover:text-white hover:bg-white/20"
                              : "text-slate-300 hover:text-red-500 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20",
                          )}
                          title={t("removeBox")}
                          aria-label={t("removeBox")}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add category */}
      <button
        onClick={addCategory}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:border-primary hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined">add</span>
        {t("addCategory")}
      </button>
    </div>
  );
}

/* ---------- save status indicator ---------- */

function SaveStatus({ t }: { t: (key: keyof typeof L.en) => string }) {
  const { status, error, isOnline, syncNow } = useSync();
  const hasPendingChanges = useStore((state) => state.syncMetadata.hasPendingChanges);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isError = mounted && status === "error";
  const isSaving = mounted && !isError && isOnline && (status === "syncing" || hasPendingChanges);
  const isOffline = mounted && !isOnline;
  const icon = isError ? "error" : isSaving ? "sync" : isOffline ? "cloud_off" : "cloud_done";
  const text = isError ? t("saveError") : isSaving ? t("saving") : isOffline ? t("offline") : t("saved");

  return (
    <div
      role="status"
      aria-live="polite"
      title={isError ? (error ?? t("saveError")) : text}
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold",
        isError ? "text-red-500" : isOffline ? "text-amber-600" : isSaving ? "text-primary" : "text-emerald-600",
      )}
    >
      <span className={cn("material-symbols-outlined text-sm", isSaving && "animate-spin")}>{icon}</span>
      <span>{text}</span>
      {isError && (
        <button
          type="button"
          onClick={() => {
            void syncNow().catch(() => undefined);
          }}
          className="font-bold underline underline-offset-2 hover:text-red-700"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
