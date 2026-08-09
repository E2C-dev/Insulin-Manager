import { useCallback, useEffect, useRef, useState } from "react";
import { native } from "@native";
import type { AuthResult, BiometryAvailability } from "@/features/native/contract";
import { safeGetLocalStorage, safeSetLocalStorageString } from "@/lib/storage-utils";

/**
 * use-app-lock —— 生体認証によるアプリロック
 *
 * ============================================================================
 * 設計方針
 * ============================================================================
 * - ロックはこの端末の中だけの機能。サーバ側のセッションには手を触れない。
 *   ロック中でもログインは維持され、解除すれば元の画面に戻る。
 *   (ロック＝ログアウトにすると、解除のたびに再ログインが要り実用に耐えない)
 *
 * - 「有効化するとき」に必ず 1 回認証させる。認証できない端末で ON にすると
 *   次回起動時に自分の記録へ二度と入れなくなるため。
 *
 * - 解除手段には端末パスコードを併用する (ios.ts の allowDeviceCredential)。
 *   指の怪我・マスク等で生体認証が通らない状況で締め出さないため。
 *
 * ★ iOS 固有の罠:
 *   Face ID / Touch ID のシステムダイアログが出ると、アプリは
 *   willResignActive を受け取る (= appStateChange の isActive=false)。
 *   これを素直に「バックグラウンドに回った」と解釈して再ロックすると、
 *   認証 → 再ロック → 認証 … の無限ループになる。
 *   認証中は isAuthenticating で状態変化を無視することで塞いでいる。
 * ============================================================================
 */

const STORAGE_KEY = "appLockEnabled";
const AUTH_REASON = "インスリアのロックを解除します";

export interface UseAppLockResult {
  /** このビルドでアプリロックが使えるか (web ビルドは false) */
  isSupported: boolean;
  /** 端末の生体認証の可否。判定前は null */
  availability: BiometryAvailability | null;
  /** 利用者が設定でロックを ON にしているか */
  isEnabled: boolean;
  /** いまロック画面を出すべきか */
  isLocked: boolean;
  /** 認証ダイアログを出している最中か */
  isAuthenticating: boolean;
  /** 直近の認証失敗メッセージ (キャンセル時は null) */
  lastError: string | null;
  /** ロック解除を試みる */
  unlock: () => Promise<void>;
  /** ロック設定を切り替える。ON にする場合は認証に成功したときだけ有効になる */
  setEnabled: (enabled: boolean) => Promise<AuthResult>;
}

export function useAppLock(): UseAppLockResult {
  const isSupported = native.appLock.isSupported;

  const [availability, setAvailability] = useState<BiometryAvailability | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // appStateChange ハンドラから参照するため ref でも保持する。
  // ハンドラは購読時のクロージャを持ち続けるので state だけだと古い値を見る。
  const isAuthenticatingRef = useRef(false);
  const isEnabledRef = useRef(false);

  const setAuthenticating = useCallback((value: boolean) => {
    isAuthenticatingRef.current = value;
    setIsAuthenticating(value);
  }, []);

  // 初期化: 設定の読み込みと、有効なら初回ロック
  useEffect(() => {
    if (!isSupported) return;

    let canceled = false;

    void (async () => {
      const info = await native.appLock.checkAvailability();
      if (canceled) return;

      const stored = safeGetLocalStorage(STORAGE_KEY) === "true";

      // 端末側で生体認証が使えなくなった (登録を消した等) 場合、
      // 設定が ON のままだと解除不能になる。ここで強制的に OFF に落とす。
      const effective = stored && info.isAvailable;
      if (stored && !info.isAvailable) {
        safeSetLocalStorageString(STORAGE_KEY, "false");
      }

      setAvailability(info);
      setIsEnabled(effective);
      isEnabledRef.current = effective;
      setIsLocked(effective);
    })();

    return () => {
      canceled = true;
    };
  }, [isSupported]);

  // バックグラウンドに回ったら再ロックする
  useEffect(() => {
    if (!isSupported) return;

    const unsubscribe = native.appLock.onAppStateChange((isActive) => {
      // ★ 認証ダイアログ表示中の willResignActive を無視する (上記の罠)
      if (isAuthenticatingRef.current) return;
      if (!isEnabledRef.current) return;

      if (!isActive) {
        setIsLocked(true);
      }
    });

    return unsubscribe;
  }, [isSupported]);

  const unlock = useCallback(async () => {
    if (!isSupported) return;

    setAuthenticating(true);
    setLastError(null);
    try {
      const result = await native.appLock.authenticate(AUTH_REASON);
      if (result.ok) {
        setIsLocked(false);
      } else if (!result.canceled) {
        setLastError(result.message);
      }
    } finally {
      setAuthenticating(false);
    }
  }, [isSupported, setAuthenticating]);

  const setEnabled = useCallback(
    async (enabled: boolean): Promise<AuthResult> => {
      if (!isSupported) {
        return { ok: false, canceled: false, message: "この環境では利用できません。" };
      }

      if (!enabled) {
        // OFF にするのは無条件で許す。既にロック解除済みの状態
        // (= 本人確認が済んでいる画面) からしか操作できないため。
        safeSetLocalStorageString(STORAGE_KEY, "false");
        setIsEnabled(false);
        isEnabledRef.current = false;
        setIsLocked(false);
        return { ok: true, canceled: false, message: null };
      }

      // ON にするときは必ず 1 回認証を通す。
      // 通らない端末で ON にすると次回起動時に締め出される。
      setAuthenticating(true);
      try {
        const result = await native.appLock.authenticate(
          "アプリロックを有効にするため本人確認を行います",
        );
        if (result.ok) {
          safeSetLocalStorageString(STORAGE_KEY, "true");
          setIsEnabled(true);
          isEnabledRef.current = true;
        }
        return result;
      } finally {
        setAuthenticating(false);
      }
    },
    [isSupported, setAuthenticating],
  );

  return {
    isSupported,
    availability,
    isEnabled,
    isLocked,
    isAuthenticating,
    lastError,
    unlock,
    setEnabled,
  };
}
