import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST - create a new conversation session
export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ session_id })
      .select()
      .single();

    if (error) {
      console.error("Conversation insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data }, { status: 201 });
  } catch (error) {
    console.error("Conversations POST error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
