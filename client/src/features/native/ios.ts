import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from "@aparajita/capacitor-biometric-auth";
import type {
  AppLockService,
  AuthResult,
  BiometryAvailability,
  BiometryKind,
  NativeBridge,
  ReminderPermission,
  ReminderService,
  ReminderSetting,
  ReminderSlotId,
} from "./contract";

/**
 * client/src/features/native/ios.ts —— iOS (Capacitor) 実装
 *
 * ============================================================================
 * このファイルは iOS ビルドにしか入らない
 * ============================================================================
 * `npm run build:ios` (VITE_BUILD_TARGET=ios) のときだけ `@native` として
 * 解決される。Web ビルドのモジュールグラフには Capacitor が一切入らない。
 *
 * 例外方針: Capacitor プラグインは端末状態によって容赦なく reject する
 * (通知が拒否されている / 生体認証が未登録 / パスコード未設定 など)。
 * それを UI に投げ返すと ErrorBoundary が反応して画面が落ちるため、
 * ここで全て捕まえて contract.ts の戻り値型に畳む。
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// 記録リマインダー (ローカル通知)
// ---------------------------------------------------------------------------

/**
 * 通知 ID は Int32 の固定値をタイミングごとに割り当てる。
 * 連番を動的採番すると、設定変更のたびに古い通知が消し残る。
 * 「固定 ID を上書き / 削除する」方式なら OS 側の状態が必ず設定と一致する。
 */
const NOTIFICATION_IDS: Record<ReminderSlotId, number> = {
  Breakfast: 1001,
  Lunch: 1002,
  Dinner: 1003,
  Bedtime: 1004,
};

const NOTIFICATION_BODY: Record<ReminderSlotId, string> = {
  Breakfast: "朝の血糖値とインスリンを記録しましょう。",
  Lunch: "昼の血糖値とインスリンを記録しましょう。",
  Dinner: "夕の血糖値とインスリンを記録しましょう。",
  Bedtime: "眠前の血糖値とインスリンを記録しましょう。",
};

/**
 * Capacitor の PermissionState を contract.ts の型に畳む。
 * "prompt-with-rationale" は Android 用の値だが、型上は来うるので
 * 利用者に許可を求める余地がある状態として "prompt" に寄せる。
 */
function toReminderPermission(state: string): ReminderPermission {
  switch (state) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    case "prompt":
    case "prompt-with-rationale":
      return "prompt";
    default:
      return "unsupported";
  }
}

const reminders: ReminderService = {
  isSupported: true,

  async checkPermission(): Promise<ReminderPermission> {
    try {
      const { display } = await LocalNotifications.checkPermissions();
      return toReminderPermission(display);
    } catch (err) {
      console.warn("[native] checkPermissions failed:", err);
      return "unsupported";
    }
  },

  async requestPermission(): Promise<ReminderPermission> {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return toReminderPermission(display);
    } catch (err) {
      console.warn("[native] requestPermissions failed:", err);
      return "unsupported";
    }
  },

  /**
   * 「全消し → enabled なものだけ再登録」で OS 側を設定に一致させる。
   *
   * 差分更新にしないのは、アプリ側の設定と OS 側の登録がズレたときに
   * 復旧できなくなるため。リマインダーは高々 4 件なので、毎回作り直しても
   * コストは無視できる。
   */
  async sync(settings: ReminderSetting[]): Promise<void> {
    try {
      await this.cancelAll();

      const enabled = settings.filter((s) => s.enabled);
      if (enabled.length === 0) return;

      await LocalNotifications.schedule({
        notifications: enabled.map((s) => ({
          id: NOTIFICATION_IDS[s.slotId],
          title: "インスリア",
          body: NOTIFICATION_BODY[s.slotId],
          schedule: {
            // hour/minute のみを指定し repeats:true にすると毎日その時刻に鳴る。
            on: { hour: s.hour, minute: s.minute },
            repeats: true,
            allowWhileIdle: true,
          },
        })),
      });
    } catch (err) {
      // 通知が拒否されている状態で schedule すると reject する。
      // 設定 UI 側は許可状態を別途表示しているので、ここでは黙って諦める。
      console.warn("[native] schedule failed:", err);
    }
  },

  async cancelAll(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      const ours = pending.notifications.filter((n) =>
        Object.values(NOTIFICATION_IDS).includes(n.id),
      );
      if (ours.length > 0) {
        await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      }
    } catch (err) {
      console.warn("[native] cancel failed:", err);
    }
  },
};

// ---------------------------------------------------------------------------
// 生体認証によるアプリロック
// ---------------------------------------------------------------------------

function toBiometryKind(type: BiometryType): BiometryKind {
  switch (type) {
    case BiometryType.faceId:
      return "faceId";
    case BiometryType.touchId:
      return "touchId";
    case BiometryType.none:
      return "none";
    default:
      // Android 系の値。iOS ビルドでは到達しない想定だが、
      // 型の網羅性のために "other" へ寄せる。
      return "other";
  }
}

/**
 * プラグインが返す reason は英語のシステムメッセージなので、
 * 利用者に出す日本語へ翻訳する。判別できないものは汎用文言にする。
 */
function describeUnavailable(code: BiometryErrorType): string {
  switch (code) {
    case BiometryErrorType.biometryNotEnrolled:
      return "この端末にFace ID・Touch IDが登録されていません。iOSの「設定」から登録してください。";
    case BiometryErrorType.biometryNotAvailable:
      return "この端末では生体認証を利用できません。";
    case BiometryErrorType.passcodeNotSet:
      return "端末にパスコードが設定されていません。iOSの「設定」から設定してください。";
    case BiometryErrorType.biometryLockout:
      return "認証の失敗が続いたため、生体認証が一時的にロックされています。端末のパスコードで解除してください。";
    default:
      return "生体認証を利用できません。";
  }
}

/** authenticate() の reject を AuthResult に畳む。 */
function toAuthResult(err: unknown): AuthResult {
  if (err instanceof BiometryError) {
    const canceled =
      err.code === BiometryErrorType.userCancel ||
      err.code === BiometryErrorType.systemCancel ||
      err.code === BiometryErrorType.appCancel;

    if (canceled) {
      return { ok: false, canceled: true, message: null };
    }
    return { ok: false, canceled: false, message: describeUnavailable(err.code) };
  }

  console.warn("[native] authenticate failed:", err);
  return { ok: false, canceled: false, message: "認証に失敗しました。もう一度お試しください。" };
}

const appLock: AppLockService = {
  isSupported: true,

  async checkAvailability(): Promise<BiometryAvailability> {
    try {
      const info = await BiometricAuth.checkBiometry();
      return {
        isAvailable: info.isAvailable,
        kind: toBiometryKind(info.biometryType),
        reason: info.isAvailable ? null : describeUnavailable(info.code),
      };
    } catch (err) {
      console.warn("[native] checkBiometry failed:", err);
      return {
        isAvailable: false,
        kind: "none",
        reason: "生体認証の状態を確認できませんでした。",
      };
    }
  },

  async authenticate(reason: string): Promise<AuthResult> {
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: "キャンセル",
        // 生体認証が使えない / 失敗した場合に端末パスコードで解錠できるようにする。
        // これが無いと、指を怪我した等の理由で自分の記録に一切アクセスできなくなる。
        allowDeviceCredential: true,
        iosFallbackTitle: "パスコードを使う",
      });
      return { ok: true, canceled: false, message: null };
    } catch (err) {
      return toAuthResult(err);
    }
  },

  onAppStateChange(handler: (isActive: boolean) => void): () => void {
    // addListener は Promise を返す。解除関数は同期で返す必要があるため、
    // handle を受け取ってから remove する形にする。
    const pending = App.addListener("appStateChange", ({ isActive }) => {
      handler(isActive);
    });

    let removed = false;
    void pending.catch((err) => {
      console.warn("[native] appStateChange listener failed:", err);
    });

    return () => {
      if (removed) return;
      removed = true;
      void pending.then((handle) => handle.remove()).catch(() => {
        // リスナ登録自体が失敗していた場合。解除するものが無いので無視する。
      });
    };
  },
};

export const native: NativeBridge = {
  platform: "ios",
  reminders,
  appLock,
};
