import WebSocket from 'ws';
import { MessageHandler } from './msg-handler';
import { httpServer } from './http-server';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || 'localhost';

const wss = new WebSocket.Server({ server: httpServer });
const messageHandler = new MessageHandler();

console.log('='.repeat(50));
console.log('Battleship WebSocket Server');
console.log('='.repeat(50));
console.log(`HTTP server is running on http://${HOST}:${PORT}`);
console.log(`WebSocket server is running on ws://${HOST}:${PORT}`);
console.log(`Server started at: ${new Date().toISOString()}`);
console.log('='.repeat(50));
console.log('');

httpServer.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', (message: string) => {
    messageHandler.handleMessage(ws, message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
});

const shutdown = () => {
  console.log('\nShutting down server...');

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
  shutdown();
});