import PublicHeader from "@/components/layout/public-header";
import PublicHero from "@/components/shared/public-hero";
import PublicTrust from "@/components/shared/public-trust";
import PublicSteps from "@/components/shared/public-steps";
import PublicCTA from "@/components/shared/public-cta";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#eef2ff_35%,_#ffffff_75%)] text-slate-900">
      <PublicHeader />
      <PublicHero />
      <PublicTrust />
      <PublicSteps />
      <PublicCTA />
    </main>
  );
}