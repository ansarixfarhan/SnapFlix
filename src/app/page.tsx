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
      <div className="min-h-screen bg-[#0d1117] text-[#58a6ff] p-6 font-mono text-sm flex items-center justify-center">
        <pre className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-2xl whitespace-pre-wrap leading-relaxed shadow-2xl">
          {JSON.stringify(
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
            null,
            2
          )}
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
