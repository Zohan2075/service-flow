// ─── Comments (Comentarios) Timer Book Types ──────────────────────────────────
// A simple square-timer book for tracking meeting comments by category.
// Each box is an unlimited stopwatch with an editable name; boxes are grouped
// into user-defined categories. Categories are shared across program weeks;
// boxes and their accumulated times are per week (each week starts fresh).

export interface CommentCategory {
  id: string;
  name: string;
  color: string;   // hex
  icon: string;    // Material Symbols name
  sortOrder: number;
  updatedAt?: string;
}

export interface CommentBox {
  id: string;
  categoryId: string;
  name: string;
  /** Accumulated seconds from completed runs (persists across sessions). */
  accumulatedSec: number;
  /** ISO datetime when this box's timer is currently running (reload-safe). */
  runningSinceISO?: string;
  updatedAt?: string;
}

export interface CommentsConfig {
  categories: CommentCategory[];
  /** Per-week comment boxes; key is the program weekId (e.g. "2026-W33"). */
  boxesByWeek: Record<string, CommentBox[]>;
}

// ─── Default config ───────────────────────────────────────────────────────────

let _counter = 0;
export function newCommentId(): string {
  return `cmt_${Date.now()}_${++_counter}`;
}

export function getDefaultCommentsConfig(): CommentsConfig {
  return {
    categories: [],
    boxesByWeek: {},
  };
}

export function createCommentCategory(name = "", color = "#2B579A", icon = "category", sortOrder = 0): CommentCategory {
  return {
    id: newCommentId(),
    name,
    color,
    icon,
    sortOrder,
    updatedAt: new Date().toISOString(),
  };
}

export function createCommentBox(categoryId: string, name = ""): CommentBox {
  return {
    id: newCommentId(),
    categoryId,
    name,
    accumulatedSec: 0,
    updatedAt: new Date().toISOString(),
  };
}
