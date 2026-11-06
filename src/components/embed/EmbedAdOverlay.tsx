"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { EMBED_AD_CONFIG } from "@/config/embedAds";

export default function EmbedAdOverlay() {
  const [isOverlayActive, setIsOverlayActive] = useState(true);
  const reArmTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (reArmTimerRef.current) clearTimeout(reArmTimerRef.current);
    };
  }, []);

  const triggerAd = useCallback(() => {
    if (!EMBED_AD_CONFIG.enabled || !EMBED_AD_CONFIG.adUrl) return;

    try {
      const adWindow = window.open(
        EMBED_AD_CONFIG.adUrl,
        "_blank",
        "noopener,noreferrer"
      );

      if (!adWindow || adWindow.closed || typeof adWindow.closed === "undefined") {
        // Fallback programmatic click
        const link = document.createElement("a");
        link.href = EMBED_AD_CONFIG.adUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.warn("[Embed Ad] Error triggering popunder:", e);
    }

    // Temporarily disarm overlay so player controls and buttons work
    setIsOverlayActive(false);

    // Re-arm after delay so subsequent clicks/plays trigger another ad
    if (reArmTimerRef.current) clearTimeout(reArmTimerRef.current);
    reArmTimerRef.current = setTimeout(() => {
      setIsOverlayActive(true);
    }, EMBED_AD_CONFIG.reArmDelayMs);
  }, []);

  if (!EMBED_AD_CONFIG.enabled || !isOverlayActive) return null;

  return (
    <div
      onClick={triggerAd}
      className="absolute inset-0 z-30 bg-transparent cursor-pointer select-none"
      style={{ touchAction: "manipulation" }}
      aria-hidden="true"
    />
  );
}

