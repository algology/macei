"use client";

import React, { forwardRef, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { User, Slack, Users, Mail } from "lucide-react"; // Removed Scale

// Circle Component Definition (Copied from beam-test/page.tsx)
const Circle = forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode }
>(({ className = "", children }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-12 items-center justify-center rounded-full border-2 border-neutral-700 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {children}
    </div>
  );
});
Circle.displayName = "Circle";

// Icons Object (Copied and adjusted from beam-test/page.tsx)
const Icons = {
  macyLogo: () => (
    <Image
      src="/logo_small.svg"
      alt="MACY Logo"
      width={40}
      height={40}
      className="object-contain"
    />
  ),
  avatar: () => <User className="w-6 h-6 text-neutral-800" />, // You
  // --- News Icons ---
  newsNYT: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=nytimes.com&sz=32"
      alt="NYT"
      width={24}
      height={24}
    />
  ),
  newsReuters: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=reuters.com&sz=32"
      alt="Reuters"
      width={24}
      height={24}
    />
  ),
  newsBBC: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=bbc.com&sz=32"
      alt="BBC"
      width={24}
      height={24}
    />
  ),
  newsWSJ: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=wsj.com&sz=32"
      alt="WSJ"
      width={24}
      height={24}
    />
  ),
  // --- Journals Icons ---
  journalArxiv: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=arxiv.org&sz=32"
      alt="ArXiv"
      width={24}
      height={24}
    />
  ),
  journalNature: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=nature.com&sz=32"
      alt="Nature"
      width={24}
      height={24}
    />
  ),
  journalScience: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=science.org&sz=32"
      alt="Science"
      width={24}
      height={24}
    />
  ),
  // --- Misc Icons ---
  iconSlack: () => (
    <Image
      src="https://www.google.com/s2/favicons?domain=slack.com&sz=32"
      alt="Slack Favicon"
      width={24}
      height={24}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  ),
  iconEmail: () => <Mail className="w-6 h-6 text-red-500" />,
  iconUsers: () => <Users className="w-6 h-6 text-blue-500" />,
};

// Define the HeroBeamAnimation component
export default function HeroBeamAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for individual icons (Copied from beam-test/page.tsx)
  const news1Ref = useRef<HTMLDivElement>(null);
  const news2Ref = useRef<HTMLDivElement>(null);
  const news3Ref = useRef<HTMLDivElement>(null);
  const news4Ref = useRef<HTMLDivElement>(null);
  const journal1Ref = useRef<HTMLDivElement>(null);
  const journal2Ref = useRef<HTMLDivElement>(null);
  const journal3Ref = useRef<HTMLDivElement>(null);
  const misc1Ref = useRef<HTMLDivElement>(null); // Slack
  const misc2Ref = useRef<HTMLDivElement>(null); // Gmail/Mail
  const misc3Ref = useRef<HTMLDivElement>(null); // Users
  const centerRef = useRef<HTMLDivElement>(null); // Center (MACY Logo)
  const userRef = useRef<HTMLDivElement>(null); // User (Avatar)

  return (
    <div
      className={cn(
        // Using min-h instead of fixed h for flexibility
        "relative flex min-h-[500px] w-full items-center justify-center overflow-hidden p-10"
      )}
      ref={containerRef}
    >
      {/* Main layout container for circles */}
      <div className="flex size-full max-w-xl flex-row items-stretch justify-between gap-10">
        {/* Left Column: User Icon */}
        <div className="flex flex-col justify-center">
          <Circle ref={userRef}>
            <Icons.avatar />
          </Circle>
        </div>

        {/* Center Column: MACY Logo */}
        <div className="flex flex-col justify-center">
          <Circle
            ref={centerRef}
            className="size-16 border-neutral-400 bg-white"
          >
            <Icons.macyLogo />
          </Circle>
        </div>

        {/* Right Column: Source Icons - Grouped Overlapping Rows */}
        <div className="flex flex-col justify-around gap-4">
          {/* News Group - Overlapping Row */}
          <div className="flex flex-row items-center">
            <Circle ref={news1Ref} className="z-[12]">
              <Icons.newsNYT />
            </Circle>
            <Circle ref={news2Ref} className="-ml-6 z-[11]">
              <Icons.newsReuters />
            </Circle>
            <Circle ref={news3Ref} className="-ml-6 z-[10]">
              <Icons.newsBBC />
            </Circle>
            <Circle ref={news4Ref} className="-ml-6 z-[9]">
              <Icons.newsWSJ />
            </Circle>
          </div>
          {/* Journals Group - Overlapping Row */}
          <div className="flex flex-row items-center">
            <Circle ref={journal1Ref} className="z-[8]">
              <Icons.journalArxiv />
            </Circle>
            <Circle ref={journal2Ref} className="-ml-6 z-[7]">
              <Icons.journalNature />
            </Circle>
            <Circle ref={journal3Ref} className="-ml-6 z-[6]">
              <Icons.journalScience />
            </Circle>
          </div>
          {/* Misc Group (Slack, Mail, Users) - Reordered Overlapping Row */}
          <div className="flex flex-row items-center">
            <Circle ref={misc1Ref} className="z-[5]">
              <Icons.iconSlack />
            </Circle>
            <Circle ref={misc2Ref} className="-ml-6 z-[4]">
              <Icons.iconEmail />
            </Circle>
            <Circle ref={misc3Ref} className="-ml-6 z-[3]">
              <Icons.iconUsers />
            </Circle>
          </div>
        </div>
      </div>

      {/* Animated Beams */}
      {/* Beams from Center to the Leftmost Source Icon of each group */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={news1Ref} // Target the first icon in the News row
        toRef={centerRef}
        duration={3}
        reverse // Flow from center to source
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={journal1Ref} // Target the first icon in the Journals row
        toRef={centerRef}
        duration={3}
        reverse // Flow from center to source
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={misc1Ref} // Target the first icon in the Misc row (Slack)
        toRef={centerRef}
        duration={3}
        reverse // Flow from center to source
      />

      {/* Bidirectional Beam between Center and User (Left) */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef} // Center
        toRef={userRef} // User
        duration={3} // Faster animation
        curvature={-20}
        startYOffset={10}
        endYOffset={10}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef} // Center
        toRef={userRef} // User
        duration={3} // Faster animation
        curvature={20}
        startYOffset={-10}
        endYOffset={-10}
        reverse
      />
    </div>
  );
}
