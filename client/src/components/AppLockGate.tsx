import { createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Lock, ShieldAlert } from "lucide-react";
import { useAppLock, type UseAppLockResult } from "@/hooks/use-app-lock";

/**
 * AppLockGate —— 生体認証によるアプリロックの表示層
 *
 * ============================================================================
 * なぜ Context にしているか
 * ============================================================================
 * ロック状態を使う場所が 2 つある:
 *   1. このゲート自身 (ロック画面を出すかどうか)
 *   2. SecuritySettings のスイッチ (ON/OFF の切り替え)
 * それぞれが useAppLock() を独立に呼ぶと state が分かれ、設定で ON にしても
 * ゲート側は「無効のまま」と思い込んでバックグラウンド復帰時にロックしない。
 * 単一の状態を Context で配る。
 *
 * Web ビルドでは isSupported=false になり、children をそのまま通す。
 * ============================================================================
 */

const AppLockContext = createContext<UseAppLockResult | null>(null);

/**
 * ロック設定を読み書きするためのフック。
 * AppLockGate の内側でのみ使える。
 */
export function useAppLockSettings(): UseAppLockResult {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error("useAppLockSettings must be used within <AppLockGate>");
  }
  return ctx;
}

export function AppLockGate({ children }: { children: ReactNode }) {
  const lock = useAppLock();

  return (
    <AppLockContext.Provider value={lock}>
      {lock.isLocked ? <LockScreen lock={lock} /> : children}
    </AppLockContext.Provider>
  );
}

/**
 * ロック画面。
 *
 * ★ ここに記録内容を一切表示しないこと。ロックの目的は
 *   「端末を他人に渡したときに要配慮個人情報を見せない」ことなので、
 *   直近の血糖値やユーザー名をここに出すと機能が意味を失う。
 */
function LockScreen({ lock }: { lock: UseAppLockResult }) {
  const unavailable = lock.availability && !lock.availability.isAvailable;

  return (
    <div
      className="min-h-[100svh] flex items-center justify-center p-6 bg-background"
      data-testid="app-lock-screen"
    >
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-5">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">インスリアはロックされています</h1>
          <p className="text-sm text-muted-foreground">
            記録を表示するには本人確認が必要です。
          </p>
        </div>

        {lock.lastError && (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-left"
            data-testid="app-lock-error"
          >
            <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{lock.lastError}</p>
          </div>
        )}

        {unavailable && lock.availability?.reason && (
          <p className="text-sm text-muted-foreground">{lock.availability.reason}</p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={() => void lock.unlock()}
          disabled={lock.isAuthenticating}
          data-testid="app-lock-unlock"
        >
          {lock.isAuthenticating ? "確認中..." : "ロックを解除する"}
        </Button>
      </div>
    </div>
  );
}
