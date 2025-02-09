"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search, Filter, Plus } from "lucide-react";

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!user) return null;

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <div className="bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <button className="p-2 rounded bg-accent-1/50 border border-accent-2 hover:bg-accent-1">
              <Search className="w-4 h-4 text-gray-400" />
            </button>
            <button className="p-2 rounded bg-accent-1/50 border border-accent-2 hover:bg-accent-1">
              <Filter className="w-4 h-4 text-gray-400" />
            </button>
            <button className="px-4 py-2 rounded bg-green-500/20 text-green-400 text-sm flex items-center gap-2 border border-green-900 hover:bg-green-500/30">
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Add your dashboard content here */}
        <div className="grid gap-6">
          {/* Example card */}
          <div className="p-6 border border-accent-2 rounded-xl bg-accent-1/30">
            <h2 className="text-lg font-medium mb-2">
              Welcome to your dashboard
            </h2>
            <p className="text-gray-400">
              Start by creating your first project
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
