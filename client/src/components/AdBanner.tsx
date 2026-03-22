import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

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
