/**
 * Comments as threads, replies at any depth folded under their top-level
 * comment (cooktrace/src/components/recipe/RecipeComments.svelte).
 */
export interface ThreadComment {
  id: number;
  parent_id: number | null;
  created_at: string;
}

export interface Thread<T> {
  root: T;
  replies: T[];
}

/** How many of the newest threads show before "show all" */
export const VISIBLE_THREADS = 5;

export function commentThreads<T extends ThreadComment>(
  comments: readonly T[],
): Thread<T>[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootOf = (comment: T): T => {
    let current = comment;
    const seen = new Set<number>();
    while (current.parent_id !== null && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  const threads = new Map<number, Thread<T>>();
  for (const comment of comments) {
    if (comment.parent_id === null) {
      threads.set(comment.id, { root: comment, replies: [] });
    }
  }
  for (const comment of comments) {
    if (comment.parent_id === null) continue;
    const root = rootOf(comment);
    const thread = threads.get(root.id);
    if (thread) thread.replies.push(comment);
    // The parent is gone: the reply starts a thread of its own.
    else threads.set(comment.id, { root: comment, replies: [] });
  }
  for (const thread of threads.values()) {
    thread.replies.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return [...threads.values()];
}
