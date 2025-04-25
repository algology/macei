import React from "react";
import Link from "next/link";

export default function SlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* Call to action */}
      <div className="mt-16 mx-auto  bg-background border-t border-accent-2 py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-16 xl:px-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            Ready to Build Your Next Big Idea?
          </h2>
          <p className="text-lg text-foreground-light mb-8">
            Macy is your AI co-founder, ready to help you innovate faster.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-500/20 text-green-400 border border-green-900 hover:bg-green-500/30 h-10 px-4 py-2"
            >
              Pitch Macy your idea
            </Link>
            <Link
              href="mailto:hello@getmacy.com"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-500/20 text-gray-400 border border-gray-800 hover:bg-gray-500/30 h-10 px-4 py-2"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
