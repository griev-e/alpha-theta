import { runMonteCarlo, type MonteCarloInputs } from "./montecarlo";

/**
 * Web Worker entry point for the Monte Carlo simulation. Running the ~1M-step
 * GBM off the main thread keeps slider drags and chart animations smooth on the
 * heaviest (30-year) horizons. The simulation is seeded, so the worker's output
 * is bit-identical to running it synchronously — see `useMonteCarlo`, which
 * falls back to the sync path when workers aren't available.
 */
const ctx = self as unknown as Worker;

ctx.addEventListener("message", (e: MessageEvent<{ id: number; inputs: MonteCarloInputs }>) => {
  const { id, inputs } = e.data;
  ctx.postMessage({ id, result: runMonteCarlo(inputs) });
});
