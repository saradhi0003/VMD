"use client";

import { Component, type ReactNode } from "react";

/**
 * Renders nothing if its child throws.
 *
 * For non-essential UI — the biometric lock, the idle-logout clock — that runs
 * against platform APIs we can't fully test (an Android WebView's Capacitor
 * bridge behaves differently from any browser). A convenience feature must never
 * be able to take down the page it's decorating: same principle as golden rule 5
 * for the LLM.
 *
 * Errors are logged so they're still visible in remote debugging.
 */
export class SafeBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[SafeBoundary:${this.props.label}] disabled after error:`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
