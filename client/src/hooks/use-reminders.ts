import { useCallback, useEffect, useRef, useState } from "react";
import { native } from "@native";
import type { ReminderPermission, ReminderSetting, ReminderSlotId } from "@/features/native/contract";
import { safeParseLocalStorage, safeSetLocalStorage } from "@/lib/storage-utils";

/**
 * use-reminders —— 記録リマインダー (ローカル通知) の設定と OS 登録の同期
 *
 * ============================================================================
 * 設計方針
 * ============================================================================
 * - 設定の正は localStorage。サーバに持たせない。
 *   通知は端末ローカルの機能であり、複数端末で同じ時刻に鳴ってほしいとは
 *   限らない。またサーバに持つと「通知時刻」という生活パターンの推測材料を
 *   要配慮個人情報と同じ DB に増やすことになるため、意図的に持たない。
 *
 * - 既定は全て OFF。医療系アプリで、インストール直後から勝手に通知を出す
 *   のは筋が悪い。利用者が明示的に ON にしたものだけ鳴らす。
 *
 * - 設定を変えたら即 native.reminders.sync() を呼び、OS 側を設定に一致させる。
 *   「保存ボタンを押し忘れたので鳴らない」を作らない。
 * ============================================================================
 */

const STORAGE_KEY = "reminderSettings";

/** 既定の時刻。日本の一般的な食事時間に合わせた初期値 (利用者が変更できる)。 */
export const DEFAULT_REMINDERS: ReminderSetting[] = [
  { slotId: "Breakfast", enabled: false, hour: 7, minute: 30 },
  { slotId: "Lunch", enabled: false, hour: 12, minute: 0 },
  { slotId: "Dinner", enabled: false, hour: 18, minute: 30 },
  { slotId: "Bedtime", enabled: false, hour: 22, minute: 0 },
];

export const REMINDER_LABELS: Record<ReminderSlotId, string> = {
  Breakfast: "朝",
  Lunch: "昼",
  Dinner: "夕",
  Bedtime: "眠前",
};

const VALID_SLOT_IDS: ReminderSlotId[] = ["Breakfast", "Lunch", "Dinner", "Bedtime"];

/**
 * localStorage の値を検証して正規化する。
 *
 * 利用者が devtools で壊した / 旧バージョンの形が残っている場合でも、
 * 不正な hour で schedule を呼ぶと OS 側が例外を投げる。ここで必ず
 * DEFAULT_REMINDERS の形に畳んでから使う。
 */
function normalize(raw: unknown): ReminderSetting[] {
  if (!Array.isArray(raw)) return DEFAULT_REMINDERS;

  return DEFAULT_REMINDERS.map((fallback) => {
    const found = raw.find(
      (r): r is Record<string, unknown> =>
        typeof r === "object" && r !== null && (r as Record<string, unknown>).slotId === fallback.slotId,
    );
    if (!found) return fallback;

    const hour = Number(found.hour);
    const minute = Number(found.minute);

    return {
      slotId: fallback.slotId,
      enabled: found.enabled === true,
      hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback.hour,
      minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : fallback.minute,
    };
  });
}

export interface UseRemindersResult {
  /** このビルドでリマインダーが使えるか。false のとき UI は何も描画しない */
  isSupported: boolean;
  settings: ReminderSetting[];
  permission: ReminderPermission;
  /** 権限リクエスト中 / 同期中 */
  isBusy: boolean;
  /** OS の通知許可を求める。granted になったら現在の設定を登録する */
  requestPermission: () => Promise<void>;
  /** 1 タイミング分の設定を更新して即座に OS へ反映する */
  updateSlot: (slotId: ReminderSlotId, patch: Partial<Omit<ReminderSetting, "slotId">>) => void;
}

export function useReminders(): UseRemindersResult {
  const isSupported = native.reminders.isSupported;

  const [settings, setSettings] = useState<ReminderSetting[]>(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState<ReminderPermission>(
    isSupported ? "prompt" : "unsupported",
  );
  const [isBusy, setIsBusy] = useState(false);

  // 初回ロードが終わるまで sync を走らせないためのフラグ。
  // これが無いと、localStorage を読む前の DEFAULT (全 OFF) で
  // OS 側の登録を消してしまう。
  const hydrated = useRef(false);

  useEffect(() => {
    if (!isSupported) return;

    let canceled = false;

    const stored = normalize(safeParseLocalStorage<unknown>(STORAGE_KEY, null));

    void (async () => {
      const current = await native.reminders.checkPermission();
      if (canceled) return;

      setSettings(stored);
      setPermission(current);
      hydrated.current = true;

      // 端末側の登録がアプリ再インストール等で消えている可能性があるため、
      // 許可済みなら起動時に一度そろえ直す。
      if (current === "granted") {
        await native.reminders.sync(stored);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return;

    setIsBusy(true);
    try {
      const result = await native.reminders.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await native.reminders.sync(settings);
      }
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, settings]);

  const updateSlot = useCallback(
    (slotId: ReminderSlotId, patch: Partial<Omit<ReminderSetting, "slotId">>) => {
      if (!hydrated.current && isSupported) return;

      setSettings((prev) => {
        const next = prev.map((s) => (s.slotId === slotId ? { ...s, ...patch } : s));
        safeSetLocalStorage(STORAGE_KEY, next);
        if (isSupported && permission === "granted") {
          void native.reminders.sync(next);
        }
        return next;
      });
    },
    [isSupported, permission],
  );

  return { isSupported, settings, permission, isBusy, requestPermission, updateSlot };
}

/** "7:30" のような表示用文字列にする。 */
export function formatReminderTime(setting: ReminderSetting): string {
  return `${String(setting.hour).padStart(2, "0")}:${String(setting.minute).padStart(2, "0")}`;
}

export { VALID_SLOT_IDS };
