import { WebSocketServer } from 'ws';

// Create a WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Object to store connected clients
const clients = {};

// Function to send a message to a specific client
export const notifyUser = (userId, message) => {
  const client = clients[userId];
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
};

// Function to handle new connections
wss.on('connection', (ws, request) => {
  const userId = request.headers['sec-websocket-protocol'];
  clients[userId] = ws;

  // Remove the client when they disconnect
  ws.on('close', () => {
    delete clients[userId];
  });
});

export { wss, clients };
