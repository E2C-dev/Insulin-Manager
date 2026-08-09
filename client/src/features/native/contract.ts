/**
 * client/src/features/native/contract.ts
 *
 * ============================================================================
 * なぜこのモジュールがあるか (App Store Review Guideline 4.2)
 * ============================================================================
 * 4.2 は「ウェブサイトを再パッケージしただけのアプリ」を認めていない。
 * インスリアの iOS 版は Capacitor で Web 実装を包む構成のため、
 * 「そのプラットフォームでしかできないこと」を実機能として持つ必要がある。
 *
 * 初版で載せるネイティブ機能は 2 つ:
 *   1. 記録リマインダー (ローカル通知) … 記録の継続率にも効く本質機能
 *   2. 生体認証によるアプリロック    … 要配慮個人情報を扱う以上、自然な保護
 *
 * ★ Capacitor プラグインは Web ビルドに持ち込まない。
 *   vite.config.ts の resolve.alias が `@native` の解決先を
 *   ビルド時に web.ts / ios.ts へ切り替える (実行時分岐ではない)。
 *   これは @dose-panel と同じ手法だが、目的が異なる:
 *     - @dose-panel … 1.4.2 対策 (算出コードを iOS に *入れない*)
 *     - @native     … Capacitor を Web に *入れない* (bundle 肥大と
 *                     ブラウザで動かない API の混入を防ぐ)
 *
 * このファイルは **型だけ** を持つ (TypeScript の型は emit 時に完全に消える)。
 * 実行時コードを絶対に足さないこと。足すと両ビルドに混入する。
 * ============================================================================
 */

/** 記録リマインダーの対象タイミング。lib/types.ts の InsulinTimeSlot に対応する。 */
export type ReminderSlotId = "Breakfast" | "Lunch" | "Dinner" | "Bedtime";

/** 1 タイミング分のリマインダー設定 (localStorage に永続化される形)。 */
export interface ReminderSetting {
  slotId: ReminderSlotId;
  /** 通知を出すか */
  enabled: boolean;
  /** 24 時間表記 (0-23) */
  hour: number;
  /** 分 (0-59) */
  minute: number;
}

/**
 * OS の通知許可の状態。
 * Capacitor の PermissionState をそのまま使わず自前の型にしているのは、
 * web.ts 側が Capacitor に依存しないようにするため。
 */
export type ReminderPermission = "granted" | "denied" | "prompt" | "unsupported";

/** 生体認証の種類。UI の文言 ("Face ID を使う" 等) を出し分けるために使う。 */
export type BiometryKind = "faceId" | "touchId" | "other" | "none";

/** 端末が生体認証を使える状態かどうか。 */
export interface BiometryAvailability {
  isAvailable: boolean;
  kind: BiometryKind;
  /** 使えない場合の理由 (UI にそのまま出す想定の日本語)。使える場合は null。 */
  reason: string | null;
}

/** 認証結果。例外ではなく値で返す (呼び出し側の分岐を単純にするため)。 */
export interface AuthResult {
  ok: boolean;
  /** 利用者自身がキャンセルしたか (再試行の導線を出すかの判断に使う) */
  canceled: boolean;
  /** 失敗理由 (日本語)。成功時は null。 */
  message: string | null;
}

/**
 * 記録リマインダー (ローカル通知)。
 *
 * sync() は「いま有効な設定を渡すと、OS 側の登録をその状態に一致させる」
 * 冪等な API にしてある。差分計算を呼び出し側に持たせると、設定変更と
 * OS 状態がズレたときに復旧できなくなるため。
 */
export interface ReminderService {
  /** このビルドでリマインダーが使えるか (web ビルドは常に false) */
  readonly isSupported: boolean;
  /** 現在の通知許可を問い合わせる (ダイアログは出さない) */
  checkPermission(): Promise<ReminderPermission>;
  /** 通知許可をリクエストする (OS ダイアログが出る) */
  requestPermission(): Promise<ReminderPermission>;
  /** 既存の登録を全消しして、enabled な設定だけを登録し直す */
  sync(settings: ReminderSetting[]): Promise<void>;
  /** 登録を全消しする (リマインダー機能を丸ごと OFF にしたとき) */
  cancelAll(): Promise<void>;
}

/**
 * 生体認証によるアプリロック。
 *
 * onAppStateChange は「バックグラウンドに回ったら再ロックする」ために要る。
 * Capacitor の App プラグインに直接依存させると web.ts が壊れるので、
 * ここで抽象化して購読解除関数を返す形に統一している。
 */
export interface AppLockService {
  /** このビルドでアプリロックが使えるか (web ビルドは常に false) */
  readonly isSupported: boolean;
  /** 端末側の生体認証の可否を問い合わせる */
  checkAvailability(): Promise<BiometryAvailability>;
  /** 生体認証を実行する。reason は OS のダイアログに表示される */
  authenticate(reason: string): Promise<AuthResult>;
  /**
   * アプリのフォアグラウンド / バックグラウンド遷移を購読する。
   * @returns 購読解除関数
   */
  onAppStateChange(handler: (isActive: boolean) => void): () => void;
}

/** `@native` が公開するもの。web.ts / ios.ts は必ずこの形を満たす。 */
export interface NativeBridge {
  /** どちらのビルドで動いているか (デバッグ表示・テスト用) */
  readonly platform: "ios" | "web";
  readonly reminders: ReminderService;
  readonly appLock: AppLockService;
}
