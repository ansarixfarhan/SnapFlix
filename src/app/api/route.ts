import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: 403,
      success: false,
      error: "Forbidden: Unauthorized Intruder Detected",
      message: "Bhai, ye tumhari ex ka ass hole nahi hai jo har koi munh utha ke ghus jayega! 🚪🚫",
      emotional_damage: "Kyun bhai? Zindagi me koi validation nahi mil rahi jo backend ke URL inspect karne aa gaye? 🤡",
      reality_check: "Ye SnapFlix ka private resolver backend hai. Yahan ghusne ki aukaat aur permission dono nahi hai tumhare paas.",
      advice: "Chupchaap https://snapflix.indevs.in par jao aur popcorn leke movie dekho, yahan faltu ungli mat karo.",
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
