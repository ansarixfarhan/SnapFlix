export const EMBED_AD_CONFIG = {
  // Master toggle for iframe ads
  enabled: true,

  // Destination ad URL (Monetag / Adsterra / Direct Link)
  adUrl:
    process.env.NEXT_PUBLIC_EMBED_AD_URL ||
    "https://publishers.monetag.com/welcome",

  // Delay before re-arming the invisible overlay after each click (in milliseconds)
  // 8 seconds allows the user to interact with player controls after opening the ad tab
  reArmDelayMs: 8000,
};

