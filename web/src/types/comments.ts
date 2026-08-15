// ─── Comments (Comentarios) Timer Book Types ──────────────────────────────────
// A simple square-timer book for tracking meeting comments by category.
// Each box is an unlimited stopwatch with an editable name; boxes are grouped
// into user-defined categories. Completed runs are logged to a session.

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

export interface CommentTiming {
  id?: string;
  boxId: string;
  boxName: string;
  categoryId: string;
  actualStartISO: string;
  actualEndISO: string;
  actualDurationSec: number;
  updatedAt?: string;
}

export interface CommentsSession {
  id?: string;
  date: string;        // "yyyy-MM-dd"
  startedAt: string;   // ISO datetime
  log: CommentTiming[];
  updatedAt?: string;
}

export interface CommentsConfig {
  categories: CommentCategory[];
  boxes: CommentBox[];
}

// ─── Default config ───────────────────────────────────────────────────────────

let _counter = 0;
export function newCommentId(): string {
  return `cmt_${Date.now()}_${++_counter}`;
}

export function getDefaultCommentsConfig(): CommentsConfig {
  const now = new Date().toISOString();
  return {
    categories: [
      { id: "cat_audience", name: "Audience", color: "#2B579A", icon: "record_voice_over", sortOrder: 0, updatedAt: now },
    ],
    boxes: [],
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
