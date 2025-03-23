// Store active connections by ideaId
const activeConnections = new Map<string, Set<(data: string) => void>>();

// Export functions to manage event connections
export const briefingEvents = {
  // Function to send event to all clients for a specific ideaId
  sendEventToClients: (ideaId: string, data: any) => {
    const connections = activeConnections.get(ideaId);
    if (connections) {
      const eventData = JSON.stringify(data);
      connections.forEach((client) => client(`data: ${eventData}\n\n`));
    }
  },

  // Register a new client connection
  registerClient: (ideaId: string, send: (data: string) => void) => {
    if (!activeConnections.has(ideaId)) {
      activeConnections.set(ideaId, new Set());
    }
    activeConnections.get(ideaId)?.add(send);
    return () => briefingEvents.removeClient(ideaId, send);
  },

  // Remove a client connection
  removeClient: (ideaId: string, send: (data: string) => void) => {
    activeConnections.get(ideaId)?.delete(send);
    if (activeConnections.get(ideaId)?.size === 0) {
      activeConnections.delete(ideaId);
    }
  },
};
