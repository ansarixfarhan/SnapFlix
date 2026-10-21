import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const ROAST_PAYLOAD = {
  status: 403,
  success: false,
  error: "Forbidden: Unauthorized Intruder Detected",
  message: "This isn't your ex's asshole where anyone can just slide in without permission. 🚪🚫",
  emotional_damage: "Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention? 💀",
  reality_check: "This is a private SnapFlix backend API gateway. You don't have the clearance, the authorization, or the intellect to be here.",
  advice: "Close DevTools, wipe the drool off your keyboard, head over to https://snapflix.indevs.in and watch a movie like a normal human being.",
  incident_id: "YOUR_EGO_HAS_BEEN_CRUSHED",
};

const ROAST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>403 Forbidden — SnapFlix Backend Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% 20%, #1a0808 0%, #07070a 60%, #000000 100%);
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: rgba(18, 18, 24, 0.88);
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 16px;
      max-width: 640px;
      width: 100%;
      padding: 2.5rem 2rem;
      box-shadow: 0 0 60px rgba(239, 68, 68, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      text-align: center;
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 1.5rem;
    }
    .pulse {
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      box-shadow: 0 0 10px #ef4444;
      animation: blink 1.4s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.85); }
    }
    .quote-box {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 28, 0.6) 100%);
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.75rem;
      text-align: left;
    }
    .quote-box p {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fca5a5;
      line-height: 1.5;
    }
    .roast-grid {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-bottom: 2rem;
      text-align: left;
    }
    .roast-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 0.9rem 1.25rem;
    }
    .roast-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .roast-text {
      font-size: 0.92rem;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #e50914 0%, #b81d24 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 12px 28px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(229, 9, 20, 0.4);
      transition: all 0.2s ease;
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(229, 9, 20, 0.6);
    }
    .footer-meta {
      margin-top: 1.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.72rem;
      color: #64748b;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <div class="pulse"></div>
      <span>403 Access Denied — Private API Gateway</span>
    </div>
    
    <div class="quote-box">
      <p>"This isn't your ex's asshole where anyone can just slide in without permission." 🚪🚫</p>
    </div>

    <div class="roast-grid">
      <div class="roast-item">
        <div class="roast-label">💀 Emotional Damage</div>
        <div class="roast-text">Did you genuinely believe you discovered a secret backdoor, or are you just desperately starved for attention?</div>
      </div>
      <div class="roast-item">
        <div class="roast-label">🛡️ Reality Check</div>
        <div class="roast-text">This is SnapFlix's private resolver backend. You possess neither the clearance, the authorization, nor the intellect to probe this gateway.</div>
      </div>
      <div class="roast-item">
        <div class="roast-label">🍿 Prescribed Cure</div>
        <div class="roast-text">Close DevTools, wipe the drool off your keyboard, and go back to watching movies like a normal human being.</div>
      </div>
    </div>

    <a href="https://snapflix.indevs.in" class="cta-btn">
      <span>Go to SnapFlix Movies &rarr;</span>
    </a>

    <div class="footer-meta">
      INCIDENT ID: #YOUR_EGO_HAS_BEEN_CRUSHED &bull; PROTOCOL: ZERO_CHILL
    </div>
  </div>
</body>
</html>`;

export async function proxy(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const pathname = request.nextUrl.pathname;
  const accept = request.headers.get("accept") || "";

  // If visiting the backend API domain (api.snapflix.indevs.in)
  if (host.includes("api.snapflix.indevs.in") || host.startsWith("api.")) {
    // If accessing root, non-API routes, or bare /api
    const isBareApi = pathname === "/api" || pathname === "/api/";
    const isNonApi = !pathname.startsWith("/api/");

    if (isBareApi || isNonApi) {
      // Browser navigation gets styled HTML
      if (accept.includes("text/html")) {
        return new NextResponse(ROAST_HTML, {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      // API / cURL / Fetch clients get JSON
      return NextResponse.json(
        {
          ...ROAST_PAYLOAD,
          timestamp: new Date().toISOString(),
        },
        {
          status: 403,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }
  }

  // update user's auth session for normal frontend requests
  return await updateSession(request);
}

export const middleware = proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|cdn-cgi|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|js|css)$).*)",
  ],
};

