import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = getSupabase();
    let query = supabase
      .from("conversations")
      .select("*")
      .order("started_at", { ascending: false });

    if (from) query = query.gte("started_at", from);
    if (to) query = query.lte("started_at", to);

    const { data, error } = await query;

    if (error) {
      console.error("Analytics fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversations = data || [];
    const totalConversations = conversations.length;
    const convertedConversations = conversations.filter((c) => c.converted).length;
    const conversionRate = totalConversations > 0
      ? (convertedConversations / totalConversations) * 100
      : 0;

    // Aggregate off-menu requests
    const offMenuCounts: Record<string, number> = {};
    conversations.forEach((c) => {
      const requests = (c.off_menu_requests as string[]) || [];
      requests.forEach((item: string) => {
        offMenuCounts[item] = (offMenuCounts[item] || 0) + 1;
      });
    });
    const offMenuItems = Object.entries(offMenuCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Aggregate upsell data
    const upsellAttemptCounts: Record<string, number> = {};
    const upsellSuccessCounts: Record<string, number> = {};
    conversations.forEach((c) => {
      const attempts = (c.upsell_attempts as string[]) || [];
      const successes = (c.upsell_successes as string[]) || [];
      attempts.forEach((item: string) => {
        upsellAttemptCounts[item] = (upsellAttemptCounts[item] || 0) + 1;
      });
      successes.forEach((item: string) => {
        upsellSuccessCounts[item] = (upsellSuccessCounts[item] || 0) + 1;
      });
    });

    const upsellItems = Object.keys(upsellAttemptCounts).map((name) => ({
      name,
      attempts: upsellAttemptCounts[name] || 0,
      successes: upsellSuccessCounts[name] || 0,
      successRate:
        upsellAttemptCounts[name] > 0
          ? ((upsellSuccessCounts[name] || 0) / upsellAttemptCounts[name]) * 100
          : 0,
    })).sort((a, b) => b.attempts - a.attempts);

    const totalUpsellAttempts = Object.values(upsellAttemptCounts).reduce((s, c) => s + c, 0);
    const totalUpsellSuccesses = Object.values(upsellSuccessCounts).reduce((s, c) => s + c, 0);
    const overallUpsellRate = totalUpsellAttempts > 0
      ? (totalUpsellSuccesses / totalUpsellAttempts) * 100
      : 0;

    return NextResponse.json({
      totalConversations,
      convertedConversations,
      conversionRate,
      offMenuItems,
      upsellItems,
      totalUpsellAttempts,
      totalUpsellSuccesses,
      overallUpsellRate,
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
