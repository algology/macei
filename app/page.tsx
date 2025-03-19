import { ArrowRight, Brain, LineChart, Target, Sparkles } from "lucide-react";
import Image from "next/image";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Background } from "./components/Background";
import { HeroInstanceDashboard } from "./components/HeroInstanceDashboard";

export default function Home() {
  return (
    <>
      <Background />
      <div className="relative">
        <Header />

        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/80 via-transparent to-background/80" />

          <div className="max-w-7xl mx-auto px-4 relative z-10 py-20">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent-1/50 border border-accent-2 mb-8">
                <Sparkles className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm font-mono text-gray-400">
                  INTRODUCING MACY
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-normal mb-8 leading-tight tracking-tight">
                Break Free from the
                <span className="gradient-text block mt-2">
                  Innovator&apos;s Dilemma
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
                AI-powered market intelligence that helps enterprises validate
                new ideas and discover hidden opportunities before your
                competitors do.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <a
                  href="/login"
                  className="group px-8 py-4 bg-green-500 text-black rounded-full hover:bg-green-400 transition-colors duration-200 font-medium flex items-center gap-2 text-lg"
                >
                  Let&apos;s go
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <div className="flex items-center gap-4 text-gray-400">
                  <div className="w-12 h-px bg-gray-800" />
                  <span className="text-sm">Start validating ideas now</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="border-y border-accent-2 bg-background/30 backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-gray-400 mb-8">
                TRUSTED BY INNOVATIVE TEAM AT
              </p>
              <div className="flex justify-center items-center gap-12">
                <Image
                  src="/11point2logo.png"
                  alt="11point2 Logo"
                  width={180}
                  height={60}
                  className="opacity-60 hover:opacity-100 hover:scale-105 transition-all duration-300 grayscale"
                  style={{ height: "auto" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Value Proposition Section */}
        <section className="py-32 bg-background/20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
              <div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent-1/50 border border-accent-2 mb-4">
                  <Brain className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="text-sm font-mono text-gray-400">
                    WHY MACY
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                  Turn Market Signals into
                  <span className="gradient-text"> Strategic Advantage</span>
                </h2>
                <p className="text-xl text-gray-400 leading-relaxed">
                  Our AI-powered platform continuously analyzes market signals,
                  research papers, and industry trends to help you validate
                  ideas with confidence and discover new opportunities before
                  they become obvious.
                </p>
              </div>
              <div className="relative w-full">
                <HeroInstanceDashboard />
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 bg-background/30 backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-8">
                Everything you need to
                <span className="gradient-text block mt-2">
                  Validate Ideas Fast
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Our platform combines AI-powered analysis with human expertise
                to help you make confident decisions about new opportunities.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Brain className="w-8 h-8" />}
                title="AI-Powered Analysis"
                description="Continuous monitoring and analysis of market signals, trends, and opportunities"
              />
              <FeatureCard
                icon={<LineChart className="w-8 h-8" />}
                title="Real-time Insights"
                description="Track market movements and get instant alerts about relevant changes"
              />
              <FeatureCard
                icon={<Target className="w-8 h-8" />}
                title="Strategic Recommendations"
                description="Get actionable insights and clear next steps for your innovation initiatives"
              />
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-2xl p-8 hover:border-green-500/50 transition-colors">
      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 text-green-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
