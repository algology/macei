import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { organization_id, email, role = "viewer" } = await request.json();
    const supabaseServer = getServerSupabase();

    console.log(`Inviting member to org ${organization_id} with email ${email}, role ${role}`);

    // Lookup user ID via Admin API search
    const { data: listData, error: listError } = await supabaseServer.auth.admin.listUsers({
      search: email,
      page: 1,
      perPage: 100,
    } as any);
    console.log("Admin user search result:", listData, listError);
    if (listError || !listData?.users?.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = listData.users.find((u: any) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = user.id;

    console.log("User ID determined:", userId); // Debugging log

    // Check existing membership
    const { data: existing, error: existingError } = await supabaseServer
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member" },
        { status: 409 }
      );
    }

    // Insert membership
    const { data: member, error: insertError } = await supabaseServer
      .from("organization_members")
      .insert({ organization_id, user_id: userId, role })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(member, { status: 200 });
  } catch (err) {
    console.error("Error in organization-members API:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
