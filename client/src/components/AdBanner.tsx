import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * AdBanner
 *
 * Google AdSense (adsbygoogle) によるバナー広告コンポーネント。
 *
 * Sprint 2 (S2-2) 改修:
 *   - adsbygoogle 本体スクリプトのロード失敗 (広告ブロッカー / ネットワーク失敗 /
 *     CSP ブロック等) で window.adsbygoogle が undefined の場合、<ins> を一切
 *     描画せず null を返す。
 *   - これにより広告ブロック環境でも本体ページの操作性が完全に維持される
 *     (DOM ノードゼロ、レイアウト崩れなし)。
 *   - 既存の try/catch (push 失敗時) は維持。
 *   - useEffect では window.adsbygoogle のロード状況を監視し、未ロードなら
 *     adAvailable=false で早期リターン。最大 3 秒待ってロードされなければ
 *     諦める (タイムアウト)。
 */
export function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adAvailable, setAdAvailable] = useState<boolean | null>(null);

  // adsbygoogle のロード判定
  // 初期ロードでは <script async> がまだ完了していない可能性があるため、
  // 100ms 間隔で最大 30 回 (3 秒) ポーリングし、検出/タイムアウトを判定する。
  useEffect(() => {
    if (typeof window === "undefined") {
      setAdAvailable(false);
      return;
    }

    // 既にロード済みなら即 true
    if (typeof (window as any).adsbygoogle !== "undefined") {
      setAdAvailable(true);
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 * 100ms = 3 秒
    const interval = setInterval(() => {
      attempts += 1;
      if (typeof (window as any).adsbygoogle !== "undefined") {
        setAdAvailable(true);
        clearInterval(interval);
      } else if (attempts >= MAX_ATTEMPTS) {
        // タイムアウト: ロードされなかった (Adsense ブロック環境とみなす)
        setAdAvailable(false);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // adsbygoogle が利用可能になった後にだけ <ins> を MutationObserver で監視する
  useEffect(() => {
    if (adAvailable !== true) return;
    if (!adRef.current) return;

    const observer = new MutationObserver(() => {
      if (adRef.current) {
        const hasAdContent =
          adRef.current.getAttribute("data-ad-status") === "filled" ||
          adRef.current.children.length > 0 ||
          adRef.current.innerHTML.trim().length > 0;
        if (hasAdContent) {
          setAdLoaded(true);
        }
      }
    });

    observer.observe(adRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ad-status"],
    });

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
    }

    const timeout = setTimeout(() => {
      if (adRef.current) {
        const status = adRef.current.getAttribute("data-ad-status");
        if (status === "filled") {
          setAdLoaded(true);
        }
      }
    }, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [adAvailable]);

  // adsbygoogle が利用不可 → 何も描画しない (DOM ノードゼロ)
  if (adAvailable === false) {
    return null;
  }

  // ロード判定中も何も描画しない (white-flash 防止のため display:none で枠も持たない)
  return (
    <div
      className={adLoaded ? "mt-6 pt-4 border-t" : ""}
      style={{ display: adLoaded ? "block" : "none" }}
      data-testid="ad-banner-container"
    >
      {adLoaded && (
        <p className="text-xs text-muted-foreground text-center mb-2">広告</p>
      )}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: adLoaded ? "100px" : "0" }}
        data-ad-client="ca-pub-8606804226935323"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
