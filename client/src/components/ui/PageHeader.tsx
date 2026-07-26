import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * client/src/components/ui/PageHeader.tsx (作業5-3)
 *
 * Entry / Logbook / AdjustmentRules / Dashboard / SecuritySettings で
 * それぞれ微妙に異なるマークアップで実装されていたページ見出しUIを統一する。
 *
 * 対応パターン:
 * - Entry.tsx      : 戻るボタン + タイトル + サブタイトル (onBack)
 * - Logbook.tsx     : タイトル + サブタイトル + 右側アクションボタン (action)
 * - AdjustmentRules : 同上 (action に Dialog ごと渡せる。Portal なので位置は影響しない)
 * - Dashboard.tsx   : 見出し上の一言 (挨拶) + 小さめタイトル、サブタイトルなし (eyebrow + size="compact")
 * - SecuritySettings: アイコン + 小さめタイトル、サブタイトルなし (icon + size="compact")
 */

export interface PageHeaderProps {
  /** メインの見出し文言 */
  title: ReactNode;
  /** 見出し下の説明文 (Entry/Logbook/AdjustmentRules) */
  subtitle?: ReactNode;
  /** 見出し上の小さな一言 (Dashboardの挨拶など) */
  eyebrow?: ReactNode;
  /** 見出し左に添えるアイコン (SecuritySettings) */
  icon?: LucideIcon;
  /** 指定すると見出し左に戻るボタンを表示する (Entry) */
  onBack?: () => void;
  backTestId?: string;
  /** 見出し右側に配置するアクション (新規作成ボタン等)。Dialog をそのまま渡しても Portal のため表示位置は崩れない */
  action?: ReactNode;
  /** default = text-2xl (Entry/Logbook/AdjustmentRules) / compact = text-lg (Dashboard/SecuritySettings) */
  size?: "default" | "compact";
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  onBack,
  backTestId = "button-back",
  action,
  size = "default",
  className,
}: PageHeaderProps) {
  const titleSizeClass = size === "compact" ? "text-lg" : "text-2xl";

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-4 min-w-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            data-testid={backTestId}
            onClick={onBack}
            className="p-2.5 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs text-muted-foreground">{eyebrow}</p>}
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-primary shrink-0" />}
            <h1 className={cn(titleSizeClass, "font-bold tracking-tight", subtitle && "mb-1")}>
              {title}
            </h1>
          </div>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
