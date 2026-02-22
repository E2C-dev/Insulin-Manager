import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  motion,
  useInView,
  useScroll,
  useMotionValue,
  animate,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import {
  Zap,
  BarChart2,
  BookOpen,
  Settings2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Syringe,
  Activity,
  FileText,
  ShieldCheck,
  Heart,
  Users,
  Star,
  Lock,
  UtensilsCrossed,
  Gauge,
  Stethoscope,
  Droplets,
  Twitter,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---- カウントアップアニメーション ----
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const count = useMotionValue(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, to, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString()),
    });
    return controls.stop;
  }, [inView, count, to]);

  return <span ref={ref}>{display}{suffix}</span>;
}

// ---- スクロールアニメーション共通ラッパー ----
type AnimationType = "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";

const animVariants: Record<AnimationType, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.8 } },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  },
  slideRight: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.88 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  },
};

function FadeInSection({
  children,
  delay = 0,
  className = "",
  type = "fadeUp",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  type?: AnimationType;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  const variants = animVariants[type];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = variants as any;
  const delayedVariants: Variants = {
    hidden: v.hidden,
    visible: {
      ...v.visible,
      transition: { ...(v.visible?.transition ?? {}), delay },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={delayedVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

// ---- 画像コンポーネント（fallback付き） ----
function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [error, setError] = useState(false);
  if (error) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}

// ---- FAQ データ ----
const faqs = [
  {
    category: "機能",
    q: "CGMと連携できますか？",
    a: "現在はリブレ・Dexcomとの連携機能を開発中です。現時点では手動入力またはCSVインポートをご利用いただけます。",
  },
  {
    category: "機能",
    q: "医師に見せるレポートはどう作りますか？",
    a: "有料プランでは、ログブックから「PDF出力」ボタン1つで診察用サマリーレポートを作成できます。血糖値・インスリン記録を医師が確認しやすい形式で出力します。",
  },
  {
    category: "データ",
    q: "データはどこに保存されますか？",
    a: "データは暗号化してサーバーに安全に保存されます。デバイスを変えてもログインすれば記録が引き継がれます。",
  },
  {
    category: "機能",
    q: "家族も一緒に使えますか？",
    a: "現在はユーザーごとに個別のアカウントをご利用ください。家族共有・閲覧機能は今後のアップデートで対応予定です。",
  },
  {
    category: "料金",
    q: "解約方法は？",
    a: "設定画面からいつでもプランを変更・解約できます。解約後も無料プランでデータの閲覧・記録を継続できます。",
  },
];

// ---- 機能カード データ ----
const features = [
  {
    icon: <Zap className="w-7 h-7 text-yellow-300" />,
    title: "自動計算ルール",
    desc: "「血糖値140以上なら+1単位」など条件を事前設定。血糖値を入力するだけで投与量を自動提案します。",
    bg: "bg-gradient-to-br from-primary to-blue-700",
    isHero: true,
  },
  {
    icon: <Activity className="w-6 h-6 text-green-500" />,
    title: "ダッシュボード",
    desc: "7日間の血糖カレンダーと連続記録ストリークで、日々の管理状況を一目で把握できます。",
    bg: "bg-green-50 dark:bg-green-950/20",
    isHero: false,
  },
  {
    icon: <BookOpen className="w-6 h-6 text-blue-500" />,
    title: "ログブック",
    desc: "食前・食後・投与量を一覧表示。PDF/CSVで出力して、そのまま医師に渡せます。",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    isHero: false,
  },
  {
    icon: <Settings2 className="w-6 h-6 text-purple-500" />,
    title: "複数インスリン管理",
    desc: "超速効型・持効型など複数のインスリンを時間帯別に設定。個別管理が可能です。",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    isHero: false,
  },
];

// ---- 比較表データ ----
const comparisonRows = [
  { feature: "投与量自動計算", us: true, others: false },
  { feature: "複数インスリン管理", us: true, others: null },
  { feature: "調整ルール設定", us: true, others: false },
  { feature: "PDF医師共有", us: true, others: null },
  { feature: "日本語完全対応", us: true, others: null },
  { feature: "4タイプの糖尿病対応", us: true, others: null },
];

// ---- 料金プランデータ ----
const plans = [
  {
    name: "無料",
    monthlyPrice: 0,
    yearlyPrice: 0,
    period: "ずっと無料",
    badge: null,
    features: [
      "血糖値・インスリン記録（無制限）",
      "プリセット3件まで",
      "調整ルール3件まで",
      "7日間の記録閲覧",
      "広告あり",
    ],
    missing: ["90日統計グラフ", "PDF/CSV出力", "広告なし"],
    cta: "無料で始める",
    variant: "outline" as const,
  },
  {
    name: "スタンダード",
    monthlyPrice: 480,
    yearlyPrice: 360,
    period: "/月",
    badge: "おすすめ",
    features: [
      "プリセット・ルール無制限",
      "30日・90日統計グラフ",
      "PDF/CSVエクスポート",
      "広告なし",
      "クラウドバックアップ",
      "優先サポート",
    ],
    missing: ["管理栄養士レビュー"],
    cta: "14日間無料で試す",
    variant: "default" as const,
  },
  {
    name: "プレミアム",
    monthlyPrice: 980,
    yearlyPrice: 740,
    period: "/月",
    badge: null,
    features: [
      "スタンダードの全機能",
      "管理栄養士による月1回のデータレビュー",
      "月次サマリーレポート（医師提出用）",
      "記録リマインダー通知カスタマイズ",
    ],
    missing: [],
    cta: "プレミアムで始める",
    variant: "outline" as const,
  },
];

// ---- ユーザーの声データ ----
const testimonials = [
  {
    text: "血糖値ノートが不要になりました。診察でも先生に喜ばれています。",
    author: "30代・妊娠糖尿病の経験者",
    stars: 5,
    img: "/images/testimonial-avatar-1.png",
    initial: "妊",
  },
  {
    text: "インスリン量の計算ミスがなくなった。毎食の記録が自然と習慣になりました。",
    author: "40代・1型糖尿病",
    stars: 5,
    img: "/images/testimonial-avatar-2.png",
    initial: "1型",
  },
  {
    text: "PDF出力で主治医への報告書が作れる！これだけでも使う価値があります。",
    author: "50代・2型糖尿病",
    stars: 5,
    img: "/images/testimonial-avatar-3.png",
    initial: "2型",
  },
  {
    text: "シンプルで使いやすい。他のアプリより断然記録しやすいです。",
    author: "60代・インスリン療法中",
    stars: 5,
    img: "/images/testimonial-avatar-4.png",
    initial: "療",
  },
];

// ---- ソリューションステップ ----
const steps = [
  {
    step: "1",
    icon: <Settings2 className="w-6 h-6" />,
    title: "インスリンを登録",
    desc: "使用しているインスリン製品と標準投与量をプリセットとして登録。複数種類にも対応。",
    img: "/images/step-1-preset-setup.png",
  },
  {
    step: "2",
    icon: <Activity className="w-6 h-6" />,
    title: "血糖値を入力",
    desc: "朝食前・食後・眠前など8つのタイミングに対応。毎日の測定値を入力するだけ。",
    img: "/images/step-2-glucose-input.png",
  },
  {
    step: "3",
    icon: <Zap className="w-6 h-6" />,
    title: "投与量が自動計算",
    desc: "事前に設定したルールが血糖値に応じてインスリン量を自動提案。迷わず投与できます。",
    img: "/images/step-3-auto-calculate.png",
  },
];

const categoryColor: Record<string, string> = {
  機能: "bg-blue-100 text-blue-700 border-blue-200",
  データ: "bg-green-100 text-green-700 border-green-200",
  料金: "bg-purple-100 text-purple-700 border-purple-200",
};

// ---- メインコンポーネント ----
export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [isYearly, setIsYearly] = useState(false);
  const { scrollYProgress } = useScroll();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* スクロール進行度バー */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-primary z-[60] origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* ナビバー */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Syringe className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">インスリア</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
              className="hidden sm:inline-flex"
            >
              ログイン
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/register")}
              className="shadow-sm shadow-primary/20 text-xs sm:text-sm"
            >
              無料で始める
            </Button>
          </div>
        </div>
      </header>

      {/* ① Hero */}
      <section className="relative overflow-hidden min-h-[100svh] flex items-center bg-[radial-gradient(ellipse_at_top_left,_hsl(221_83%_20%)_0%,_hsl(221_83%_10%)_50%,_hsl(217_91%_8%)_100%)]">
        {/* アニメーション背景メッシュ */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, hsl(221 83% 40% / 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(174 72% 40% / 0.2) 0%, transparent 50%)",
            backgroundSize: "200% 200%",
          }}
        />
        {/* 装飾円 */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-24 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* 左：テキスト */}
            <motion.div
              className="flex-1 text-center lg:text-left space-y-7 z-10"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
              }}
            >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
              >
                <Badge className="bg-white/15 text-white border-white/25 text-xs backdrop-blur-sm gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  インスリン療法中の糖尿病患者向け管理アプリ
                </Badge>
              </motion.div>

              <motion.h1
                className="text-5xl sm:text-6xl font-bold leading-[1.08] tracking-tight text-white"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
              >
                インスリン量の
                <br />
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                    迷い
                  </span>
                  <motion.span
                    className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-blue-300 to-cyan-300"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1.0 }}
                  />
                </span>
                を、なくす。
              </motion.h1>

              <motion.p
                className="text-lg text-white/75 max-w-xl mx-auto lg:mx-0 leading-relaxed"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
              >
                血糖値を入力するだけ。自動計算ルールがあなた専用の投与量を導き出す。
                日本で唯一、<strong className="text-white">インスリン調整ルール</strong>機能を持つ管理アプリです。
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
              >
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    onClick={() => setLocation("/register")}
                    className="gap-2 bg-white text-[hsl(221,83%,28%)] hover:bg-white/90 shadow-2xl shadow-black/30 font-bold rounded-xl min-h-[44px]"
                  >
                    無料で始める <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setLocation("/login")}
                  className="text-white border border-white/30 hover:bg-white/10 rounded-xl min-h-[44px]"
                >
                  ログイン
                </Button>
              </motion.div>

              {/* アバタースタック + 統計 */}
              <motion.div
                className="flex items-center justify-center lg:justify-start gap-4"
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.6 } } }}
              >
                <div className="flex -space-x-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-[hsl(221,83%,12%)] bg-primary/40 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    >
                      <ImageWithFallback
                        src={`/images/avatar-user-${i}.png`}
                        alt=""
                        className="w-full h-full object-cover"
                        fallback={
                          <span className="text-white/80 text-[10px]">{["妊", "1型", "2型", "療"][i - 1]}</span>
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">
                    <CountUp to={500} suffix="名以上" />が利用中
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-white/60 text-xs ml-1">4.8</span>
                  </div>
                </div>
              </motion.div>

              <motion.p
                className="text-xs text-white/40"
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.6 } } }}
              >
                メールアドレス不要・クレジットカード不要
              </motion.p>
            </motion.div>

            {/* 右：モックアップカード */}
            <motion.div
              className="flex-shrink-0 w-full max-w-[280px] sm:max-w-sm lg:max-w-sm mx-auto lg:mx-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            >
              <motion.div
                animate={{
                  y: [0, -12, 0],
                  rotateZ: [0, 0.5, 0, -0.5, 0],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.5))",
                }}
              >
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-blue-300" />
                      <span className="text-white/80 text-sm font-medium">朝食前の血糖値</span>
                    </div>
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                      正常範囲
                    </Badge>
                  </div>

                  <div className="text-center py-2">
                    <div className="text-5xl font-bold text-white tabular-nums">126</div>
                    <div className="text-white/50 text-sm mt-1">mg/dL</div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      調整ルール適用
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">ノボラピッド</span>
                      <span className="text-2xl font-bold text-white tabular-nums">
                        4<span className="text-sm font-normal text-white/60 ml-1">単位</span>
                      </span>
                    </div>
                    <div className="text-white/40 text-xs">血糖値 110〜149 → 標準量 +0単位</div>
                  </div>

                  <motion.div
                    className="bg-white/20 rounded-xl py-3 text-center text-white text-sm font-semibold cursor-default"
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                  >
                    記録する
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ② ユーザーの声 */}
      <section className="py-24 sm:py-32 px-4" style={{ background: "var(--surface-alt)" }}>
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-12">
              ユーザーの声
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {testimonials.map((t, i) => (
              <FadeInSection key={i} delay={i * 0.1} type="fadeUp">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 12px 40px hsl(221 83% 53% / 0.12)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-background rounded-3xl border border-border p-7 flex flex-col gap-4 cursor-default"
                >
                  <div className="text-6xl leading-none text-primary/20 font-serif select-none">"</div>
                  <p className="text-base leading-relaxed text-foreground flex-1 -mt-6">
                    {t.text}
                  </p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      <ImageWithFallback
                        src={t.img}
                        alt={t.author}
                        className="w-full h-full object-cover"
                        fallback={
                          <span className="text-primary font-bold text-xs">{t.initial}</span>
                        }
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.author}</p>
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: t.stars }).map((_, j) => (
                          <Star key={j} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ③ 課題提起 */}
      <section className="py-24 sm:py-32 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* 左: 課題テキスト */}
            <div className="space-y-7">
              <FadeInSection type="slideLeft">
                <Badge className="bg-red-100 text-red-600 border-red-200 mb-3">よくある悩み</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  こんな経験、<br />ありませんか？
                </h2>
              </FadeInSection>
              <div className="space-y-3">
                {[
                  "血糖値が毎日違うのに、投与量をどう変えればいいか迷う",
                  "「なんとなく今日は増やそうかな」と感覚で決めてしまう",
                  "診察前に記録をまとめようとしたら、ノートがバラバラで大変だった",
                  "複数のインスリンの管理が複雑で、ノートではカオスになる",
                ].map((text, i) => (
                  <FadeInSection key={i} delay={i * 0.08} type="slideLeft">
                    <div className="flex gap-4 items-start p-5 rounded-2xl bg-red-50/70 border border-red-100 hover:border-red-200 hover:shadow-sm transition-all duration-200">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <XCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="text-sm leading-relaxed">{text}</span>
                    </div>
                  </FadeInSection>
                ))}
              </div>
            </div>

            {/* 右: 画像 */}
            <FadeInSection delay={0.2} type="slideRight">
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl bg-muted aspect-[4/3] flex items-center justify-center">
                  <ImageWithFallback
                    src="/images/problem-notebook.png"
                    alt="手書きのインスリン記録ノート"
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                        <FileText className="w-16 h-16 opacity-30" />
                        <p className="text-sm text-center">手書きノートのイメージ</p>
                      </div>
                    }
                  />
                </div>
                <div className="absolute -top-4 -right-4 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                  Before
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ④ ソリューション（インタラクティブ3ステップ） */}
      <section className="py-24 sm:py-32 px-4" style={{ background: "var(--surface-alt)" }}>
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                インスリアが解決します
              </h2>
              <p className="text-muted-foreground text-lg">
                たった3ステップで、毎日のインスリン管理がスマートになります。
              </p>
            </div>
          </FadeInSection>

          {/* モバイル: タブ切り替え */}
          <div className="flex gap-2 mb-6 lg:hidden">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                  activeStep === i
                    ? "bg-primary text-white shadow-md shadow-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                STEP {s.step}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* 左: ステップリスト */}
            <div className="space-y-4">
              {steps.map((s, i) => (
                <FadeInSection key={s.step} delay={i * 0.1}>
                  <motion.div
                    className={`p-6 rounded-2xl cursor-pointer transition-colors duration-200 ${
                      activeStep === i
                        ? "bg-primary text-white shadow-xl shadow-primary/25"
                        : "bg-background border border-border hover:border-primary/30 hover:shadow-md"
                    }`}
                    onMouseEnter={() => setActiveStep(i)}
                    onClick={() => setActiveStep(i)}
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          activeStep === i ? "bg-white/20" : "bg-primary/10"
                        }`}
                      >
                        <span className={activeStep === i ? "text-white" : "text-primary"}>
                          {s.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-semibold mb-1 ${
                            activeStep === i ? "text-white/70" : "text-primary"
                          }`}
                        >
                          STEP {s.step}
                        </div>
                        <h3 className="font-bold text-lg leading-snug">{s.title}</h3>
                        <p
                          className={`text-sm mt-1.5 leading-relaxed ${
                            activeStep === i ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          {s.desc}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 shrink-0 mt-1 transition-opacity ${
                          activeStep === i ? "opacity-100 text-white" : "opacity-0"
                        }`}
                      />
                    </div>
                  </motion.div>
                </FadeInSection>
              ))}
            </div>

            {/* 右: スクリーンショット */}
            <FadeInSection delay={0.2} type="scale">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 20, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative aspect-[9/16] max-w-[260px] mx-auto"
                >
                  <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/20 to-blue-900/40 border border-white/10 flex items-center justify-center">
                    <ImageWithFallback
                      src={steps[activeStep].img}
                      alt={steps[activeStep].title}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="flex flex-col items-center gap-4 text-white/50 p-8">
                          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                            <span className="text-white/70">{steps[activeStep].icon}</span>
                          </div>
                          <p className="text-sm text-center font-medium text-white/70">
                            {steps[activeStep].title}
                          </p>
                          <p className="text-xs text-center text-white/40">
                            スクリーンショット準備中
                          </p>
                        </div>
                      }
                    />
                  </div>
                  {/* スマホフレーム装飾 */}
                  <div className="absolute inset-0 rounded-3xl border-2 border-white/10 pointer-events-none" />
                </motion.div>
              </AnimatePresence>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ⑤ 機能紹介 — Bento Grid */}
      <section className="py-24 sm:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight mb-14">
              主な機能
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Hero カード: 自動計算ルール */}
            <FadeInSection className="sm:col-span-2" delay={0} type="fadeUp">
              <motion.div
                whileHover={{ y: -4, boxShadow: "0 20px 60px hsl(221 83% 53% / 0.4)" }}
                transition={{ duration: 0.2 }}
                className="bg-gradient-to-br from-primary to-blue-700 rounded-3xl p-8 text-white relative overflow-hidden h-full min-h-[220px]"
              >
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
                <div className="absolute right-8 bottom-6 opacity-10">
                  <Zap className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
                    <Zap className="w-6 h-6 text-yellow-300" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">自動計算ルール</h3>
                  <p className="text-white/80 leading-relaxed max-w-md">
                    「血糖値140以上なら+1単位」など条件を事前設定。血糖値を入力するだけで投与量を自動提案します。
                  </p>
                  <div className="mt-5 bg-white/10 rounded-xl p-4 max-w-xs backdrop-blur-sm">
                    <div className="text-xs text-white/60 mb-1.5">血糖値: 162 mg/dL</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">ノボラピッド</span>
                      <span className="text-xl font-bold tabular-nums">
                        6<span className="text-sm font-normal text-white/60 ml-1">単位</span>
                      </span>
                    </div>
                    <div className="text-xs text-white/40 mt-1">150以上 → 標準量 +2単位</div>
                  </div>
                </div>
              </motion.div>
            </FadeInSection>

            {/* サブカード 3枚 */}
            {features.slice(1).map(({ icon, title, desc, bg }, i) => (
              <FadeInSection key={title} delay={(i + 1) * 0.1} type="scale">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 12px 40px hsl(221 83% 53% / 0.15)" }}
                  transition={{ duration: 0.2 }}
                  className={`${bg} rounded-3xl p-7 flex flex-col gap-4 h-full cursor-default`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1.5">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ⑥ 比較表 — 左右対比カード */}
      <section className="py-24 sm:py-32 px-4" style={{ background: "var(--surface-alt)" }}>
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight mb-14">
              他のアプリとの違い
            </h2>
          </FadeInSection>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* 左: 一般アプリ */}
            <FadeInSection delay={0} type="slideLeft">
              <div className="rounded-3xl border-2 border-muted p-7 space-y-0.5 opacity-60">
                <div className="text-lg font-bold text-muted-foreground mb-5 pb-3 border-b border-muted">
                  一般的な記録アプリ
                </div>
                {comparisonRows.map((r) => (
                  <div
                    key={r.feature}
                    className="flex items-center gap-3 py-3 border-b border-muted last:border-0"
                  >
                    {r.others === false ? (
                      <XCircle className="w-5 h-5 text-muted-foreground/60 shrink-0" />
                    ) : (
                      <span className="w-5 h-5 shrink-0 flex items-center justify-center text-muted-foreground text-xs">
                        △
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{r.feature}</span>
                  </div>
                ))}
              </div>
            </FadeInSection>

            {/* 右: インスリア */}
            <FadeInSection delay={0.1} type="slideRight">
              <div className="rounded-3xl border-2 border-primary p-7 space-y-0.5 shadow-2xl shadow-primary/20 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white px-5 py-1.5 text-sm shadow-lg shadow-primary/30">
                    インスリア
                  </Badge>
                </div>
                <div className="text-lg font-bold text-primary mb-5 pb-3 border-b border-primary/20 mt-2">
                  インスリン特化設計
                </div>
                {comparisonRows.map((r, i) => (
                  <FadeInSection key={r.feature} delay={i * 0.06}>
                    <div className="flex items-center gap-3 py-3 border-b border-primary/10 last:border-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm font-medium">{r.feature}</span>
                    </div>
                  </FadeInSection>
                ))}
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ⑦ 料金プラン（月/年トグル） */}
      <section className="py-24 sm:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight mb-4">
              まずは無料で始めよう
            </h2>
            <p className="text-muted-foreground text-center mb-10 text-lg">
              コーヒー1杯分で、毎日の安心を。
            </p>
          </FadeInSection>

          {/* 月/年トグル */}
          <FadeInSection delay={0.05}>
            <div className="flex items-center justify-center gap-3 mb-12">
              <span
                className={`text-sm transition-colors ${
                  !isYearly ? "font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                月払い
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                  isYearly ? "bg-primary" : "bg-muted"
                }`}
                aria-label="年払いに切り替え"
              >
                <motion.div
                  className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: isYearly ? 28 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
              <span
                className={`text-sm transition-colors ${
                  isYearly ? "font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                年払い
                <Badge className="ml-2 bg-green-100 text-green-700 border-green-200 text-xs">
                  2ヶ月分お得
                </Badge>
              </span>
            </div>
          </FadeInSection>

          {/* プランカード — モバイル横スクロール */}
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0">
            {plans.map((plan, i) => (
              <FadeInSection key={plan.name} delay={i * 0.1} className="shrink-0 w-[280px] sm:w-auto snap-center">
                <motion.div
                  whileHover={{ scale: plan.badge ? 1.03 : 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Card
                    className={`relative flex flex-col h-full rounded-3xl transition-all duration-200 ${
                      plan.badge
                        ? "border-primary border-2 shadow-xl shadow-primary/20"
                        : "hover:border-primary/40 hover:shadow-lg"
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm shadow-lg shadow-primary/30">
                          {plan.badge}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2 pt-7">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <div className="mt-2 flex items-end gap-1">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={isYearly ? "yearly" : "monthly"}
                            className="text-4xl font-bold tabular-nums"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                          >
                            ¥{(isYearly ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString()}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-sm text-muted-foreground mb-1">{plan.period}</span>
                      </div>
                      {isYearly && plan.yearlyPrice > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          年間 ¥{(plan.yearlyPrice * 12).toLocaleString()} で請求
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 gap-4">
                      <ul className="space-y-2.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                        {plan.missing.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-4">
                        <Button
                          className="w-full rounded-xl min-h-[44px]"
                          variant={plan.variant}
                          onClick={() => setLocation("/register")}
                        >
                          {plan.cta}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ⑧ 関連サービス */}
      <section className="py-24 sm:py-32 px-4" style={{ background: "var(--surface-alt)" }}>
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight mb-4">
              血糖管理をもっとサポートする
            </h2>
            <p className="text-muted-foreground text-center mb-14 text-lg">
              アプリと合わせて活用できるサービスをご紹介します。
            </p>
          </FadeInSection>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: <UtensilsCrossed className="w-6 h-6 text-orange-500" />,
                img: "/images/service-meal-delivery.png",
                title: "糖尿病向け宅配食",
                desc: "管理栄養士監修の低糖質・塩分調整食を毎日お届け。ウェルネスダイニング・noshなど。",
                color: "bg-orange-50",
              },
              {
                icon: <Gauge className="w-6 h-6 text-blue-500" />,
                img: "/images/service-glucose-meter.png",
                title: "血糖測定器・消耗品",
                desc: "フリースタイルリブレや穿刺針など、消耗品の選び方ガイドと購入リンクを提供。",
                color: "bg-blue-50",
              },
              {
                icon: <Stethoscope className="w-6 h-6 text-green-500" />,
                img: "/images/service-nutritionist.png",
                title: "管理栄養士に相談",
                desc: "食事記録をもとに管理栄養士がオンラインでアドバイス。プレミアムプランに含まれます。",
                color: "bg-green-50",
              },
            ].map(({ icon, img, title, desc, color }, i) => (
              <FadeInSection key={title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 12px 40px hsl(221 83% 53% / 0.1)" }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl border border-border bg-background overflow-hidden group cursor-default"
                >
                  <div className={`h-36 overflow-hidden ${color} flex items-center justify-center`}>
                    <ImageWithFallback
                      src={img}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallback={
                        <div className="flex items-center justify-center w-full h-full">
                          <div className="w-14 h-14 rounded-2xl bg-white/70 flex items-center justify-center">
                            {icon}
                          </div>
                        </div>
                      }
                    />
                  </div>
                  <div className="p-6 space-y-2">
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium pt-1">
                      詳しく見る <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </motion.div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ⑨ 開発者ストーリー */}
      <section className="py-24 sm:py-32 px-4">
        <div className="max-w-3xl mx-auto">
          <FadeInSection type="scale">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-blue-50 p-8 lg:p-12">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* 開発者アバター */}
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg shrink-0 bg-primary/10 flex items-center justify-center">
                  <ImageWithFallback
                    src="/images/developer-avatar.png"
                    alt="開発者"
                    className="w-full h-full object-cover"
                    fallback={<Heart className="w-8 h-8 text-primary/40" />}
                  />
                </div>
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Heart className="w-4 h-4 text-rose-500" />
                    インスリアが生まれた理由
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                    妻が妊娠糖尿病と診断されたとき、<br />
                    すべてがアナログだった。
                  </h2>
                  <div className="space-y-3 text-muted-foreground leading-relaxed">
                    <p>
                      妻が妊娠中に糖尿病と診断され、初めてインスリンを渡されました。
                      そのとき管理ツールとして渡されたのは、<strong className="text-foreground">1冊のノート</strong>だけでした。
                      血糖値を測るたびに手書きでメモして、診察でそのノートを見せる。
                      うまく伝えられないもどかしさが積み重なっていきました。
                    </p>
                    <p>
                      「血糖値とインスリンの記録を、誰もがすぐ理解できる形で共有できたら。」
                      それがインスリアを作り始めたきっかけです。
                    </p>
                  </div>
                  <div className="pt-3 border-t border-primary/15 text-xs text-muted-foreground">
                    — インスリア 開発者より
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ⑩ FAQ */}
      <section className="py-24 sm:py-32 px-4" style={{ background: "var(--surface-alt)" }}>
        <div className="max-w-2xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight mb-14">
              よくあるご質問
            </h2>
          </FadeInSection>
          <FadeInSection delay={0.1}>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="bg-background rounded-2xl border border-border px-5 data-[state=open]:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="text-left font-medium hover:no-underline py-5 gap-3 min-h-[44px]">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge
                        className={`text-xs shrink-0 ${categoryColor[faq.category] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {faq.category}
                      </Badge>
                      <span>{faq.q}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeInSection>

          {/* セキュリティバッジ */}
          <FadeInSection delay={0.2}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              {[
                { icon: <Lock className="w-4 h-4" />, label: "SSL暗号化通信" },
                { icon: <ShieldCheck className="w-4 h-4" />, label: "データ暗号化保存" },
                { icon: <FileText className="w-4 h-4" />, label: "プライバシーポリシー準拠" },
              ].map(({ icon, label }) => (
                <span key={label} className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-2">
                  {icon} {label}
                </span>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ⑪ 最終 CTA */}
      <section className="relative py-32 sm:py-40 px-4 overflow-hidden bg-[radial-gradient(ellipse_at_top,_hsl(221_83%_25%)_0%,_hsl(221_83%_10%)_50%,_hsl(217_91%_8%)_100%)]">
        {/* グロー */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(221_83%_50%_/_0.3)_0%,_transparent_70%)] pointer-events-none" />
        {/* 装飾円 */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        {/* 粒子アニメーション */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-blue-300/40"
            animate={{
              y: [0, -120, 0],
              x: [0, (i % 2 === 0 ? 1 : -1) * 20, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
            style={{
              left: `${10 + i * 10}%`,
              top: `${40 + (i % 3) * 15}%`,
            }}
          />
        ))}

        <div className="relative max-w-3xl mx-auto text-center space-y-8">
          {/* ライブ登録者数 */}
          <FadeInSection>
            <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2.5 text-white/80 text-sm border border-white/15">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              今週 <span className="text-white font-bold mx-1">23名</span> が新規登録
            </div>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1]">
              今日から、迷わない<br />
              インスリン管理を。
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <p className="text-white/75 text-lg leading-relaxed">
              血糖値を見るたびに、インスリン量が決まる。<br />
              あなた専用のルールで、毎日を自信を持って過ごそう。
            </p>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  onClick={() => setLocation("/register")}
                  className="gap-3 text-lg bg-white text-[hsl(221,83%,28%)] hover:bg-white/95 shadow-2xl shadow-black/30 font-bold px-10 py-6 rounded-2xl min-h-[56px]"
                >
                  無料で始める（1分で完了）
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setLocation("/login")}
                className="text-white border border-white/30 hover:bg-white/10 rounded-2xl min-h-[56px]"
              >
                ログイン
              </Button>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <p className="text-xs text-white/40">
              メールアドレス不要 · クレジットカード不要 · いつでも解約可能
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-10 px-4 border-t border-border safe-area-bottom">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Syringe className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-semibold text-foreground">インスリア</span>
            </div>
            <div className="flex flex-wrap justify-center gap-5 text-xs">
              <button
                className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
                onClick={() => setLocation("/login")}
              >
                ログイン
              </button>
              <button
                className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
                onClick={() => setLocation("/register")}
              >
                新規登録
              </button>
              <a
                href="#"
                className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
              >
                プライバシーポリシー
              </a>
              <a
                href="#"
                className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
              >
                利用規約
              </a>
              <a
                href="https://twitter.com/"
                className="hover:text-foreground transition-colors min-h-[44px] flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-3.5 h-3.5" />
                Twitter
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            ※本アプリは医療機器ではありません。投与量は必ず医師の指示に従ってください。
          </div>
        </div>
      </footer>
    </div>
  );
}
