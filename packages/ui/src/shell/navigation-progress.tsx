"use client";

import { Box, Progress, VisuallyHidden } from "@mantine/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared registry of pending client-side navigations. Each `NavPendingIndicator`
 * (rendered inside a `next/link` anchor) registers while `useLinkStatus` is
 * pending; the top progress bar shows while any link is pending. This keeps
 * `@cdorneles/ui` Next-free: the Next-aware reporter is handed in by the app.
 */
const PendingLinksContext = createContext<{
  /** Registers a pending link and returns the unregister function. */
  register: () => () => void;
} | null>(null);

export function usePendingLink(pending: boolean): void {
  const context = useContext(PendingLinksContext);
  const register = context?.register;
  useEffect(() => {
    if (!pending || !register) return;
    return register();
  }, [pending, register]);
}

const GROW_TICK_MS = 120;
const GROW_CEILING = 90;
const COMPLETION_FLASH_MS = 350;

/**
 * NProgress-style top bar. Renders nothing when no navigation is pending;
 * while one is, it animates to a ceiling and completes with a short flash
 * when the last navigation settles. Fixed to the viewport top so it is
 * visible regardless of scroll.
 */
export function NavigationProgress({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completing, setCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const register = useCallback(() => {
    setCount((current) => current + 1);
    const id = { released: false };
    return () => {
      if (id.released) return;
      id.released = true;
      setCount((current) => Math.max(0, current - 1));
    };
  }, []);

  const value = useMemo(() => ({ register }), [register]);

  // Grow the bar towards the ceiling while navigations are pending.
  useEffect(() => {
    if (count === 0) return;
    setProgress((current) => (current === 0 ? 8 : current));
    timerRef.current = setInterval(() => {
      setProgress((current) =>
        current < GROW_CEILING ? current + Math.max(0.5, (GROW_CEILING - current) * 0.04) : current,
      );
    }, GROW_TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [count]);

  // All navigations settled: snap to 100% before the fade.
  useEffect(() => {
    if (count > 0 || progress === 0 || completing) return;
    setCompleting(true);
    setProgress(100);
  }, [count, progress, completing]);

  // Fade out after the completion flash. A navigation starting during the
  // flash keeps the bar up (the reset only happens when nothing is pending).
  useEffect(() => {
    if (!completing) return;
    const timeout = setTimeout(() => {
      setCompleting(false);
      setProgress((current) => (count > 0 ? current : 0));
    }, COMPLETION_FLASH_MS);
    return () => clearTimeout(timeout);
  }, [completing, count]);

  const visible = count > 0 || completing;

  return (
    <PendingLinksContext.Provider value={value}>
      {children}
      {visible ? (
        <Box
          pos="fixed"
          top={0}
          left={0}
          right={0}
          style={{ zIndex: 2000, pointerEvents: "none" }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <Progress value={progress} size={3} radius={0} color="brand" aria-hidden />
          <VisuallyHidden>Carregando…</VisuallyHidden>
        </Box>
      ) : null}
    </PendingLinksContext.Provider>
  );
}
