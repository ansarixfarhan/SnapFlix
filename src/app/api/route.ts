import { NextResponse } from "next/server";

const ROAST_MARKDOWN = `# 403 Forbidden — Unauthorized Access

> "This isn't your ex's asshole where anyone can just slide in without permission." 🚪🚫

### 💀 Emotional Damage
Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention?

### 🛡️ Reality Check
This is SnapFlix's private stream resolver backend. You possess neither the clearance, the authorization, nor the intellect to probe this gateway.

### 🍿 Prescribed Cure
Close DevTools, wipe the drool off your keyboard, and go back to watching movies like a normal human being.

---
👉 Official Website: https://snapflix.indevs.in
INCIDENT ID: #YOUR_EGO_HAS_BEEN_CRUSHED | PROTOCOL: ZERO_CHILL
`;

export async function GET() {
  return new NextResponse(ROAST_MARKDOWN, {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST() {
  return GET();
}
