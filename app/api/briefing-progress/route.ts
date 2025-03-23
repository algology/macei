import { NextRequest, NextResponse } from "next/server";

// Store active connections by ideaId
const activeConnections = new Map<string, Set<(data: string) => void>>();

// Create an EventEmitter for internal use that doesn't get exported as a route handler
const briefingEvents = {
  // Function to send event to all clients for a specific ideaId
  sendEventToClients: (ideaId: string, data: any) => {
    const connections = activeConnections.get(ideaId);
    if (connections) {
      const eventData = JSON.stringify(data);
      connections.forEach((client) => client(`data: ${eventData}\n\n`));
    }
  },
};

// Export the event emitter for use in other modules
export { briefingEvents };

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

      // Register client
      if (!activeConnections.has(ideaId)) {
        activeConnections.set(ideaId, new Set());
      }
      activeConnections.get(ideaId)?.add(send);

      // Let the client know we're connected
      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      // Handle cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        activeConnections.get(ideaId)?.delete(send);
        if (activeConnections.get(ideaId)?.size === 0) {
          activeConnections.delete(ideaId);
        }
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
