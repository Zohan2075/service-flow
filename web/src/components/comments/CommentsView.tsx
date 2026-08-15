"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CommentsConfig,
  CommentsSession,
  CommentBox,
  CommentCategory,
  CommentTiming,
} from "@/types/comments";

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
    total: "Total",
    count: "count",
    active: "Running",
    noCategories: "No categories yet. Add one to start timing comments.",
    sessionLog: "Session Log",
    logEmpty: "No comments timed yet.",
    minutes: "min",
    seconds: "s",
    today: "Today",
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
    total: "Total",
    count: "cant.",
    active: "En curso",
    noCategories: "Aún no hay categorías. Agrega una para empezar a medir comentarios.",
    sessionLog: "Registro",
    logEmpty: "Aún no se ha medido ningún comentario.",
    minutes: "min",
    seconds: "s",
    today: "Hoy",
  },
} as const;

type Lang = "en" | "es";
function pick<T>(lang: Lang, en: T, es: T): T {
  return lang === "es" ? es : en;
}

/* ---------- types ---------- */

interface Props {
  lang: Lang;
  config: CommentsConfig;
  session: CommentsSession | null;
  onConfigChange: (cfg: CommentsConfig) => void;
  onLogEntry: (entry: Omit<CommentTiming, "id" | "updatedAt">) => void;
  onDeleteLog: (logId: string) => void;
}

/* ---------- main component ---------- */

export default function CommentsView({
  lang,
  config,
  session,
  onConfigChange,
  onLogEntry,
  onDeleteLog,
}: Props) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const editingRef = useRef<HTMLInputElement | null>(null);

  const t = (key: keyof typeof L.en) => pick(lang, L.en[key], L.es[key]);

  // Tick once per second while any box is running so live durations update.
  const anyRunning = useMemo(
    () => config.boxes.some((box) => Boolean(box.runningSinceISO)),
    [config.boxes],
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
    config.boxes.forEach((box) => {
      const list = map.get(box.categoryId);
      if (list) list.push(box);
    });
    return map;
  }, [config.boxes, sortedCategories]);

  const liveSecFor = useCallback(
    (box: CommentBox): number => {
      const base = box.accumulatedSec;
      if (!box.runningSinceISO) return base;
      return base + Math.max(0, Math.round((now - Date.parse(box.runningSinceISO)) / 1000));
    },
    [now],
  );

  const categoryTotalSec = useCallback(
    (categoryId: string): number =>
      (boxesByCategory.get(categoryId) ?? []).reduce((sum, box) => sum + liveSecFor(box), 0),
    [boxesByCategory, liveSecFor],
  );

  const runningBox = useMemo(
    () => config.boxes.find((box) => Boolean(box.runningSinceISO)) ?? null,
    [config.boxes],
  );

  const setBox = useCallback(
    (boxId: string, patch: Partial<CommentBox>) => {
      onConfigChange({
        ...config,
        boxes: config.boxes.map((box) => (box.id === boxId ? { ...box, ...patch } : box)),
      });
    },
    [config, onConfigChange],
  );

  // Toggle a box's timer: stop the currently-running box (logging it), then
  // either start or stop the tapped box.
  const handleToggle = useCallback(
    (box: CommentBox) => {
      const timestamp = Date.now();
      const running = config.boxes.find((b) => Boolean(b.runningSinceISO));

      const stopBox = (target: CommentBox): CommentBox => {
        const startMs = Date.parse(target.runningSinceISO ?? "");
        const duration = Number.isFinite(startMs) ? Math.max(0, Math.round((timestamp - startMs) / 1000)) : 0;
        if (duration > 0) {
          onLogEntry({
            boxId: target.id,
            boxName: target.name,
            categoryId: target.categoryId,
            actualStartISO: target.runningSinceISO ?? new Date(timestamp).toISOString(),
            actualEndISO: new Date(timestamp).toISOString(),
            actualDurationSec: duration,
          });
        }
        return { ...target, accumulatedSec: target.accumulatedSec + duration, runningSinceISO: undefined };
      };

      let nextBoxes = config.boxes.map((b) => (b.id === box.id ? box : b));
      if (running && running.id !== box.id) {
        nextBoxes = nextBoxes.map((b) => (b.id === running.id ? stopBox(running) : b));
      }

      if (box.runningSinceISO) {
        nextBoxes = nextBoxes.map((b) => (b.id === box.id ? stopBox(box) : b));
      } else {
        nextBoxes = nextBoxes.map((b) =>
          b.id === box.id
            ? { ...b, runningSinceISO: new Date(timestamp).toISOString() }
            : b,
        );
      }

      onConfigChange({ ...config, boxes: nextBoxes });
    },
    [config, onConfigChange, onLogEntry],
  );

  const handleReset = useCallback(
    (box: CommentBox) => {
      onConfigChange({
        ...config,
        boxes: config.boxes.map((b) =>
          b.id === box.id ? { ...b, accumulatedSec: 0, runningSinceISO: undefined } : b,
        ),
      });
    },
    [config, onConfigChange],
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
      const box = config.boxes.find((b) => b.id === editingBoxId);
      if (box && name) setBox(editingBoxId, { name });
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
    const timestamp = new Date().toISOString();
    const sortOrder = Math.max(0, ...config.categories.map((c) => c.sortOrder)) + 1;
    const cat: CommentCategory = {
      id: `cat_${Date.now()}`,
      name: t("categoryHint"),
      color: CATEGORY_COLORS[config.categories.length % CATEGORY_COLORS.length],
      icon: CATEGORY_ICONS[config.categories.length % CATEGORY_ICONS.length],
      sortOrder,
      updatedAt: timestamp,
    };
    onConfigChange({ ...config, categories: [...config.categories, cat] });
    setEditingCategoryId(cat.id);
    setDraft("");
  };

  const removeCategory = (cat: CommentCategory) => {
    if (!window.confirm(t("removeCategoryConfirm"))) return;
    onConfigChange({
      ...config,
      categories: config.categories.filter((c) => c.id !== cat.id),
      boxes: config.boxes.filter((b) => b.categoryId !== cat.id),
    });
  };

  const addBox = (categoryId: string) => {
    const timestamp = new Date().toISOString();
    const box: CommentBox = {
      id: `box_${Date.now()}`,
      categoryId,
      name: t("boxHint"),
      accumulatedSec: 0,
      updatedAt: timestamp,
    };
    onConfigChange({ ...config, boxes: [...config.boxes, box] });
    setEditingBoxId(box.id);
    setDraft("");
  };

  const removeBox = (box: CommentBox) => {
    if (!window.confirm(t("removeBoxConfirm"))) return;
    onConfigChange({
      ...config,
      boxes: config.boxes.filter((b) => b.id !== box.id),
    });
  };

  const sessionLog = session?.log ?? [];
  const totalCount = sessionLog.length;
  const totalSec = sessionLog.reduce((sum, entry) => sum + (entry.actualDurationSec ?? 0), 0);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 p-4 md:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-slate-400 mt-1">{t("subtitle")}</p>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-full">
              {totalCount} {t("count")}
            </span>
            <span className="bg-surface border border-slate-200 dark:border-slate-800 font-bold px-3 py-1.5 rounded-full">
              {t("total")} {fmtDuration(totalSec)}
            </span>
          </div>
        )}
      </div>

      {/* Active timer strip */}
      {runningBox && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary text-white shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined animate-pulse">timelapse</span>
            <div className="min-w-0">
              <p className="text-xs opacity-80 font-medium">{t("active")}</p>
              <p className="font-bold truncate">{runningBox.name || t("boxName")}</p>
            </div>
          </div>
          <span className="text-2xl font-extrabold tabular-nums">{fmtDuration(liveSecFor(runningBox))}</span>
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
          const boxes = boxesByCategory.get(cat.id) ?? [];
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
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    placeholder={t("categoryName")}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <button
                    onClick={() => startEditCategory(cat)}
                    className="text-lg font-extrabold hover:opacity-80 transition-opacity"
                    title={t("edit")}
                  >
                    {cat.name || t("categoryName")}
                  </button>
                )}
                <span className="text-xs font-bold text-slate-400 tabular-nums ml-auto">
                  {boxes.length} · {fmtDuration(catTotal)}
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
                  className="text-slate-300 hover:text-red-500 dark:text-slate-600 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title={t("removeCategory")}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>

              {/* Box grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {boxes.map((box) => {
                  const isRunning = Boolean(box.runningSinceISO);
                  const liveSec = liveSecFor(box);
                  return (
                    <div
                      key={box.id}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 aspect-square transition-all",
                        isRunning
                          ? "bg-primary text-white border-transparent shadow-lg"
                          : "bg-surface border-slate-200 dark:border-slate-800 hover:border-primary/40"
                      )}
                      style={isRunning ? undefined : { borderTopColor: cat.color, borderTopWidth: 3 }}
                    >
                      {isRunning && (
                        <span className="absolute top-2 right-2 material-symbols-outlined text-sm animate-pulse">timelapse</span>
                      )}

                      <button
                        onClick={() => (editingBoxId === box.id ? commitEdit() : startEditBox(box))}
                        className={cn(
                          "w-full text-center text-sm font-bold truncate px-1",
                          isRunning ? "text-white/90 hover:text-white" : "text-slate-700 dark:text-slate-300 hover:text-primary",
                        )}
                        title={t("edit")}
                      >
                        {editingBoxId === box.id ? (
                          <input
                            ref={editingRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            placeholder={t("boxHint")}
                            className="w-full text-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-0.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : (
                          box.name || t("boxName")
                        )}
                      </button>

                      <span className="text-3xl font-extrabold tabular-nums tracking-tight">
                        {fmtDuration(liveSec)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(box)}
                          className={cn(
                            "flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                            isRunning
                              ? "bg-white/20 text-white hover:bg-white/30"
                              : "bg-primary text-white hover:bg-primary/90"
                          )}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isRunning ? "pause" : "play_arrow"}
                          </span>
                          {isRunning ? t("stop") : t("start")}
                        </button>
                        <button
                          onClick={() => handleReset(box)}
                          className="flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title={t("reset")}
                        >
                          <span className="material-symbols-outlined text-sm">restart_alt</span>
                        </button>
                        <button
                          onClick={() => removeBox(box)}
                          className="flex items-center justify-center p-1.5 rounded-xl text-slate-300 hover:text-red-500 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t("removeBox")}
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

      {/* Session log */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">{t("sessionLog")}</h3>
          {totalCount > 0 && (
            <span className="text-xs font-bold text-slate-400">
              {t("total")} {fmtDuration(totalSec)}
            </span>
          )}
        </div>
        {sessionLog.length === 0 ? (
          <p className="text-sm text-slate-400">{t("logEmpty")}</p>
        ) : (
          <ul className="space-y-1.5">
            {[...sessionLog].reverse().map((entry) => {
              const cat = config.categories.find((c) => c.id === entry.categoryId);
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface border border-slate-200 dark:border-slate-800"
                >
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.boxName}</p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {new Date(entry.actualStartISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(entry.actualEndISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{fmtDuration(entry.actualDurationSec)}</span>
                  <button
                    onClick={() => onDeleteLog(entry.id!)}
                    className="text-slate-300 hover:text-red-500 dark:text-slate-600 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t("removeBox")}
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}