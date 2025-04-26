import React from "react";
import Link from "next/link";

export default function SlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container mx-auto px-4 py-4 md:py-8 xl:py-10 sm:px-16 xl:px-20">
      <div className="grid grid-cols-12 gap-4">
        <div className="hidden col-span-12 lg:col-span-2 xl:block">
          <Link
            href="/blog"
            className="text-gray-500 hover:text-foreground flex items-center text-sm transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-chevron-left mr-2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-gray-500">Back</span>
          </Link>
        </div>
        <div className="col-span-12 lg:col-span-12 xl:col-span-10">
          {children}
          {/* Call to action */}
          <div className="mt-16 mx-auto bg-background border-t border-accent-2 py-20">
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
        </div>
      </div>
    </main>
  );
}
