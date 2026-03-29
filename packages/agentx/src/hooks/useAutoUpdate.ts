import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { silentAutoUpdate, downloadUpdate } from "@/slices/updateSlice";

/**
 * On app launch: silently check for updates → auto-download if available.
 * No dialog is shown. When download completes, the restart button appears in the TabBar.
 */
export function useAutoUpdate(): void {
  const dispatch = useDispatch<AppDispatch>();
  const updateState = useSelector((s: RootState) => s.update.state);
  const silent = useSelector((s: RootState) => s.update.silent);
  const triggered = useRef(false);

  // Step 1: Check for updates on mount
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    // Small delay to let app settle
    const timer = setTimeout(() => {
      dispatch(silentAutoUpdate());
    }, 3000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  // Step 2: Auto-download when update is available (silent mode only)
  useEffect(() => {
    if (silent && updateState === "available") {
      dispatch(downloadUpdate());
    }
  }, [silent, updateState, dispatch]);
}
