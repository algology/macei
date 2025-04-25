import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { name, user_id } = await request.json();
  const supabaseServer = getServerSupabase();
  const { data, error } = await supabaseServer
    .from('organizations')
    .insert([{ name, user_id }])
    .select()
    .single();

  if (error) {
    console.error('Error creating organization in server:', error);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(data, { status: 200 });
}
