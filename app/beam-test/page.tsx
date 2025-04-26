"use client";

import React from "react";
import HeroBeamAnimation from "@/components/homepage/HeroBeamAnimation"; // Import the new component

// Remove Circle, Icons, useRef, forwardRef, Image, cn, AnimatedBeam, lucide-react imports as they are now in HeroBeamAnimation

export default function BeamTestPage() {
  // Remove all the refs and component logic (Circle, Icons)

  return (
    // Render the new component directly
    <HeroBeamAnimation />
  );
}
