import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: 403,
      success: false,
      error: "Forbidden: Unauthorized Intruder Detected",
      message: "This isn't your ex's asshole where anyone can just slide in without permission. 🚪🚫",
      emotional_damage: "Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention? 💀",
      reality_check: "This is a private SnapFlix backend API gateway. You don't have the clearance, the authorization, or the intellect to be here.",
      advice: "Close DevTools, wipe the drool off your keyboard, head over to https://snapflix.indevs.in and watch a movie like a normal human being.",
      incident_id: "YOUR_EGO_HAS_BEEN_CRUSHED",
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

export async function POST() {
  return GET();
}
