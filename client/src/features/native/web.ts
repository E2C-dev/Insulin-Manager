import type {
  AppLockService,
  AuthResult,
  BiometryAvailability,
  NativeBridge,
  ReminderPermission,
  ReminderService,
} from "./contract";

/**
 * client/src/features/native/web.ts —— Web ビルド用のスタブ
 *
 * ============================================================================
 * ここに Capacitor を import しないこと
 * ============================================================================
 * このファイルは `npm run build` (VITE_BUILD_TARGET 未設定) のときだけ
 * `@native` として解決される。Capacitor プラグインはブラウザ単体では
 * 動かない (LocalNotifications は "not implemented" を投げ、生体認証は
 * そもそも API が無い) ため、Web 版では機能ごと存在しない扱いにする。
 *
 * isSupported を false にしておけば、呼び出し側 (Settings / SecuritySettings)
 * が該当セクションを描画しない。つまり Web 利用者に「押しても動かない
 * スイッチ」を見せずに済む。
 *
 * 各メソッドは呼ばれない前提だが、万一呼ばれても例外を投げずに
 * 「使えない」を値で返す。UI が握りつぶす必要のある例外を増やさないため。
 * ============================================================================
 */

const reminders: ReminderService = {
  isSupported: false,

  async checkPermission(): Promise<ReminderPermission> {
    return "unsupported";
  },

  async requestPermission(): Promise<ReminderPermission> {
    return "unsupported";
  },

  async sync(): Promise<void> {
    // no-op: Web 版にリマインダーは無い
  },

  async cancelAll(): Promise<void> {
    // no-op
  },
};

const appLock: AppLockService = {
  isSupported: false,

  async checkAvailability(): Promise<BiometryAvailability> {
    return {
      isAvailable: false,
      kind: "none",
      reason: "生体認証はiOSアプリ版でのみご利用いただけます。",
    };
  },

  async authenticate(): Promise<AuthResult> {
    return {
      ok: false,
      canceled: false,
      message: "この環境では生体認証を利用できません。",
    };
  },

  onAppStateChange(): () => void {
    // Web では購読しない。呼び出し側の useEffect cleanup が壊れないよう
    // 何もしない解除関数を返す。
    return () => {};
  },
};

export const native: NativeBridge = {
  platform: "web",
  reminders,
  appLock,
};
