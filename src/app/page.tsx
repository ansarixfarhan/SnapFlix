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
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/40 via-[#0a0a0f] to-black text-slate-200 p-6 flex items-center justify-center font-sans">
        <div className="bg-[#121218]/90 border border-red-500/30 rounded-2xl max-w-xl w-full p-8 shadow-[0_0_60px_rgba(239,68,68,0.18)] backdrop-blur-xl text-center">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
            403 Access Denied — Private API Gateway
          </div>

          <div className="bg-gradient-to-br from-red-950/30 to-slate-900/60 border-l-4 border-red-500 rounded-lg p-5 mb-6 text-left">
            <p className="text-red-200 text-lg font-bold leading-relaxed">
              &ldquo;This isn&apos;t your ex&apos;s asshole where anyone can just slide in without permission.&rdquo; 🚪🚫
            </p>
          </div>

          <div className="space-y-3 mb-8 text-left">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                💀 Emotional Damage
              </div>
              <div className="text-sm text-slate-300">
                Did you genuinely believe you discovered a secret backdoor, or are you just desperately starved for attention?
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                🛡️ Reality Check
              </div>
              <div className="text-sm text-slate-300">
                This is SnapFlix&apos;s private resolver backend. You possess neither the clearance, the authorization, nor the intellect to probe this gateway.
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                🍿 Prescribed Cure
              </div>
              <div className="text-sm text-slate-300">
                Close DevTools, wipe the drool off your keyboard, and go back to watching movies like a normal human being.
              </div>
            </div>
          </div>

          <a
            href="https://snapflix.indevs.in"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm px-7 py-3 rounded-xl shadow-[0_4px_20px_rgba(229,9,20,0.4)] hover:shadow-[0_6px_25px_rgba(229,9,20,0.6)] transition-all transform hover:-translate-y-0.5"
          >
            <span>Go to SnapFlix Movies &rarr;</span>
          </a>

          <div className="mt-7 font-mono text-[11px] text-slate-500 tracking-wider">
            INCIDENT ID: #YOUR_EGO_HAS_BEEN_CRUSHED &bull; PROTOCOL: ZERO_CHILL
          </div>
        </div>
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
