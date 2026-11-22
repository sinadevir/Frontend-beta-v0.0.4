import { useEffect, useState, useSyncExternalStore } from "react";
import { useIsFetching } from "@tanstack/react-query";

/** The loader is shown for at least this long (no flicker)… */
export const SECTION_LOADER_MIN_MS = 1000;
/** …and never longer than this, even if a request is still running. */
export const SECTION_LOADER_MAX_MS = 5000;

/* ── "something is loading" registry: lets menus, tab lists and wizard buttons ignore clicks meanwhile (anti-spam) ── */
const active = new Set<symbol>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };
export const useSectionBusy = () => useSyncExternalStore(subscribe, () => active.size > 0, () => false);

/**
 * Loading window for one page area. Starts whenever `trigger` changes (route, tab, wizard step), or on mount when
 * `loadOnMount` is set. Lasts at least 1 s, then ends as soon as no request is running, and at the latest after 5 s.
 */
export function useLoadingWindow(trigger: unknown, loadOnMount = false): boolean {
  const fetching = useIsFetching();
  const [seen, setSeen] = useState(trigger);
  const [loading, setLoading] = useState(loadOnMount);
  const [minDone, setMinDone] = useState(!loadOnMount);
  const [run, setRun] = useState(loadOnMount ? 1 : 0);

  // trigger changed: start before the new content is ever painted
  if (!Object.is(seen, trigger)) {
    setSeen(trigger);
    setLoading(true);
    setMinDone(false);
    setRun((r) => r + 1);
  }

  useEffect(() => {
    if (!run) return;
    const min = window.setTimeout(() => setMinDone(true), SECTION_LOADER_MIN_MS);
    const max = window.setTimeout(() => setLoading(false), SECTION_LOADER_MAX_MS);
    return () => { window.clearTimeout(min); window.clearTimeout(max); };
  }, [run]);

  useEffect(() => {
    if (loading && minDone && fetching === 0) setLoading(false);
  }, [loading, minDone, fetching]);

  useEffect(() => {
    if (!loading) return;
    const id = Symbol("loading");
    active.add(id); emit();
    return () => { active.delete(id); emit(); };
  }, [loading]);

  return loading;
}
