"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function Auth() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="w-full bg-accent-1/50 backdrop-blur-sm border border-accent-2 rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold mb-6">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mb-6 px-4 py-3 border border-accent-2 rounded-lg flex items-center justify-center gap-2 hover:bg-accent-1 transition-colors"
        >
          <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-accent-2"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-gray-400">
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-accent-1 border border-accent-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-foreground placeholder-gray-500"
                placeholder="george@11point2.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-accent-1 border border-accent-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-foreground placeholder-gray-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 px-8 py-4 bg-green-500 text-black rounded-lg hover:bg-green-400 transition-colors duration-200 font-medium"
          >
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
