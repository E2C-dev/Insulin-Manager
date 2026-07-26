import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * client/src/hooks/use-api-error.ts (作業5-4)
 *
 * API呼び出し失敗時の「toast表示 + console.error ログ出力」を1箇所に統一する。
 * Login.tsx をはじめ、各ページの mutation onError で同じような
 * `console.error(...); toast({title, description, variant:"destructive"})`
 * が個別に書かれていたパターンを共通化する。
 */

interface ReportErrorOptions {
  /** トースト見出し (省略時は "エラー") */
  title?: string;
  /** error が Error インスタンスでない場合の代替メッセージ */
  fallbackMessage?: string;
  /** console.error に付けるプレフィックス (デバッグ用。省略時はメッセージのみログ出力) */
  logPrefix?: string;
}

export function useApiError() {
  const { toast } = useToast();

  const reportError = useCallback(
    (error: unknown, options: ReportErrorOptions = {}) => {
      const {
        title = "エラー",
        fallbackMessage = "予期しないエラーが発生しました",
        logPrefix,
      } = options;
      const message = error instanceof Error ? error.message : fallbackMessage;

      if (logPrefix) {
        console.error(`${logPrefix}:`, error);
      } else {
        console.error(message, error);
      }

      toast({ title, description: message, variant: "destructive" });
    },
    [toast]
  );

  return { reportError };
}
