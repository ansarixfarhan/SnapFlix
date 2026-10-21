import { NextPage } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import Footer from "@/components/ui/layout/Footer";

const NetflixHeroBillboard = dynamic(
  () => import("@/components/sections/Home/NetflixHeroBillboard"),
);
const ContinueWatching = dynamic(() => import("@/components/sections/Home/ContinueWatching"));
const HomePageList = dynamic(() => import("@/components/sections/Home/List"));

interface HomePageProps {
  searchParams: Promise<{
    content?: "movie" | "tv";
  }>;
}

const HomePage: NextPage<HomePageProps> = async ({ searchParams }) => {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (host.includes("api.snapflix.indevs.in") || host.startsWith("api.")) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-8 font-mono text-sm">
        <pre className="whitespace-pre-wrap leading-relaxed max-w-3xl">
{`# 403 Forbidden — Unauthorized Access

> "This isn't your ex's asshole where anyone can just slide in without permission." 🚪🚫

### 💀 Emotional Damage
Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention?

### 🛡️ Reality Check
This is SnapFlix's private stream resolver backend. You possess neither the clearance, the authorization, nor the intellect to probe this gateway.

### 🍿 Prescribed Cure
Close DevTools, wipe the drool off your keyboard, and go back to watching movies like a normal human being.

---
👉 Official Website: https://snapflix.indevs.in
INCIDENT ID: #YOUR_EGO_HAS_BEEN_CRUSHED | PROTOCOL: ZERO_CHILL`}
        </pre>
      </div>
    );
  }

  const { content } = await searchParams;

  return (
    <div className="flex flex-col">
      <NetflixHeroBillboard contentType={content === "tv" ? "tv" : "movie"} />

      <div className="relative z-10 flex flex-col gap-8 md:gap-11">
        <ContinueWatching />
        <HomePageList />
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
