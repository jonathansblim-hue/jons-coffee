import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH - update conversation with analytics data or conversion
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const supabase = getSupabase();

    // If marking as converted, just update converted + order_id
    if (body.converted !== undefined) {
      const { data, error } = await supabase
        .from("conversations")
        .update({
          converted: body.converted,
          order_id: body.order_id || null,
        })
        .eq("id", params.id)
        .select()
        .single();

      if (error) {
        console.error("Conversation update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ conversation: data });
    }

    // If appending analytics events, merge with existing arrays
    if (body.off_menu_requests || body.upsell_attempts || body.upsell_successes) {
      // First, fetch current data
      const { data: current, error: fetchError } = await supabase
        .from("conversations")
        .select("off_menu_requests, upsell_attempts, upsell_successes")
        .eq("id", params.id)
        .single();

      if (fetchError) {
        console.error("Conversation fetch error:", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      const existingOffMenu = (current?.off_menu_requests as string[]) || [];
      const existingUpsellAttempts = (current?.upsell_attempts as string[]) || [];
      const existingUpsellSuccesses = (current?.upsell_successes as string[]) || [];

      // Merge (deduplicate)
      const newOffMenu = [...new Set([...existingOffMenu, ...(body.off_menu_requests || [])])];
      const newUpsellAttempts = [...new Set([...existingUpsellAttempts, ...(body.upsell_attempts || [])])];
      const newUpsellSuccesses = [...new Set([...existingUpsellSuccesses, ...(body.upsell_successes || [])])];

      const { data, error } = await supabase
        .from("conversations")
        .update({
          off_menu_requests: newOffMenu,
          upsell_attempts: newUpsellAttempts,
          upsell_successes: newUpsellSuccesses,
        })
        .eq("id", params.id)
        .select()
        .single();

      if (error) {
        console.error("Conversation analytics update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ conversation: data });
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (error) {
    console.error("Conversation PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
