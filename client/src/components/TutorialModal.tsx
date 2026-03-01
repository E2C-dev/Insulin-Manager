import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Activity,
  PlusCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  headerBg: string;
  linkColor: string;
  stepLabel: string;
  title: string;
  description: string;
  detail: string;
  href: string;
  hrefLabel: string;
  isBonus: boolean;
}

const STEPS: Step[] = [
  {
    icon: Settings,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    headerBg: "bg-blue-50",
    linkColor: "text-blue-600",
    stepLabel: "Step 1",
    title: "インスリンを登録する",
    description: "まず、使用しているインスリンを登録しましょう。",
    detail:
      "右上の設定アイコン（⚙）→「治療設定」から、使用中のインスリンの種類とデフォルト投与量を登録できます。複数のインスリンを登録することも可能です。",
    href: "/settings",
    hrefLabel: "治療設定を開く",
    isBonus: false,
  },
  {
    icon: Activity,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    headerBg: "bg-purple-50",
    linkColor: "text-purple-600",
    stepLabel: "Step 2",
    title: "調整ルールを設定する",
    description: "血糖値に応じてインスリンをどう調整するかルールを登録します。",
    detail:
      "右上の設定アイコン（⚙）→「調整ルール」から、血糖値の高低に応じたインスリン増減ルールを設定できます。",
    href: "/adjustment-rules",
    hrefLabel: "調整ルールを開く",
    isBonus: false,
  },
  {
    icon: PlusCircle,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    headerBg: "bg-green-50",
    linkColor: "text-green-600",
    stepLabel: "Step 3",
    title: "毎日記録する",
    description:
      "インスリンを投与するタイミングで血糖値と投与量を記録します。",
    detail:
      "画面下中央の「＋」ボタンから入力できます。朝・昼・夕・眠前の4つのタイミングで記録でき、登録したルールに基づく調整提案も表示されます。",
    href: "/entry",
    hrefLabel: "入力画面を開く",
    isBonus: false,
  },
  {
    icon: FileText,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    headerBg: "bg-amber-50",
    linkColor: "text-amber-600",
    stepLabel: "おまけ",
    title: "PDFで出力して共有",
    description: "記録をPDFにまとめて、診察時に持参できます。",
    detail:
      "下の「ノート」タブから記録一覧を表示し、「PDFエクスポート」ボタンを押すと記録をPDFで保存できます。診察時に看護師さんや医師に見せましょう。",
    href: "/logbook",
    hrefLabel: "ノートを開く",
    isBonus: true,
  },
];

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [, navigate] = useLocation();

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const Icon = step.icon;

  function handleClose() {
    setStepIndex(0);
    onClose();
  }

  function handleNavigate() {
    navigate(step.href);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden gap-0 [&>button]:hidden">
        {/* カラーヘッダー */}
        <div className={cn("px-6 pt-6 pb-5", step.headerBg)}>
          <div className="flex items-center justify-between mb-4">
            {/* ステップドット */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === stepIndex
                      ? "w-6 bg-gray-700"
                      : i < stepIndex
                      ? "w-1.5 bg-gray-400"
                      : "w-1.5 bg-gray-300"
                  )}
                />
              ))}
            </div>
            {/* ステップバッジ */}
            <span
              className={cn(
                "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                step.isBonus
                  ? "bg-amber-100 text-amber-700"
                  : "bg-white/80 text-gray-600"
              )}
            >
              {step.stepLabel}
            </span>
          </div>

          {/* アイコン */}
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-3",
              step.iconBg
            )}
          >
            <Icon className={cn("w-6 h-6", step.iconColor)} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {step.title}
          </h2>
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* 本文 */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 leading-relaxed">{step.detail}</p>
          <button
            onClick={handleNavigate}
            className={cn(
              "mt-4 flex items-center gap-1 text-sm font-medium hover:underline",
              step.linkColor
            )}
          >
            {step.hrefLabel}
            <ChevronRight size={14} />
          </button>
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex gap-2 px-6 pb-6">
          {!isFirst ? (
            <Button
              variant="outline"
              onClick={() => setStepIndex((s) => s - 1)}
              className="flex-1"
            >
              <ChevronLeft size={16} className="mr-1" />
              戻る
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleClose}
              className="flex-1 text-muted-foreground"
            >
              スキップ
            </Button>
          )}
          {isLast ? (
            <Button onClick={handleClose} className="flex-1">
              始める
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((s) => s + 1)}
              className="flex-1"
            >
              次へ
              <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
