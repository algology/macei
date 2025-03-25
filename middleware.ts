import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Initialize the Supabase client
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Check if the user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get the current path
  const path = request.nextUrl.pathname;

  // If the user is authenticated and trying to access the landing page,
  // redirect them to the dashboard
  if (session && path === "/") {
    const redirectUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Define the paths middleware should run on
export const config = {
  matcher: ["/", "/login"],
};
