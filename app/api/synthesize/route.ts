import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel voice default

    if (!apiKey) {
      console.log("No ElevenLabs API key — falling back to browser TTS");
      return NextResponse.json({ useBrowserTTS: true });
    }

    // Truncate text if too long for the API
    const truncatedText = text.length > 1000 ? text.slice(0, 1000) + "..." : text;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: truncatedText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`ElevenLabs error ${response.status}:`, errorBody);
      return NextResponse.json({ useBrowserTTS: true });
    }

    const audioBuffer = await response.arrayBuffer();

    if (audioBuffer.byteLength < 100) {
      console.error("ElevenLabs returned empty audio");
      return NextResponse.json({ useBrowserTTS: true });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json({ useBrowserTTS: true });
  }
}
