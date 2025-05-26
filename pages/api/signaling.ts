import { WebSocketServer, WebSocket } from 'ws';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

interface WebSocketServerWithNextJs extends HTTPServer {
  wss?: WebSocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: WebSocketServerWithNextJs;
  };
}

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

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (req.method === 'GET') {
    if (!res.socket.server.wss) {
      const wss = new WebSocketServer({ noServer: true });
      res.socket.server.wss = wss;

      wss.on('connection', (ws: WebSocket, request) => {
        const peerId = generateId();
        const requestUrl = request.url || '';
        const urlParams = new URLSearchParams(requestUrl.split('?')[1]);
        const peerName = decodeURIComponent(urlParams.get('name') || `Peer-${peerId.substring(0, 4)}`);
        
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
                    broadcast({ type: 'peer-name-updated', peerId, name: newPeer.name }, peerId);
                    ws.send(JSON.stringify({ type: 'name-updated-ack', name: newPeer.name }));
                }
                break;
              default:
            }
          } catch (error) {
            ws.send(JSON.stringify({type: 'error', message: 'Invalid message format.'}));
          }
        });

        ws.on('close', () => {
          peers.delete(peerId);
          broadcast({ type: 'peer-disconnected', peerId }, peerId);
        });

        ws.on('error', (error) => {
          if (peers.has(peerId)) {
            peers.delete(peerId);
            broadcast({ type: 'peer-disconnected', peerId }, peerId);
          }
        });
      });

      res.socket.server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (wsClient) => {
          wss.emit('connection', wsClient, request);
        });
      });
    }
    res.end();
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
