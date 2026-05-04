/**
 * Health Monitor (Sprint 4 / S4-4)
 *
 * 役割:
 *  - 直近 2 分の HTTP レスポンスをメモリ ring buffer に集計
 *  - 5xx レートが 1% を超え、かつ十分なサンプル数 (50req+) があれば Slack Webhook に通知
 *  - 同一アラートは 10 分以内 1 回のみ送る (suppression)
 *
 * 設計方針:
 *  - SLACK_WEBHOOK_URL env が無ければ完全 no-op (record だけ進む / 送信は走らない)
 *  - middleware は Express の res.on("finish") で記録するだけなので、
 *    リクエスト処理のレイテンシに影響しない (純非同期 / try-catch 全防御)
 *  - 既存の error handler は破壊しない (これは独立 middleware)
 */

const SLACK_URL = process.env.SLACK_WEBHOOK_URL;
const WINDOW_MS = 120_000; // 2 分
const MIN_SAMPLES = 50; // 50 リクエスト溜まってから判定
const ERROR_RATE_THRESHOLD = 0.01; // 1%
const ALERT_SUPPRESSION_MS = 600_000; // 10 分

interface RequestRecord {
  ts: number;
  status: number;
}

const ring: RequestRecord[] = [];
let lastAlertTs = 0;

/**
 * Express middleware から呼ばれる recorder。
 * status を ring に積み、必要なら閾値判定 → Slack 送信を fire-and-forget で起動。
 */
export function recordRequest(status: number): void {
  try {
    const now = Date.now();
    ring.push({ ts: now, status });

    // 直近 WINDOW_MS 以内のレコードだけ残す (FIFO で古いものを drop)
    while (ring.length > 0 && ring[0].ts < now - WINDOW_MS) {
      ring.shift();
    }

    if (ring.length < MIN_SAMPLES) return;

    const errs = ring.filter((r) => r.status >= 500).length;
    const rate = errs / ring.length;

    if (rate > ERROR_RATE_THRESHOLD && now - lastAlertTs > ALERT_SUPPRESSION_MS) {
      lastAlertTs = now;
      // fire-and-forget。失敗しても本流に影響させない
      void sendSlackAlert(rate, errs, ring.length);
    }
  } catch (err) {
    // monitor 自身の例外でリクエスト処理に影響を与えないよう全握り
    console.error("[health-monitor] recordRequest failed:", err);
  }
}

async function sendSlackAlert(
  rate: number,
  errs: number,
  total: number,
): Promise<void> {
  if (!SLACK_URL) {
    // env 未設定 → no-op
    return;
  }

  const text =
    `🚨 Insulia 5xx率 alert: ${(rate * 100).toFixed(2)}% ` +
    `(${errs}/${total} 件 直近${Math.round(WINDOW_MS / 1000)}秒)`;

  try {
    const res = await fetch(SLACK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(
        `[health-monitor] slack response not ok: ${res.status} ${res.statusText}`,
      );
    }
  } catch (err) {
    console.error("[health-monitor] slack send failed:", err);
  }
}

/**
 * Express middleware factory。
 *
 * 使い方:
 *   import { healthMonitorMiddleware } from "./health-monitor";
 *   app.use(healthMonitorMiddleware());
 *
 * res.on("finish") に hook するため、後段の error handler / route の status を全て拾える。
 */
export function healthMonitorMiddleware() {
  return function healthMonitor(
    _req: unknown,
    res: { on: (event: string, listener: () => void) => void; statusCode: number },
    next: () => void,
  ): void {
    res.on("finish", () => {
      recordRequest(res.statusCode);
    });
    next();
  };
}

/**
 * テスト・診断用: 現在の集計状態を返す。
 */
export function getHealthSnapshot(): {
  windowMs: number;
  sampleCount: number;
  errorCount: number;
  errorRate: number;
  slackConfigured: boolean;
  lastAlertTs: number;
} {
  const now = Date.now();
  const live = ring.filter((r) => r.ts >= now - WINDOW_MS);
  const errs = live.filter((r) => r.status >= 500).length;
  return {
    windowMs: WINDOW_MS,
    sampleCount: live.length,
    errorCount: errs,
    errorRate: live.length > 0 ? errs / live.length : 0,
    slackConfigured: Boolean(SLACK_URL),
    lastAlertTs,
  };
}
