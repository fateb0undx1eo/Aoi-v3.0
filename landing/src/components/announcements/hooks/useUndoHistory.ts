import { useCallback, useEffect, useRef, useState } from "react";
import { cloneQueryData } from "../utils/message";
import type { QueryData } from "../types";

export function useUndoHistory(data: QueryData) {
  const [history, setHistory] = useState<QueryData[]>([cloneQueryData(data)]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const skipHistoryRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(data);
  const historyIdxRef = useRef(historyIdx);
  latestDataRef.current = data;
  historyIdxRef.current = historyIdx;

  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const hidx = historyIdxRef.current;
      setHistory((prev) => {
        const next = prev.slice(0, hidx + 1);
        next.push(cloneQueryData(latestDataRef.current));
        if (next.length > 50) next.splice(0, next.length - 50);
        return next;
      });
      setHistoryIdx((prev) => prev + 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [data]);

  const flushHistory = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      const hidx = historyIdxRef.current;
      setHistory((prev) => {
        const next = prev.slice(0, hidx + 1);
        next.push(cloneQueryData(latestDataRef.current));
        if (next.length > 50) next.splice(0, next.length - 50);
        return next;
      });
      setHistoryIdx((prev) => prev + 1);
    }
  }, []);

  const undo = useCallback(() => {
    flushHistory();
    if (historyIdx <= 0) return null;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    return cloneQueryData(history[newIdx]!);
  }, [historyIdx, history, flushHistory]);

  const redo = useCallback(() => {
    flushHistory();
    if (historyIdx >= history.length - 1) return null;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    return cloneQueryData(history[newIdx]!);
  }, [historyIdx, history, flushHistory]);

  const resetHistory = useCallback((initial: QueryData) => {
    setHistory([cloneQueryData(initial)]);
    setHistoryIdx(0);
  }, []);

  return { undo, redo, flushHistory, resetHistory, skipHistoryRef, canUndo: historyIdx > 0, canRedo: historyIdx < history.length - 1 };
}
