import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH - update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, cancel_reason } = body;

    if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, in_progress, completed, or cancelled" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "completed" || status === "cancelled") {
      updateData.completed_at = new Date().toISOString();
    }

    if (status === "cancelled" && cancel_reason) {
      updateData.cancel_reason = cancel_reason;
    }

    const supabase = getSupabase();
    let { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    // If the cancel_reason column doesn't exist yet, retry without it
    if (error && cancel_reason) {
      console.warn("Retrying without cancel_reason (column may not exist yet)");
      const fallbackData: Record<string, unknown> = { status };
      if (status === "completed" || status === "cancelled") {
        fallbackData.completed_at = new Date().toISOString();
      }
      const retry = await supabase
        .from("orders")
        .update(fallbackData)
        .eq("id", params.id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;

      // Attach cancel_reason to the returned data so the UI still shows it
      if (data && cancel_reason) {
        data.cancel_reason = cancel_reason;
      }
    }

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

// GET single order
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
