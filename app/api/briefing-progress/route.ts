import { NextRequest, NextResponse } from "next/server";
import { briefingEvents } from "../../lib/briefingEvents";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ideaId = searchParams.get("ideaId");

  if (!ideaId) {
    return NextResponse.json({ error: "Missing ideaId" }, { status: 400 });
  }

  // Use ReadableStream to create an SSE endpoint
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("retry: 1000\n\n"));

      // Function to send data to this specific client
      const send = (data: string) => {
        controller.enqueue(new TextEncoder().encode(data));
      };

      // Register client and get cleanup function
      const cleanup = briefingEvents.registerClient(ideaId, send);

      // Let the client know we're connected
      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      // Handle cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
