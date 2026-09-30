"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useStore } from "@/lib/store";
import { useSync } from "@/lib/sync";
import type {
  CommentsConfig,
  CommentBox,
  CommentCategory,
} from "@/types/comments";
import { createCommentBox, createCommentCategory } from "@/types/comments";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { motion } from "motion/react";
import { StaggerGroup, fadeUp, SPRING_SOFT } from "@/components/ui/motion";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
    addSubsection: "Add Subsection",
    categoryName: "Category name",
    subsectionName: "Subsection name",
    boxName: "Comment",
    categoryHint: "New category",
    subsectionHint: "New subsection",
    boxHint: "Comment",
    removeCategory: "Delete category",
    removeCategoryConfirm: "Delete this category and all its comments?",
    removeCategoryConfirmSubs: "Delete this category, its subsections and all their comments?",
    removeSubsection: "Delete subsection",
    removeSubsectionConfirm: "Delete this subsection and all its comments?",
    collapse: "Collapse",
    expand: "Expand",
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
    cancel: "Cancel",
    resetTimeConfirm: "Delete the recorded time of this comment?",
  },
  es: {
    title: "Comentarios",
    subtitle: "Libro de temporizadores para medir comentarios de la reunión.",
    addCategory: "Agregar Categoría",
    addBox: "Agregar",
    addSubsection: "Agregar Subsección",
    categoryName: "Nombre de la categoría",
    subsectionName: "Nombre de la subsección",
    boxName: "Comentario",
    categoryHint: "Nueva categoría",
    subsectionHint: "Nueva subsección",
    boxHint: "Comentario",
    removeCategory: "Eliminar categoría",
    removeCategoryConfirm: "¿Eliminar esta categoría y todos sus comentarios?",
    removeCategoryConfirmSubs: "¿Eliminar esta categoría, sus subsecciones y todos sus comentarios?",
    removeSubsection: "Eliminar subsección",
    removeSubsectionConfirm: "¿Eliminar esta subsección y todos sus comentarios?",
    collapse: "Contraer",
    expand: "Expandir",
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
    cancel: "Cancelar",
    resetTimeConfirm: "¿Eliminar el tiempo registrado de este comentario?",
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

/* ---------- box card (shared by category + subsection grids) ---------- */

interface BoxCardProps {
  box: CommentBox;
  color: string;
  liveSec: number;
  isEditingName: boolean;
  isEditingTime: boolean;
  draft: string;
  setDraft: (value: string) => void;
  editingRef: RefObject<HTMLInputElement | null>;
  timeMinutes: string;
  timeSeconds: string;
  setTimeMinutes: (value: string) => void;
  setTimeSeconds: (value: string) => void;
  t: (key: keyof typeof L.en) => string;
  onEditName: () => void;
  onEditTime: () => void;
  onToggle: () => void;
  onReset: () => void;
  onRemove: () => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  commitTimeEdit: () => void;
  cancelTimeEdit: () => void;
}

// Module-level (not nested in CommentsView) so the shared edit inputs keep
// their DOM node — and focus — across parent re-renders.
function BoxCard({
  box,
  color,
  liveSec,
  isEditingName,
  isEditingTime,
  draft,
  setDraft,
  editingRef,
  timeMinutes,
  timeSeconds,
  setTimeMinutes,
  setTimeSeconds,
  t,
  onEditName,
  onEditTime,
  onToggle,
  onReset,
  onRemove,
  commitEdit,
  cancelEdit,
  commitTimeEdit,
  cancelTimeEdit,
}: BoxCardProps) {
  const isRunning = Boolean(box.runningSinceISO);
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: box.id,
    transition: { duration: 150, easing: "ease" },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 aspect-square transition-all",
        isRunning
          ? "bg-primary text-white border-transparent shadow-lg"
          : "bg-surface border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40",
        isDragging && "z-10 shadow-xl ring-2 ring-primary/40"
      )}
      style={{
        ...(isRunning ? {} : { borderTopColor: color, borderTopWidth: 3 }),
        touchAction: "manipulation",
        transform: CSS.Transform.toString(transform),
        // While dragging, kill the Tailwind `transition-all` (class transitions
        // still apply when the inline value is null) so the card is glued to
        // the pointer instead of easing after it.
        transition: isDragging ? "none" : transition,
        willChange: isDragging ? "transform" : undefined,
      }}
    >
      {isRunning && (
        <span className="absolute top-2 right-2 material-symbols-outlined text-sm animate-pulse">timelapse</span>
      )}

      <motion.div
        variants={fadeUp}
        whileHover={isDragging ? undefined : { y: -1 }}
        transition={SPRING_SOFT}
        className="flex w-full flex-col items-center justify-center gap-2"
      >
      {isEditingName ? (
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
          onClick={onEditName}
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

      {isEditingTime ? (
        <div
          className="flex items-center gap-1"
          onBlur={(event) => {
            const next = event.relatedTarget as HTMLElement | null;
            // Focus moving to the toggle button is handled by its own click
            // (commit + close) — don't double-commit here.
            if (next?.closest("[data-time-toggle]")) return;
            // Commit only when focus truly leaves the editor group.
            if (!event.currentTarget.contains(next)) commitTimeEdit();
          }}
        >
          <input
            type="number"
            min={0}
            max={9999}
            value={timeMinutes}
            onChange={(e) => setTimeMinutes(e.target.value)}
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

      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center justify-center gap-1 min-w-11 min-h-11 px-0 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            isRunning
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-primary text-white hover:bg-primary/90"
          )}
          aria-label={isRunning ? t("stop") : t("start")}
        >
          <span className="material-symbols-outlined text-sm">
            {isRunning ? "pause" : "play_arrow"}
          </span>
          <span className="hidden sm:inline">{isRunning ? t("stop") : t("start")}</span>
        </button>
        <button
          onClick={onEditTime}
          disabled={isRunning}
          data-time-toggle
          className={cn(
            "flex items-center justify-center p-1.5 sm:p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            isRunning
              ? "text-white/30 cursor-not-allowed"
              : isEditingTime
                ? "text-primary bg-primary/10"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
          title={isEditingTime ? t("done") : t("editTime")}
          aria-label={isEditingTime ? t("done") : t("editTime")}
        >
          <span className="material-symbols-outlined text-sm">{isEditingTime ? "check" : "schedule"}</span>
        </button>
        <button
          onClick={onReset}
          className={cn(
            "flex items-center justify-center p-1.5 sm:p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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
          onClick={onRemove}
          className={cn(
            "flex items-center justify-center p-1.5 sm:p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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
      </motion.div>
    </div>
  );
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
  // Mirrors editingTimeBoxId so the toggle button always sees the freshest target.
  const editingTimeBoxIdRef = useRef<string | null>(null);
  const [timeMinutes, setTimeMinutes] = useState("0");
  const [timeSeconds, setTimeSeconds] = useState("0");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<{ message: string; confirmLabel: string; run: () => void } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const editingRef = useRef<HTMLInputElement | null>(null);
  const updateCommentBox = useStore((s) => s.updateCommentBox);

  const t = (key: keyof typeof L.en) => pick(lang, L.en[key], L.es[key]);

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

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

  // One-level nesting: root categories (no parent) and their subsections,
  // both kept in sortOrder. Subsections never render their own children.
  const rootCategories = useMemo(
    () => sortedCategories.filter((cat) => !cat.parentCategoryId),
    [sortedCategories],
  );

  const subsectionsByParent = useMemo(() => {
    const map = new Map<string, CommentCategory[]>();
    sortedCategories.forEach((cat) => {
      if (!cat.parentCategoryId) return;
      const list = map.get(cat.parentCategoryId);
      if (list) list.push(cat);
      else map.set(cat.parentCategoryId, [cat]);
    });
    return map;
  }, [sortedCategories]);

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

  // Root aggregates: own boxes plus all (one-level) descendant subsection boxes.
  const rootBoxCount = useCallback(
    (categoryId: string): number => {
      const own = (boxesByCategory.get(categoryId) ?? []).length;
      const subs = subsectionsByParent.get(categoryId) ?? [];
      return subs.reduce((count, sub) => count + (boxesByCategory.get(sub.id) ?? []).length, own);
    },
    [boxesByCategory, subsectionsByParent],
  );

  const rootTotalSec = useCallback(
    (categoryId: string): number => {
      const subs = subsectionsByParent.get(categoryId) ?? [];
      return subs.reduce((sum, sub) => sum + categoryTotalSec(sub.id), categoryTotalSec(categoryId));
    },
    [subsectionsByParent, categoryTotalSec],
  );

  const toggleCollapsed = useCallback((categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

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

  // Reorder a box within its own category/subsection group. Groups are
  // rendered in per-grid DnD contexts, so `over` is always in the same group;
  // the reordered group is written back via slot replacement, keeping every
  // other group's positions in the flat per-week array untouched.
  const handleBoxDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const activeBox = boxes.find((b) => b.id === active.id);
      if (!activeBox) return;
      const group = boxes.filter((b) => b.categoryId === activeBox.categoryId);
      const oldIndex = group.findIndex((b) => b.id === active.id);
      const newIndex = group.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(group, oldIndex, newIndex);
      const slots = boxes
        .map((b, i) => (b.categoryId === activeBox.categoryId ? i : -1))
        .filter((i) => i >= 0);
      const next = [...boxes];
      slots.forEach((slot, k) => {
        if (reordered[k]) next[slot] = reordered[k];
      });
      setWeekBoxes(next);
    },
    [boxes, setWeekBoxes],
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

  // A box is "most recent" when it is the last box of its category in the
  // per-week list — the position where fresh boxes are auto-appended. Only the
  // most recent box spawns a successor; re-timing an older box must not.
  const isMostRecentInCategory = useCallback(
    (list: CommentBox[], boxId: string): boolean => {
      const target = list.find((b) => b.id === boxId);
      if (!target) return false;
      const sameCategory = list.filter((b) => b.categoryId === target.categoryId);
      return sameCategory.length > 0 && sameCategory[sameCategory.length - 1].id === boxId;
    },
    [],
  );

  // AUTO-ADD: when the MOST RECENT box of a category is stopped with time (>0s),
  // append a fresh empty box right after it, ready for the next comment.
  // Stopping a previous (older) box never inserts anything.
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
  // box after it ONLY when it is the most recent box of its category and it
  // accumulated time), then start or stop the tapped box.
  const handleToggle = useCallback(
    (box: CommentBox) => {
      const timestamp = Date.now();
      let nextBoxes = [...boxes];
      const running = boxes.find((b) => Boolean(b.runningSinceISO));

      if (running && running.id !== box.id) {
        nextBoxes = nextBoxes.map((b) => (b.id === running.id ? stopBoxAt(running, timestamp) : b));
        if (isMostRecentInCategory(boxes, running.id)) {
          nextBoxes = insertAutoAddBox(nextBoxes, running.id, runDurationSec(running, timestamp));
        }
      }

      if (box.runningSinceISO) {
        nextBoxes = nextBoxes.map((b) => (b.id === box.id ? stopBoxAt(box, timestamp) : b));
        if (isMostRecentInCategory(boxes, box.id)) {
          nextBoxes = insertAutoAddBox(nextBoxes, box.id, runDurationSec(box, timestamp));
        }
      } else {
        nextBoxes = nextBoxes.map((b) =>
          b.id === box.id
            ? { ...b, runningSinceISO: new Date(timestamp).toISOString() }
            : b,
        );
      }

      setWeekBoxes(nextBoxes);
    },
    [boxes, setWeekBoxes, stopBoxAt, insertAutoAddBox, isMostRecentInCategory, runDurationSec],
  );

  const handleReset = useCallback(
    (box: CommentBox) => {
      if (box.accumulatedSec <= 0 && !box.runningSinceISO) {
        updateCommentBox(weekId, box.id, { accumulatedSec: 0, runningSinceISO: undefined });
        return;
      }
      setConfirm({
        message: t("resetTimeConfirm"),
        confirmLabel: t("reset"),
        run: () => updateCommentBox(weekId, box.id, { accumulatedSec: 0, runningSinceISO: undefined }),
      });
    },
    [updateCommentBox, weekId, t],
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
    const subsections = subsectionsByParent.get(cat.id) ?? [];
    const hasSubsections = subsections.length > 0;
    setConfirm({
      message: t(hasSubsections ? "removeCategoryConfirmSubs" : "removeCategoryConfirm"),
      confirmLabel: t("removeCategory"),
      run: () => {
        const timestamp = Date.now();
        // Finalize any running timer inside the category or its subsections before
        // dropping the boxes, mirroring the stop logic in handleToggle (prevents
        // lost run time). Deleting the root cascades to subsections + their boxes.
        const affectedIds = new Set([cat.id, ...subsections.map((sub) => sub.id)]);
        const boxesByWeek: Record<string, CommentBox[]> = {};
        for (const [wk, list] of Object.entries(config.boxesByWeek)) {
          const finalized = list.map((b) =>
            affectedIds.has(b.categoryId) && b.runningSinceISO ? stopBoxAt(b, timestamp) : b
          );
          boxesByWeek[wk] = finalized.filter((b) => !affectedIds.has(b.categoryId));
        }
        onConfigChange({
          ...config,
          categories: config.categories.filter((c) => !affectedIds.has(c.id)),
          boxesByWeek,
        });
      },
    });
    return;
  };

  const addSubsection = (parent: CommentCategory) => {
    const siblings = subsectionsByParent.get(parent.id) ?? [];
    const sortOrder = Math.max(0, ...siblings.map((sub) => sub.sortOrder)) + 1;
    const sub = createCommentCategory(t("subsectionHint"), parent.color, parent.icon, sortOrder, parent.id);
    onConfigChange({ ...config, categories: [...config.categories, sub] });
    setEditingCategoryId(sub.id);
    setDraft("");
  };

  const removeSubsection = (sub: CommentCategory) => {
    setConfirm({
      message: t("removeSubsectionConfirm"),
      confirmLabel: t("removeSubsection"),
      run: () => {
        const timestamp = Date.now();
        // Finalize any running timer inside the subsection before dropping its boxes.
        const boxesByWeek: Record<string, CommentBox[]> = {};
        for (const [wk, list] of Object.entries(config.boxesByWeek)) {
          const finalized = list.map((b) =>
            b.categoryId === sub.id && b.runningSinceISO ? stopBoxAt(b, timestamp) : b
          );
          boxesByWeek[wk] = finalized.filter((b) => b.categoryId !== sub.id);
        }
        onConfigChange({
          ...config,
          categories: config.categories.filter((c) => c.id !== sub.id),
          boxesByWeek,
        });
      },
    });
    return;
  };

  const addBox = (categoryId: string) => {
    const box = createCommentBox(categoryId, t("boxHint"));
    setWeekBoxes([...boxes, box]);
    setEditingBoxId(box.id);
    setDraft("");
  };

  const removeBox = (box: CommentBox) => {
    setConfirm({
      message: t("removeBoxConfirm"),
      confirmLabel: t("removeBox"),
      run: () => {
        const timestamp = Date.now();
        // Finalize the run before removing the box (prevents lost run time).
        if (box.runningSinceISO) stopBoxAt(box, timestamp);
        setWeekBoxes(boxes.filter((b) => b.id !== box.id));
      },
    });
    return;
  };

  // Quick "+" in the active strip: add a box to the running box's category,
  // or to the first category when nothing is running.
  const quickAdd = () => {
    const categoryId = runningBox?.categoryId ?? sortedCategories[0]?.id;
    if (!categoryId) return;
    addBox(categoryId);
  };

  // ── mm:ss time editor (only when the box is NOT running) ────────────────
  // Toggle: pressing the edit-time button again (now a check mark) commits and
  // brings the stopwatch back. A ref keeps the toggle deterministic even when
  // a blur/commit races the click.
  const startEditTime = (box: CommentBox) => {
    if (box.runningSinceISO) return;
    if (editingTimeBoxIdRef.current === box.id) {
      commitTimeEdit();
      return;
    }
    editingTimeBoxIdRef.current = box.id;
    setEditingTimeBoxId(box.id);
    setTimeMinutes(String(Math.floor(box.accumulatedSec / 60)));
    setTimeSeconds(String(box.accumulatedSec % 60));
  };
  const commitTimeEdit = () => {
    const targetId = editingTimeBoxIdRef.current;
    if (!targetId) return;
    const minutes = Math.min(9999, Math.max(0, Math.floor(Number(timeMinutes) || 0)));
    const seconds = Math.min(59, Math.max(0, Math.floor(Number(timeSeconds) || 0)));
    updateCommentBox(weekId, targetId, { accumulatedSec: minutes * 60 + seconds });
    editingTimeBoxIdRef.current = null;
    setEditingTimeBoxId(null);
  };
  const cancelTimeEdit = () => {
    editingTimeBoxIdRef.current = null;
    setEditingTimeBoxId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 p-4 md:p-6 pb-[calc(env(safe-area-inset-bottom,_0px)+6.75rem)] md:pb-6 overflow-y-auto">
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

        {rootCategories.map((cat) => {
          const catBoxes = boxesByCategory.get(cat.id) ?? [];
          const subsections = subsectionsByParent.get(cat.id) ?? [];
          const collapsed = collapsedCategoryIds.has(cat.id);
          return (
            <section key={cat.id} className="space-y-3">
              {/* Category header */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => toggleCollapsed(cat.id)}
                  className="text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors p-1 -m-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
                  title={collapsed ? t("expand") : t("collapse")}
                  aria-label={collapsed ? t("expand") : t("collapse")}
                  aria-expanded={!collapsed}
                >
                  <span className="material-symbols-outlined text-base">
                    {collapsed ? "chevron_right" : "expand_more"}
                  </span>
                </button>
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
                    className="inline-flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity"
                    title={t("edit")}
                  >
                    <span className="truncate min-w-0">{cat.name || t("categoryName")}</span>
                    <span className={cn("material-symbols-outlined text-base shrink-0", anyRunning ? "text-primary" : "text-slate-400")}>
                      edit
                    </span>
                  </button>
                )}
                <span className="text-xs font-bold text-slate-400 tabular-nums ml-auto shrink-0">
                  {rootBoxCount(cat.id)} · {fmtDuration(rootTotalSec(cat.id))}
                </span>
                <button
                  onClick={() => addSubsection(cat)}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1.5 sm:px-2.5 rounded-lg transition-colors shrink-0"
                  title={t("addSubsection")}
                  aria-label={t("addSubsection")}
                >
                  <span className="material-symbols-outlined text-sm">subdirectory_arrow_right</span>
                  <span className="hidden sm:inline">{t("addSubsection")}</span>
                </button>
                <button
                  onClick={() => addBox(cat.id)}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1.5 sm:px-2.5 rounded-lg transition-colors shrink-0"
                  title={t("addBox")}
                  aria-label={t("addBox")}
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span className="hidden sm:inline">{t("addBox")}</span>
                </button>
                <button
                  onClick={() => removeCategory(cat)}
                  className="text-slate-300 hover:text-red-500 dark:text-slate-600 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
                  title={t("removeCategory")}
                  aria-label={t("removeCategory")}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>

              {!collapsed && (
                <>
                  {/* Box grid */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoxDragEnd}>
                    <SortableContext items={catBoxes.map((b) => b.id)} strategy={rectSortingStrategy}>
                      <StaggerGroup step={0.03} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {catBoxes.map((box) => (
                          <BoxCard
                            key={box.id}
                            box={box}
                            color={cat.color}
                            liveSec={liveSecFor(box)}
                            isEditingName={editingBoxId === box.id}
                            isEditingTime={editingTimeBoxId === box.id}
                            draft={draft}
                            setDraft={setDraft}
                            editingRef={editingRef}
                            timeMinutes={timeMinutes}
                            timeSeconds={timeSeconds}
                            setTimeMinutes={setTimeMinutes}
                            setTimeSeconds={setTimeSeconds}
                            t={t}
                            onEditName={() => startEditBox(box)}
                            onEditTime={() => startEditTime(box)}
                            onToggle={() => handleToggle(box)}
                            onReset={() => handleReset(box)}
                            onRemove={() => removeBox(box)}
                            commitEdit={commitEdit}
                            cancelEdit={cancelEdit}
                            commitTimeEdit={commitTimeEdit}
                            cancelTimeEdit={cancelTimeEdit}
                          />
                        ))}
                        {/* Add tile: keeps an add affordance visible at the end of
                            an expanded list, no scrolling to the header needed. */}
                        <button
                          onClick={() => addBox(cat.id)}
                          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-3 aspect-square text-slate-400 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          title={t("addBox")}
                          aria-label={t("addBox")}
                        >
                          <span className="material-symbols-outlined text-3xl">add</span>
                          <span className="text-[10px] font-bold hidden sm:inline">{t("addBox")}</span>
                        </button>
                      </StaggerGroup>
                    </SortableContext>
                  </DndContext>

                  {/* Subsections (one level deep) */}
                  {subsections.map((sub) => {
                    const subBoxes = boxesByCategory.get(sub.id) ?? [];
                    return (
                      <div key={sub.id} className="pl-6 space-y-2">
                        {/* Subsection header */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color }}
                          />
                          {editingCategoryId === sub.id ? (
                            <input
                              ref={editingRef}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder={t("subsectionName")}
                              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          ) : (
                            <button
                              onClick={() => startEditCategory(sub)}
                              className="inline-flex items-center gap-1.5 min-w-0 text-xs font-bold hover:opacity-80 transition-opacity"
                              title={t("edit")}
                            >
                              <span className="truncate min-w-0">{sub.name || t("subsectionName")}</span>
                              <span className={cn("material-symbols-outlined text-sm shrink-0", anyRunning ? "text-primary" : "text-slate-400")}>
                                edit
                              </span>
                            </button>
                          )}
                          <span className="text-xs font-bold text-slate-400 tabular-nums ml-auto shrink-0">
                            {subBoxes.length} · {fmtDuration(categoryTotalSec(sub.id))}
                          </span>
                          <button
                            onClick={() => addBox(sub.id)}
                            className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1.5 sm:px-2.5 rounded-lg transition-colors shrink-0"
                            title={t("addBox")}
                            aria-label={t("addBox")}
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span className="hidden sm:inline">{t("addBox")}</span>
                          </button>
                          <button
                            onClick={() => removeSubsection(sub)}
                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
                            title={t("removeSubsection")}
                            aria-label={t("removeSubsection")}
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>

                        {/* Subsection box grid */}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoxDragEnd}>
                          <SortableContext items={subBoxes.map((b) => b.id)} strategy={rectSortingStrategy}>
                            <StaggerGroup step={0.03} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {subBoxes.map((box) => (
                                <BoxCard
                                  key={box.id}
                                  box={box}
                                  color={sub.color}
                                  liveSec={liveSecFor(box)}
                                  isEditingName={editingBoxId === box.id}
                                  isEditingTime={editingTimeBoxId === box.id}
                                  draft={draft}
                                  setDraft={setDraft}
                                  editingRef={editingRef}
                                  timeMinutes={timeMinutes}
                                  timeSeconds={timeSeconds}
                                  setTimeMinutes={setTimeMinutes}
                                  setTimeSeconds={setTimeSeconds}
                                  t={t}
                                  onEditName={() => startEditBox(box)}
                                  onEditTime={() => startEditTime(box)}
                                  onToggle={() => handleToggle(box)}
                                  onReset={() => handleReset(box)}
                                  onRemove={() => removeBox(box)}
                                  commitEdit={commitEdit}
                                  cancelEdit={cancelEdit}
                                  commitTimeEdit={commitTimeEdit}
                                  cancelTimeEdit={cancelTimeEdit}
                                />
                              ))}
                              {/* Add tile for the subsection grid. */}
                              <button
                                onClick={() => addBox(sub.id)}
                                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-3 aspect-square text-slate-400 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                title={t("addBox")}
                                aria-label={t("addBox")}
                              >
                                <span className="material-symbols-outlined text-3xl">add</span>
                                <span className="text-[10px] font-bold hidden sm:inline">{t("addBox")}</span>
                              </button>
                            </StaggerGroup>
                          </SortableContext>
                        </DndContext>
                      </div>
                    );
                  })}
                </>
              )}
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

      {confirm && (
        <ConfirmDialog
          open
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={t("cancel")}
          danger
          onConfirm={() => {
            const run = confirm.run;
            setConfirm(null);
            run();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
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
