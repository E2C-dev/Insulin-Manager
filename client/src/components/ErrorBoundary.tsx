import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary
 * 子ツリーで未捕捉の例外が発生した場合にフォールバックUIを表示する。
 * React 18 では関数 ErrorBoundary は提供されないため、必ず class component で実装する。
 *
 * 使い方:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * - props.fallback で上書き可能
 * - props.onReset でリセット時のサイドエフェクトを差し込める
 * - 開発環境 (import.meta.env.DEV) でのみエラー詳細を表示
 * - 必ず console.error を呼び、将来 Sentry 等に流せるようにする
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 観測性のため必ず console.error を呼ぶ (将来 Sentry 連携の前段)
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.error("ErrorBoundary onReset failed:", e);
      }
    }
    window.location.reload();
  };

  handleGoHome = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.error("ErrorBoundary onReset failed:", e);
      }
    }
    // wouter に依存しないため window.location.assign でホームへ
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;
    const error = this.state.error;
    const stackPreview = error?.stack
      ? error.stack.split("\n").slice(0, 6).join("\n")
      : "";

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#fafafa",
          color: "#0f172a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1.75rem",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <AlertCircle size={28} color="#dc2626" aria-hidden="true" />
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              問題が発生しました
            </h1>
          </div>

          <p style={{ color: "#475569", marginTop: 0, marginBottom: "1.25rem", lineHeight: 1.6 }}>
            予期しないエラーが発生し、画面を表示できませんでした。
            「再読み込み」ボタンで復帰するか、「ホームへ戻る」を選択してください。
            問題が続く場合はお手数ですがサポートまでご連絡ください。
          </p>

          {isDev && error && (
            <details
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
                marginBottom: "1.25rem",
                fontSize: "0.8125rem",
              }}
              data-testid="error-boundary-details"
            >
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "#991b1b" }}>
                エラー詳細 (開発環境のみ表示)
              </summary>
              <div style={{ marginTop: "0.5rem", color: "#7f1d1d" }}>
                <strong>message:</strong>
                <pre style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0.5rem" }}>{error.message}</pre>
                {stackPreview && (
                  <>
                    <strong>stack (head):</strong>
                    <pre style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0", fontSize: "0.75rem" }}>
                      {stackPreview}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleReload}
              data-testid="error-boundary-reload"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              再読み込み
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              data-testid="error-boundary-home"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "0.5rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Home size={16} aria-hidden="true" />
              ホームへ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
