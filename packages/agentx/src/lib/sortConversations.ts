import type { ConversationSummary } from "@/slices/chatSlice";

/**
 * Sort conversations according to a stored ordered ID list.
 * IDs present in `orderedIds` come first (in that order),
 * any remaining conversations are appended sorted by `updatedAt` descending.
 */
export function applySectionOrder(
  conversations: ConversationSummary[],
  orderedIds: string[],
): ConversationSummary[] {
  if (orderedIds.length === 0) {
    return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const idSet = new Set(orderedIds);
  const byId = new Map(conversations.map((c) => [c.id, c]));

  // Ordered conversations (skip IDs that no longer exist)
  const ordered: ConversationSummary[] = [];
  for (const id of orderedIds) {
    const conv = byId.get(id);
    if (conv) ordered.push(conv);
  }

  // Unordered conversations appended by recency
  const unordered = conversations
    .filter((c) => !idSet.has(c.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return [...ordered, ...unordered];
}
