// ─────────────────────────────────────────────────────────────────────────────
// main.tsx — React entry point (keep this file minimal)
// ─────────────────────────────────────────────────────────────────────────────
//
// This file boots the React app. It finds the <div id="root"> in index.html
// and hands control to App.tsx, which renders everything you see in the window.
//
// StrictMode is a React developer tool that intentionally runs things twice
// in development to catch common bugs early. It has zero effect in production.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App render crash:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: "#ff6b6b", fontFamily: "monospace",
                      background: "#1a1a1a", height: "100vh", boxSizing: "border-box" }}>
          <h2 style={{ marginBottom: 16, color: "#ff6b6b" }}>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#ccc", overflow: "auto" }}>
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          <button onClick={() => this.setState({ error: null })}
                  style={{ marginTop: 24, padding: "8px 16px", cursor: "pointer" }}>
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
