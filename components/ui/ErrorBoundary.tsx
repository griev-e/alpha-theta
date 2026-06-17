"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Short name of the section, used in the fallback copy. */
  label?: string;
  /** Optional custom fallback; defaults to a compact retry panel. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Wraps a heavy analytics or chart section so a render-time crash (bad numeric
 * data producing NaN coordinates, an unexpected shape, etc.) degrades to a
 * retry panel instead of taking down the whole page. The rest of the page —
 * sidebar, other cards — keeps working. Pair with the route-level `error.tsx`
 * for errors that escape these boundaries.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div
        role="alert"
        className="panel flex flex-col items-center justify-center gap-3 px-6 py-10 text-center"
      >
        <div className="text-[13px] text-mute">
          {this.props.label
            ? `${this.props.label} couldn't be rendered.`
            : "This section couldn't be rendered."}
        </div>
        <button onClick={this.reset} className="btn-secondary">
          Try again
        </button>
      </div>
    );
  }
}
