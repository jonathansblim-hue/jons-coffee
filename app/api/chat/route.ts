import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MENU_TEXT, DRINK_RULES } from "@/lib/menu";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
  return new GoogleGenerativeAI(apiKey);
}

const SYSTEM_PROMPT = `You are a friendly, efficient AI cashier at Jon's Coffee, a busy coffee shop at 512 West 43rd Street, New York, NY. Your name is Jo.

${MENU_TEXT}

${DRINK_RULES}

YOUR BEHAVIOR:
- Be warm, friendly, and efficient — like a real NYC barista
- Greet customers warmly when they first message
- Guide them through ordering naturally
- Ask clarifying questions when needed (size, temperature, milk preference, etc.)
- Suggest popular items if they seem undecided
- Confirm modifications and additions clearly
- Keep responses concise but friendly — this is a busy NYC coffee shop!

ORDERING FLOW:
1. Greet the customer
2. Take their order item by item
3. For each drink, confirm: name, size (Small 12oz / Large 16oz), temperature (Hot/Iced), and any modifications
4. Ask if they'd like anything else
5. When they're done, summarize the complete order with prices and confirm

WHEN THE ORDER IS CONFIRMED:
When the customer confirms their final order, you MUST respond with the order summary followed by a JSON block in this exact format wrapped in \`\`\`json code fences:

\`\`\`json
{
  "order_confirmed": true,
  "customer_name": "the customer's name if given, otherwise Guest",
  "items": [
    {
      "name": "Drink or food name",
      "size": "Small" or "Large" or null for pastries,
      "temperature": "Hot" or "Iced" or null for pastries,
      "milk": "Whole Milk" (default), "Skim Milk", "Oat Milk", or "Almond Milk",
      "iceLevel": "Regular" (default), "No Ice", "Less Ice", or "Extra Ice",
      "sweetness": "Regular" (default), "No Sugar", "Less Sugar", or "Extra Sugar",
      "modifications": ["Extra Espresso Shot", "Caramel Syrup", etc.],
      "basePrice": 0.00,
      "modificationsPrice": 0.00,
      "totalPrice": 0.00,
      "quantity": 1
    }
  ]
}
\`\`\`

IMPORTANT: Only include the JSON when the customer has CONFIRMED their order is complete. Do not include it during the ordering process.
Tax rate is 8.875% (NYC sales tax).

Remember: Be helpful but enforce the menu rules. If someone asks for something impossible (like a hot Frappuccino), politely explain why and offer alternatives.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const genAI = getGemini();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Convert messages to Gemini format
    // Gemini uses "user" and "model" roles
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const reply = result.response.text();

    return NextResponse.json({
      message: reply || "I'm sorry, I didn't catch that. Could you repeat your order?",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    );
  }
}
