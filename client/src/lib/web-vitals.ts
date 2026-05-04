/**
 * Web Vitals 計測 (Sprint 4 / S4-3)
 *
 * 設計方針:
 *  - 動的 import で web-vitals を取り込む → entry chunk への影響をゼロに近づける
 *  - 5 指標 (CLS / LCP / INP / FCP / TTFB) を console.log で必ず出力
 *  - "poor" 評価のもののみ Sentry に送る (Sentry 未初期化なら no-op)
 *  - web-vitals 自体は ~5KB と軽量だが、初期描画の妨げにならないよう lazy load
 */

import type { Metric } from "web-vitals";
import { captureException } from "./sentry";

function reportMetric(metric: Metric) {
  // env なしでも見える形で必ず console に出す
  // eslint-disable-next-line no-console
  console.log(
    `[web-vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
  );

  // poor のみ Sentry に通知 (Sentry 未初期化なら captureException が no-op)
  if (metric.rating === "poor") {
    captureException(
      new Error(`web-vitals poor: ${metric.name}=${metric.value.toFixed(2)}`),
      {
        metric: metric.name,
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
        rating: metric.rating,
        navigationType: metric.navigationType,
      },
    );
  }
}

export async function startWebVitalsTracking(): Promise<void> {
  try {
    const { onCLS, onLCP, onINP, onFCP, onTTFB } = await import("web-vitals");
    onCLS(reportMetric);
    onLCP(reportMetric);
    onINP(reportMetric);
    onFCP(reportMetric);
    onTTFB(reportMetric);
  } catch (err) {
    console.warn("[web-vitals] failed to load:", err);
  }
}
