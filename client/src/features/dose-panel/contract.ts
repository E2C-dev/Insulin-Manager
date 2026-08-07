import type { ReactNode } from "react";

/**
 * client/src/features/dose-panel/contract.ts
 *
 * ============================================================================
 * なぜこのモジュールがあるか (App Store Review Guideline 1.4.2)
 * ============================================================================
 * 1.4.2 は「薬剤の投与量計算機」を、製薬企業・病院・大学・保険会社・薬局等の
 * 承認主体が提供するもの、または規制当局の承認を受けたものに限定している。
 * 個人開発者はいずれにも該当しないため、「血糖値から投与量を算出して提示する」
 * 機能を含んだままでは iOS 版の公開を維持できない。
 *
 * したがって記録画面 (pages/Entry.tsx) の「主治医指示ルールに基づく参考値」
 * パネルは、
 *   - Web 版 (VITE_BUILD_TARGET=web) … 従来どおり算出して提示する  → ./web.tsx
 *   - iOS 版 (VITE_BUILD_TARGET=ios) … 転記済み指示票を静的表示のみ → ./ios.tsx
 * の 2 実装に分かれる。
 *
 * ★ 実行時フラグでの出し分けは禁止 (Guideline 2.3.1 = 審査時と異なる挙動)。
 *   vite.config.ts の resolve.alias が `@dose-panel` の解決先をビルド時に
 *   切り替えるため、iOS ビルドのモジュールグラフには web.tsx も
 *   shared/adjustmentRuleEngine.ts も一切入らない。
 *
 * このファイルは **型だけ** を持つ (TypeScript の型は emit 時に完全に消える)。
 * 実行時コードを絶対に足さないこと。足すと両ビルドに混入する。
 * ============================================================================
 */

/** Entry.tsx から dose panel 実装へ渡す入力。両実装で共通。 */
export interface DoseGuidanceInput {
  /** 記録対象日 ("YYYY-MM-DD") */
  date: string;
  /** 測定タイミング (TIME_SLOT_OPTIONS の value) */
  timeSlot: string;
  /** いま入力中の血糖値 (raw string)。iOS 実装はこの値を一切参照しない。 */
  glucoseLevel: string;
  /** いま入力中のインスリン量 (raw string) */
  insulinUnits: string;
  /** 投与タイミングの日本語ラベル ("朝食" 等) */
  timingLabel: string | null;
  /** 当該タイミングの基礎投与量 (血糖値に依存しない定数) */
  timingBaseAmount: number | null;
  /** 基礎投与量の由来プリセット id */
  resolvedPresetIdForTiming: string | null;
  /** ユーザーが明示選択したプリセット id */
  selectedPresetId: string | null;
  presetsLoading: boolean;
  presetsError: boolean;
  /** 編集モードの prefill 中か */
  isEditPrefillLoading: boolean;
  /** 保存処理中か */
  isSaving: boolean;
  /**
   * 「参考値をそのまま入力欄へ反映した」直後の状態か。
   * state 自体は Entry.tsx が持つ (手入力・プリセット選択・リセット・保存後の
   * 解除タイミングが Entry 側のハンドラに紐づくため)。
   */
  referenceApplied: boolean;
  /**
   * インスリン入力欄へ値を入れる唯一の経路。
   * fromReference=true のときだけ referenceApplied が立ち、
   * サーバ安全ネットへ渡す autoCalculated の判定対象になる。
   */
  applyUnits: (units: string, fromReference: boolean) => void;
}

/** dose panel 実装が Entry.tsx へ返すもの。 */
export interface DoseGuidance {
  /** ルール・血糖値・プリセットの取得が完了していない (fail-closed で保存を止める) */
  isRuleEvaluationLoading: boolean;
  /** 取得に失敗した (fail-closed で保存を止める) */
  hasEvaluationError: boolean;
  /**
   * 「参考値を反映したまま手を加えていない」状態か。
   * server/insulinDoseSafetyNet.ts の再計算チェック (autoCalculated) は
   * この状態のときだけ意味を持つ。iOS 実装は常に false を返す。
   */
  isReferenceValueIntact: boolean;
  /** Step2「現在の設定情報」内に差し込むパネル */
  timingRulesPanel: ReactNode;
  /** Step3 の測定値入力の直前に差し込むパネル (免責の常設表示を含む) */
  dosePanel: ReactNode;
  /** インスリン入力欄直下のヒント */
  insulinFieldHint: ReactNode;
}

export type UseDoseGuidance = (input: DoseGuidanceInput) => DoseGuidance;

/**
 * 投与量まわりの「説明コピー」もビルドターゲットで差し替える。
 *
 * 実装から算出を外しても、チュートリアルや LP が「血糖値に応じた参考値を
 * 出す」と説明していれば審査官はそれを機能説明として読む (1.4.2 の疑いを
 * 自ら招く / 2.3.1 の観点でも不整合)。実装とコピーを同じ経路で分離する。
 *
 *   web → ./copy.web.ts (移設前の文言と 1 文字も違わない)
 *   ios → ./copy.ios.ts (指示票を表示するだけ、と一貫して説明する)
 */
export interface DoseCopy {
  /** TutorialModal Step3 の詳細 */
  tutorialEntryDetail: string;
  /** LP ヒーローの本文 (先頭フラグメント) */
  lpHeroBody: string;
  /** LP 機能カード「主治医指示ルールの転記」の本文 */
  lpRuleCardBody: string;
  /** LP 機能カード「調整ルール設定」の本文 */
  lpRuleFeatureBody: string;
  /** LP 免責リスト「インスリン投与量は…」の後半 */
  lpDoseDisclaimerTail: string;
}
