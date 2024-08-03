import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4000');

ws.on('open', () => {
  console.log('WebSocket connected');
  ws.send('Hello Server');
});

ws.on('message', (message) => {
  console.log('Message from server:', message);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
