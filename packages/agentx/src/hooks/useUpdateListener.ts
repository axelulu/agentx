import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUpdateStatus } from "@/slices/updateSlice";

export function useUpdateListener(): void {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = window.api.updater.onStatus((status: unknown) => {
      const s = status as {
        state: string;
        version?: string;
        progress?: { percent: number; bytesPerSecond: number; transferred: number; total: number };
        error?: string;
      };
      dispatch(
        setUpdateStatus({
          state: s.state as Parameters<typeof setUpdateStatus>[0]["state"],
          version: s.version,
          progress: s.progress,
          error: s.error,
        }),
      );
    });
    return unsubscribe;
  }, [dispatch]);
}
