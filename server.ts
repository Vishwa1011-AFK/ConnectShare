import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

type PeerData = {
  id: string;
  name: string;
  ws: WebSocket;
};
const peers = new Map<string, PeerData>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getPeerList(excludeId?: string): Array<{ id: string; name: string }> {
  return Array.from(peers.values())
    .filter(p => p.id !== excludeId)
    .map(p => ({ id: p.id, name: p.name }));
}

function broadcast(message: any, excludeId?: string) {
  const messageString = JSON.stringify(message);
  peers.forEach(peer => {
    if (peer.id !== excludeId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(messageString);
    }
  });
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url!, true);

    if (pathname === '/api/signaling') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request) => {
    const peerId = generateId();
    const urlParams = new URLSearchParams(request.url?.split('?')[1] || '');
    const peerName = decodeURIComponent(urlParams.get('name') || `Peer-${peerId.substring(0, 4)}`);
    
    console.log(`Peer connected: ${peerName} (ID: ${peerId})`);

    const newPeer: PeerData = { id: peerId, name: peerName, ws };
    peers.set(peerId, newPeer);

    ws.send(JSON.stringify({ 
      type: 'registered', 
      peerId, 
      yourName: newPeer.name,
      peers: getPeerList(peerId) 
    }));

    broadcast({ type: 'new-peer', peer: { id: newPeer.id, name: newPeer.name } }, peerId);

    ws.on('message', (messageBuffer) => {
      const messageString = messageBuffer.toString();
      console.log(`Received message from ${peerId}: ${messageString}`);
      try {
        const parsedMessage = JSON.parse(messageString);
        switch (parsedMessage.type) {
          case 'offer':
          case 'answer':
          case 'ice-candidate':
            const targetPeer = peers.get(parsedMessage.to);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(JSON.stringify({
                ...parsedMessage,
                from: peerId,
                name: newPeer.name
              }));
            } else {
              ws.send(JSON.stringify({type: 'error', message: `Peer ${parsedMessage.to} not available.`}));
            }
            break;
          case 'get-peers':
            ws.send(JSON.stringify({ type: 'peer-list', peers: getPeerList(peerId) }));
            break;
          case 'update-name':
            if (parsedMessage.name) {
                newPeer.name = parsedMessage.name;
                peers.set(peerId, newPeer);
                console.log(`Peer name updated: ${newPeer.name} (ID: ${peerId})`);
                broadcast({ type: 'peer-name-updated', peerId, name: newPeer.name }, peerId);
                ws.send(JSON.stringify({ type: 'name-updated-ack', name: newPeer.name }));
            }
            break;
          default:
            console.warn(`Unknown message type from ${peerId}: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error(`Failed to parse message from ${peerId}:`, error);
        ws.send(JSON.stringify({type: 'error', message: 'Invalid message format.'}));
      }
    });

    ws.on('close', () => {
      console.log(`Peer disconnected: ${newPeer.name} (ID: ${peerId})`);
      peers.delete(peerId);
      broadcast({ type: 'peer-disconnected', peerId }, peerId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for peer ${peerId}:`, error);
      if (peers.has(peerId)) {
        peers.delete(peerId);
        broadcast({ type: 'peer-disconnected', peerId }, peerId);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> WebSocket server listening on ws://localhost:${port}/api/signaling`);
  });
});
