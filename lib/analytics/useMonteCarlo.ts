"use client";

import { useEffect, useRef, useState } from "react";
import {
  runMonteCarlo,
  type MonteCarloInputs,
  type MonteCarloResult,
} from "./montecarlo";

/**
 * Runs the Monte Carlo simulation in a Web Worker, keeping the main thread free
 * during a recompute so the UI stays responsive while sliders move. Mirrors
 * `useAsyncCompute`'s contract: paints with the previous result while the next
 * one is in flight (charts don't unmount), and exposes a `pending` flag.
 *
 * Resilience: if Workers are unavailable (SSR, older browsers) or one fails to
 * spawn, it transparently falls back to running the simulation synchronously on
 * the next tick — the same path the rest of the analytics use.
 */
export function useMonteCarlo(
  inputs: MonteCarloInputs | null
): { result: MonteCarloResult | null; pending: boolean } {
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [pending, setPending] = useState(true);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  // Spin up a single worker for the component's lifetime.
  useEffect(() => {
    if (typeof Worker !== "undefined") {
      try {
        workerRef.current = new Worker(
          new URL("./montecarlo.worker.ts", import.meta.url),
          { type: "module" }
        );
      } catch {
        workerRef.current = null;
      }
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const key = inputs ? JSON.stringify(inputs) : null;

  useEffect(() => {
    if (!inputs) {
      setResult(null);
      setPending(false);
      return;
    }
    setPending(true);
    const id = ++reqId.current;
    const worker = workerRef.current;

    // Synchronous fallback, deferred one tick so the UI paints first.
    const runSync = () => {
      if (id !== reqId.current) return;
      setResult(runMonteCarlo(inputs));
      setPending(false);
    };

    if (worker) {
      const onMessage = (e: MessageEvent<{ id: number; result: MonteCarloResult }>) => {
        if (e.data.id !== id) return; // ignore stale responses
        setResult(e.data.result);
        setPending(false);
        cleanup();
      };
      const onError = () => {
        cleanup();
        runSync();
      };
      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, inputs });
      return cleanup;
    }

    const t = setTimeout(runSync, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { result, pending };
}
