import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from("farms").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
