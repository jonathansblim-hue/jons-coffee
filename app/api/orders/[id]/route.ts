import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH - update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status } = body;

    if (!["pending", "in_progress", "completed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, in_progress, or completed" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

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
