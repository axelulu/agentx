import { useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { RootState, AppDispatch } from "@/slices/store";
import { reorderConversations, reorderFolders } from "@/slices/settingsSlice";
import type { Folder } from "@/slices/settingsSlice";
import { updateConversationFolder, toggleConversationFavorite } from "@/slices/chatSlice";

export type DragItemType = "conversation" | "folder";

interface DndState {
  activeId: string | null;
  activeType: DragItemType | null;
}

/**
 * Extracts the section key from a sortable item's data or from the item ID prefix.
 * Convention: sortable IDs encode section as `section::conversationId`.
 */
function parseSortableId(id: string): { section: string; itemId: string } {
  const sep = id.indexOf("::");
  if (sep === -1) return { section: "", itemId: id };
  return { section: id.slice(0, sep), itemId: id.slice(sep + 2) };
}

export function useConversationDnd(
  sectionOrderedIds: Record<string, string[]>,
  sortedFolders: Folder[],
) {
  const dispatch = useDispatch<AppDispatch>();
  const conversations = useSelector((state: RootState) => state.chat.conversations);

  const [dndState, setDndState] = useState<DndState>({ activeId: null, activeType: null });
  const [overSectionId, setOverSectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const type = (active.data.current?.type as DragItemType) ?? "conversation";
    const parsed = parseSortableId(String(active.id));
    setDndState({ activeId: parsed.itemId, activeType: type });
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverSectionId(null);
      return;
    }
    // Check if we're over a droppable section header
    const droppableSection = over.data.current?.droppableSection as string | undefined;
    if (droppableSection) {
      setOverSectionId(droppableSection);
    } else {
      // Derive section from sortable ID
      const parsed = parseSortableId(String(over.id));
      // When hovering over a folder sortable header (folder::folderId),
      // use the actual folder ID, not the literal "folder" prefix
      const section = parsed.section === "folder" ? parsed.itemId : parsed.section;
      setOverSectionId(section || null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDndState({ activeId: null, activeType: null });
      setOverSectionId(null);

      if (!over) return;

      const activeType = (active.data.current?.type as DragItemType) ?? "conversation";

      // --- Folder reorder ---
      if (activeType === "folder") {
        const activeFolder = parseSortableId(String(active.id)).itemId;

        // The over target could be a sortable (folder::id) or a droppable (drop::id)
        // since SortableFolderHeader registers both on the same node.
        const overRaw = String(over.id);
        let overFolder: string;
        if (overRaw.startsWith("folder::")) {
          overFolder = overRaw.slice(8);
        } else if (overRaw.startsWith("drop::")) {
          overFolder = overRaw.slice(6);
        } else {
          return; // Not over a valid folder target
        }

        if (activeFolder === overFolder) return;

        const oldIndex = sortedFolders.findIndex((f) => f.id === activeFolder);
        const newIndex = sortedFolders.findIndex((f) => f.id === overFolder);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedFolders, oldIndex, newIndex).map((f, i) => ({
          ...f,
          order: i,
        }));
        dispatch(reorderFolders(reordered));
        return;
      }

      // --- Conversation drag ---
      const activeParsed = parseSortableId(String(active.id));
      const overParsed = parseSortableId(String(over.id));
      const convId = activeParsed.itemId;

      // Check if dropped on a droppable section header
      const droppableSection = over.data.current?.droppableSection as string | undefined;

      if (droppableSection) {
        // Move to section header
        if (droppableSection === "favorites") {
          const conv = conversations.find((c) => c.id === convId);
          if (conv && !conv.isFavorite) {
            dispatch(toggleConversationFavorite({ id: convId, isFavorite: true }));
          }
        } else if (droppableSection === "ungrouped") {
          const conv = conversations.find((c) => c.id === convId);
          if (conv && (conv.folderId || conv.isFavorite)) {
            if (conv.isFavorite) {
              dispatch(toggleConversationFavorite({ id: convId, isFavorite: false }));
            }
            if (conv.folderId) {
              dispatch(updateConversationFolder({ id: convId, folderId: null }));
            }
          }
        } else {
          // droppableSection is a folder ID
          dispatch(updateConversationFolder({ id: convId, folderId: droppableSection }));
        }
        return;
      }

      // Same-section reorder
      const fromSection = activeParsed.section;
      const toSection = overParsed.section;

      if (fromSection && toSection && fromSection === toSection) {
        const currentIds = sectionOrderedIds[fromSection] ?? [];
        const oldIdx = currentIds.indexOf(convId);
        const newIdx = currentIds.indexOf(overParsed.itemId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

        const reordered = arrayMove(currentIds, oldIdx, newIdx);
        dispatch(reorderConversations({ section: fromSection, orderedIds: reordered }));
        return;
      }

      // Cross-section: move conversation to the target section
      if (fromSection !== toSection && toSection) {
        // When dropped on a folder sortable header, toSection is the literal
        // string "folder" and the actual folder ID is in overParsed.itemId.
        const effectiveSection = toSection === "folder" ? overParsed.itemId : toSection;

        if (effectiveSection === "favorites") {
          const conv = conversations.find((c) => c.id === convId);
          if (conv && !conv.isFavorite) {
            dispatch(toggleConversationFavorite({ id: convId, isFavorite: true }));
          }
        } else if (effectiveSection === "ungrouped") {
          const conv = conversations.find((c) => c.id === convId);
          if (conv) {
            if (conv.isFavorite) {
              dispatch(toggleConversationFavorite({ id: convId, isFavorite: false }));
            }
            if (conv.folderId) {
              dispatch(updateConversationFolder({ id: convId, folderId: null }));
            }
          }
        } else {
          // effectiveSection is a folder ID
          const conv = conversations.find((c) => c.id === convId);
          if (conv?.isFavorite) {
            dispatch(toggleConversationFavorite({ id: convId, isFavorite: false }));
          }
          dispatch(updateConversationFolder({ id: convId, folderId: effectiveSection }));
        }
      }
    },
    [dispatch, conversations, sectionOrderedIds, sortedFolders],
  );

  const handleDragCancel = useCallback(() => {
    setDndState({ activeId: null, activeType: null });
    setOverSectionId(null);
  }, []);

  return useMemo(
    () => ({
      sensors,
      activeId: dndState.activeId,
      activeType: dndState.activeType,
      overSectionId,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    }),
    [
      sensors,
      dndState,
      overSectionId,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
    ],
  );
}
