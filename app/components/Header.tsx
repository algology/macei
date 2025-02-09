"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Fragment } from "react";
import Image from "next/image";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const features = [
  {
    name: "Market Analysis",
    description: "AI-powered market signal analysis and trend detection",
    href: "/features/market-analysis",
  },
  {
    name: "Idea Validation",
    description: "Validate your ideas with real-time market data",
    href: "/features/idea-validation",
  },
  {
    name: "Knowledge Base",
    description: "Build and maintain your innovation knowledge base",
    href: "/features/knowledge-base",
  },
];

export function Header() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="py-6 sticky top-2 z-50 antialiased">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="bg-background/40 backdrop-blur-xl border border-accent-2 rounded-full">
          <div className="flex items-center justify-between py-2 px-6">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Image
                src="/logo.svg"
                alt="MACEI Logo"
                width={90}
                height={26}
                className="antialiased"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Popover className="relative">
                <PopoverButton className="flex items-center gap-x-1 text-sm hover:text-gray-300 transition-colors">
                  Features
                  <ChevronDown className="h-4 w-4" />
                </PopoverButton>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <PopoverPanel className="absolute left-1/2 z-10 mt-6 w-screen max-w-sm -translate-x-1/2 transform px-4">
                    <div className="overflow-hidden rounded-2xl bg-background/40 backdrop-blur-xl border border-accent-2 shadow-lg">
                      <div className="p-4">
                        {features.map((item) => (
                          <div
                            key={item.name}
                            className="group relative flex gap-x-6 rounded-lg p-4 hover:bg-accent-1 transition-colors"
                          >
                            <div className="flex-auto">
                              <a href={item.href} className="block font-medium">
                                {item.name}
                                <span className="absolute inset-0" />
                              </a>
                              <p className="mt-1 text-sm text-gray-400">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverPanel>
                </Transition>
              </Popover>

              <Link
                href="/pricing"
                className="text-sm hover:text-gray-300 transition-colors"
              >
                Blog
              </Link>
              <Link
                href="/about"
                className="text-sm hover:text-gray-300 transition-colors"
              >
                About
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <Link
                    href="/dashboard"
                    className="text-sm hover:text-gray-300 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="text-sm px-4 py-2 bg-accent-1/50 border border-accent-2 rounded-full hover:bg-accent-1 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    href="/login"
                    className="text-sm hover:text-gray-300 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm px-4 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
