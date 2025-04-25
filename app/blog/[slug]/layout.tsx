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
          <h2 className="text-3xl sm:text-4xl font-semibold leading-tight">
            <span className="text-foreground-lighter">
              The co-founder that{" "}
            </span>
            <span className="text-foreground block sm:inline">
              <strong className="text-brand">never</strong> sleeps, validating
              ideas 24/7
            </span>
          </h2>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link
              href="/"
              data-size="medium"
              type="button"
              className="shadow-md hover:shadow-lg relative inline-flex items-center space-x-2 text-sm px-4 py-2 h-[38px] rounded-md bg-brand-400 dark:bg-brand-500 hover:bg-brand/80 dark:hover:bg-brand/50 text-foreground border border-brand-500/75 dark:border-brand-30 transition-all ease-out duration-200"
            >
              Pitch your idea
            </Link>
            <Link
              href="/contact/sales"
              data-size="medium"
              type="button"
              className="shadow-md hover:shadow-lg relative inline-flex items-center space-x-2 text-sm px-4 py-2 h-[38px] rounded-md bg-alternative dark:bg-muted hover:bg-selection border border-strong hover:border-stronger text-foreground transition-all ease-out duration-200"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
