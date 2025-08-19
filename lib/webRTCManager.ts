import { toast } from '@/hooks/use-toast';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

const CHUNK_SIZE = 128 * 1024;

export interface BasePeer {
  id: string;
  name: string;
}

export interface WebRTCPeerConnection extends BasePeer {
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  makingOffer?: boolean;
  isIgnoringOffer?: boolean;
  polite?: boolean;
  filesToSend: Array<{ file: File; id: string; metadataSent: boolean; offset: number }>;
  receivingFileInfo?: { 
    id: string; name: string; size: number; type: string; 
    receivedBytes: number; chunks: ArrayBuffer[]; 
    senderId: string; senderName: string;
  };
}

export type WebRTCEventType = 
  | 'signalingConnected'
  | 'signalingDisconnected'
  | 'signalingError'
  | 'localIdAssigned'
  | 'peerListUpdated'
  | 'newPeerArrived'
  | 'peerLeft'
  | 'rtcConnectionStateChange'
  | 'dataChannelOpen'
  | 'dataChannelMessage'
  | 'dataChannelClose'
  | 'dataChannelError'
  | 'fileOffered'
  | 'fileAccepted'
  | 'fileRejected'
  | 'fileProgress'
  | 'fileSendComplete'
  | 'fileReceiveComplete'
  | 'peerNameChanged';

export type WebRTCEvent<T = any> = {
  type: WebRTCEventType;
  payload?: T;
};

type EventListener = (event: WebRTCEvent) => void;

class WebRTCManager {
  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, WebRTCPeerConnection>();
  private localId: string | null = null;
  private localName: string = 'Anonymous';
  private listeners: Set<EventListener> = new Set();
  private static instance: WebRTCManager;

  private constructor() {}

  public static getInstance(): WebRTCManager {
    if (!WebRTCManager.instance) {
      WebRTCManager.instance = new WebRTCManager();
    }
    return WebRTCManager.instance;
  }

  public connectSignaling(name: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.localName !== name) {
        this.localName = name;
        this.sendSignalingMessage({ type: 'update-name', name: this.localName });
      }
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.localName = name;

    let signalingUrlBase: string;

    const forceLocalSignaling = process.env.NEXT_PUBLIC_FORCE_LOCAL_SIGNALING === 'true';

    if (process.env.NODE_ENV === 'development' && forceLocalSignaling) {
      signalingUrlBase = `ws://localhost:3000/api/signaling`;
        console.log("Using LOCAL signaling server.");
    } else {
        const workerUrl = process.env.NEXT_PUBLIC_CF_WORKER_URL;
        if (!workerUrl) {
            console.error("FATAL: NEXT_PUBLIC_CF_WORKER_URL is not set!");
            toast({ title: "Configuration Error", description: "Signaling server URL is not configured.", variant: "destructive" });
            this.emitEvent({ type: 'signalingError', payload: 'Signaling server URL not configured.' });
            return; 
        }
        signalingUrlBase = workerUrl.startsWith('ws') ? workerUrl : `wss://${workerUrl}`;
        console.log("Using CLOUDFLARE signaling server:", signalingUrlBase);
    }
    const signalingUrl = `${signalingUrlBase}/?name=${encodeURIComponent(name)}`; 

    console.log(`[WebRTCManager] Attempting to connect to CF Worker signaling: ${signalingUrl}`);
    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      console.log('[WebRTCManager] Signaling WebSocket connected to CF Worker.');
    };

    this.ws.onmessage = async (event) => {
      const messageString = event.data as string;
      const message = JSON.parse(messageString);

      switch (message.type) {
        case 'registered':
          console.log('[WebRTCManager] Registration completed with ID:', message.peerId);
          this.localId = message.peerId;
          this.localName = message.yourName; 
          this.emitEvent({ type: 'localIdAssigned', payload: { id: this.localId, name: this.localName } });
          this.emitEvent({ type: 'signalingConnected' });
          this.emitEvent({ type: 'peerListUpdated', payload: message.peers });
          break;
        case 'peer-list':
          this.emitEvent({ type: 'peerListUpdated', payload: message.peers });
          break;
        case 'new-peer':
          this.emitEvent({ type: 'newPeerArrived', payload: message.peer });
          break;
        case 'peer-disconnected':
          this.cleanupPeerConnection(message.peerId); 
          this.emitEvent({ type: 'peerLeft', payload: { peerId: message.peerId } });
          break;
        case 'offer':
          await this.handleOffer(message.from, message.name, message.offer);
          break;
        case 'answer':
          await this.handleAnswer(message.from, message.answer);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.from, message.candidate);
          break;
        case 'error':
          console.error(`[WebRTCManager] Signaling Server Error from Worker: ${message.message}`);
          toast({ title: "Signaling Server Error", description: message.message, variant: "destructive" });
          this.emitEvent({ type: 'signalingError', payload: message.message });
          break;
        case 'peer-name-updated':
            this.emitEvent({ type: 'peerNameChanged', payload: { peerId: message.peerId, name: message.name } });
            const peerToUpdateNameClient = this.peerConnections.get(message.peerId);
            if (peerToUpdateNameClient) {
                peerToUpdateNameClient.name = message.name;
            }
            break;
        default:
          console.warn('[WebRTCManager] Unknown signaling message type from Worker:', message.type, message);
      }
    };

    this.ws.onerror = (errorEvent) => {
      console.error('[WebRTCManager] Signaling WebSocket error with CF Worker:', errorEvent);
      this.emitEvent({ type: 'signalingError', payload: 'WebSocket connection error with CF Worker' });
      this.ws = null;
    };

    this.ws.onclose = (closeEvent) => {
      console.log(`[WebRTCManager] Signaling WebSocket to CF Worker closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
      this.emitEvent({ type: 'signalingDisconnected' });
      this.localId = null;
      this.peerConnections.forEach(conn => this.cleanupPeerConnection(conn.id)); 
      this.peerConnections.clear();
      this.ws = null;
    };
  }

  public disconnectSignaling() {
    if (this.ws) {
      this.ws.close();
    }
  }

  public isSignalingConnected(): boolean {
    return !!(this.ws?.readyState === WebSocket.OPEN && this.localId !== null);
  }
  
  public getLocalId = () => this.localId;
  public getLocalName = () => this.localName;

  public requestPeerList() {
    if (this.isSignalingConnected()) {
      this.sendSignalingMessage({ type: 'get-peers' });
    } else {
        console.warn('[WebRTCManager] Cannot request peer list, not connected to signaling.');
    }
  }

  public addListener = (listener: EventListener) => this.listeners.add(listener);
  public removeListener = (listener: EventListener) => this.listeners.delete(listener);
  private emitEvent = (event: WebRTCEvent) => {
    this.listeners.forEach(listener => listener(event));
  }
  private sendSignalingMessage = (message: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebRTCManager] Cannot send signaling message, WebSocket not open or not connected.');
      toast({ title: "Signaling Error", description: "Cannot send message, not connected.", variant: "destructive" });
    }
  }

  private async createRTCPeerConnection(peerId: string, peerName: string, polite: boolean): Promise<WebRTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    const rtcPeer: WebRTCPeerConnection = { id: peerId, name: peerName, pc, polite, filesToSend: [] };
    this.peerConnections.set(peerId, rtcPeer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({ type: 'ice-candidate', to: peerId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.emitEvent({ type: 'rtcConnectionStateChange', payload: { peerId, state: pc.iceConnectionState } });
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        this.cleanupPeerConnection(peerId);
      }
    };
    
    pc.onnegotiationneeded = async () => {
      if (!rtcPeer.polite || rtcPeer.makingOffer || pc.signalingState !== 'stable') {
        return;
      }
      rtcPeer.makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignalingMessage({ type: 'offer', to: peerId, offer: pc.localDescription });
      } catch (err) { 
        console.error(`[WebRTCManager onnegotiationneeded] Error creating offer for ${peerId}:`, err);
      }
      finally { rtcPeer.makingOffer = false; }
    };

    pc.ondatachannel = (event) => {
      rtcPeer.dataChannel = event.channel;
      this.setupDataChannelEvents(rtcPeer);
    };

    return rtcPeer;
  }

  public async initiateConnection(peerId: string, peerName: string) {
    if (!this.localId) { 
        console.error('[WebRTCManager initiateConnection] Local ID not set, cannot initiate.');
        return; 
    }
    if (this.localId === peerId) { 
        console.warn('[WebRTCManager initiateConnection] Attempting to connect to self, aborting.');
        return; 
    }
    
    const rtcPeer = await this.createRTCPeerConnection(peerId, peerName, false);
    
    if (!rtcPeer.dataChannel) {
      const dataChannel = rtcPeer.pc.createDataChannel('fileTransfer', { ordered: true });
      rtcPeer.dataChannel = dataChannel;
      this.setupDataChannelEvents(rtcPeer);
    }

    if (rtcPeer.pc.signalingState === "stable") {
        rtcPeer.makingOffer = true;
        try {
          const offer = await rtcPeer.pc.createOffer();
          await rtcPeer.pc.setLocalDescription(offer);
          this.sendSignalingMessage({ type: 'offer', to: peerId, offer: rtcPeer.pc.localDescription });
        } catch (err) { 
          console.error(`[WebRTCManager initiateConnection] Error creating offer for ${peerId}:`, err);
          this.cleanupPeerConnection(peerId); 
        }
        finally { rtcPeer.makingOffer = false; }
    } else {
    }
  }

  private async handleOffer(fromId: string, fromName: string, offer: RTCSessionDescriptionInit) {
    const rtcPeer = this.peerConnections.get(fromId) || await this.createRTCPeerConnection(fromId, fromName, true);
    
    const offerCollision = !!(rtcPeer.makingOffer || rtcPeer.pc.signalingState !== "stable");
    rtcPeer.isIgnoringOffer = !rtcPeer.polite && offerCollision;

    if (rtcPeer.isIgnoringOffer) {
      return;
    }
    
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await rtcPeer.pc.createAnswer();
      await rtcPeer.pc.setLocalDescription(answer);
      this.sendSignalingMessage({ type: 'answer', to: fromId, answer: rtcPeer.pc.localDescription });
    } catch (err) { 
      console.error(`[WebRTCManager handleOffer] Error handling offer from ${fromId}:`, err);
    }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { 
        return; 
    }
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) { 
      console.error(`[WebRTCManager handleAnswer] Error handling answer from ${fromId}:`, err);
    }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { 
        return; 
    }
    try {
      if (candidate) {
        await rtcPeer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) { 
      if (err instanceof Error && !err.message.includes("InvalidAccessError") && !err.message.includes("Already added")) {
      }
    }
  }

  private setupDataChannelEvents(rtcPeer: WebRTCPeerConnection) {
    const { dataChannel, id: peerId } = rtcPeer;
    if (!dataChannel) {
        console.error(`[WebRTCManager setupDataChannelEvents] Data channel for peer ${peerId} is null.`);
        return;
    }

    dataChannel.onopen = () => {
      console.log(`[WebRTCManager dataChannel.onopen] Data channel OPENED for peer ${peerId}`);
      this.emitEvent({ type: 'dataChannelOpen', payload: { peerId } });
      this.sendQueuedFiles(peerId);
    };
    dataChannel.onclose = () => {
      console.log(`[WebRTCManager dataChannel.onclose] Data channel CLOSED for peer ${peerId}`);
      this.emitEvent({ type: 'dataChannelClose', payload: { peerId } });
    };
    dataChannel.onerror = (error) => {
      console.error(`[WebRTCManager dataChannel.onerror] Data channel ERROR for peer ${peerId}:`, error);
      this.emitEvent({ type: 'dataChannelError', payload: { peerId, error } });
    };
    dataChannel.onmessage = (event) => this.handleDataChannelMessage(event, rtcPeer);
  }

  private handleDataChannelMessage(event: MessageEvent, rtcPeer: WebRTCPeerConnection) {
    const { id: peerId, name: peerName } = rtcPeer;
    try {
      if (typeof event.data === 'string') {
        const isSenderContext = this.localId && this.localId !== peerId;
        const logPrefix = isSenderContext ? `[WebRTCManager SENDER processing msg from ${peerId}]` : `[WebRTCManager RECEIVER processing msg from ${peerId}]`;
        
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'file-metadata':
            rtcPeer.receivingFileInfo = { 
              ...message.payload, 
              id: message.fileId, 
              receivedBytes: 0, 
              chunks: [], 
              senderId: peerId, 
              senderName: peerName
            };
            this.emitEvent({ type: 'fileOffered', payload: { ...rtcPeer.receivingFileInfo } });
            break;
          case 'file-accept':
            this.emitEvent({ type: 'fileAccepted', payload: { fileId: message.fileId, peerId } });
            if (typeof message.fileId === 'string' && message.fileId.length > 0) {
              this.sendFileChunks(peerId, message.fileId);
            } else {
              console.error(`[WebRTCManager SENDER side, from peer ${peerId}]: Received file-accept with invalid or missing fileId:`, message.fileId);
              this.emitEvent({ type: 'fileProgress', payload: { fileId: message.fileId, peerId, progress: -1, direction: 'send' } });
            }
            break;
          case 'file-reject':
            this.emitEvent({ type: 'fileRejected', payload: { fileId: message.fileId, peerId } });
            rtcPeer.filesToSend = rtcPeer.filesToSend.filter(f => f.id !== message.fileId);
            break;
          default:
            this.emitEvent({ type: 'dataChannelMessage', payload: { peerId, message } });
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (rtcPeer.receivingFileInfo) {
          const info = rtcPeer.receivingFileInfo;
          info.chunks.push(event.data);
          info.receivedBytes += event.data.byteLength;
          const progress = (info.receivedBytes / info.size) * 100;
          this.emitEvent({ type: 'fileProgress', payload: { fileId: info.id, peerId, progress, direction: 'receive' } });

          if (info.receivedBytes === info.size) {
            const fileBlob = new Blob(info.chunks, { type: info.type });
            console.log(`[WebRTCManager RECEIVER side, from peer ${peerId}]: File receive COMPLETE for fileId: ${info.id} (${info.name})`);
            this.emitEvent({ type: 'fileReceiveComplete', payload: { fileId: info.id, peerId, name: info.name, blob: fileBlob, type: info.type } });
            rtcPeer.receivingFileInfo = undefined;
          }
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error(`[WebRTCManager SENDER/RECEIVER, peer ${peerId}]: Error processing data channel message:`, error, '\nRaw data:', event.data);
    }
  }

  public queueFileForSend(peerId: string, file: File, fileTransferId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer) { 
      console.error(`[WebRTCManager queueFileForSend] Peer connection not found for peerId: ${peerId}. Cannot queue file: ${file.name}`);
      this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      return; 
    }
    
    rtcPeer.filesToSend.push({ file, id: fileTransferId, metadataSent: false, offset: 0 });
    
    if (rtcPeer.dataChannel && rtcPeer.dataChannel.readyState === 'open') {
      this.sendQueuedFiles(peerId);
    } else {
    }
  }

  private sendQueuedFiles(peerId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer || !rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open') {
      return;
    }

    const fileDetail = rtcPeer.filesToSend.find(f => !f.metadataSent);
    if (fileDetail) {
      const metadata = {
        type: 'file-metadata',
        fileId: fileDetail.id,
        payload: { name: fileDetail.file.name, size: fileDetail.file.size, type: fileDetail.file.type },
      };
      const metadataString = JSON.stringify(metadata);
      try {
        rtcPeer.dataChannel.send(metadataString);
        fileDetail.metadataSent = true;
      } catch (e) {
        console.error(`[WebRTCManager sendQueuedFiles] Error sending metadata for ${fileDetail.id} to ${peerId}:`, e);
      }
    } else {
    }
  }
  
  public acceptFileOffer(peerId: string, fileId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-accept', fileId }));
    } else {
    }
  }

  public rejectFileOffer(peerId: string, fileId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-reject', fileId }));
    } else {
    }

    if (rtcPeer && rtcPeer.receivingFileInfo && rtcPeer.receivingFileInfo.id === fileId) {
      rtcPeer.receivingFileInfo = undefined;
    }
  }

  private async sendFileChunks(peerId: string, fileTransferId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    
    if (!rtcPeer) {
      console.error(`[WebRTCManager SENDER sendFileChunks] rtcPeer not found for peerId: ${peerId}`);
      if (typeof fileTransferId === 'string' && fileTransferId.length > 0) {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      }
      return;
    }

    const fileDetail = (typeof fileTransferId === 'string' && fileTransferId.length > 0)
                       ? rtcPeer.filesToSend.find(f => f.id === fileTransferId) 
                       : undefined;


    if (!rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open' || !fileDetail) {
      console.error(`[WebRTCManager SENDER sendFileChunks] Cannot send file chunks - missing prerequisites. Peer: ${!!rtcPeer}, DataChannel: ${!!rtcPeer.dataChannel}, DC.readyState: ${rtcPeer.dataChannel?.readyState}, FileDetail: ${!!fileDetail}`);
      if (typeof fileTransferId === 'string' && fileTransferId.length > 0) {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      }
      return;
    }
    
    const { file } = fileDetail;

    const sendChunk = () => {
      if (!rtcPeer.dataChannel) {
        console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel for peer ${peerId} became null. Aborting fileId: ${fileTransferId}.`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        return;
      }
      if (rtcPeer.dataChannel.readyState !== 'open') {
        console.warn(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel for peer ${peerId} no longer open (state: ${rtcPeer.dataChannel.readyState}). Aborting fileId: ${fileTransferId}`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        return;
      }

      if (fileDetail.offset < file.size) {
        if (rtcPeer.dataChannel.bufferedAmount > CHUNK_SIZE * 10) {
          setTimeout(sendChunk, 50);
          return;
        }

        const chunkEnd = Math.min(fileDetail.offset + CHUNK_SIZE, file.size);
        const chunk = file.slice(fileDetail.offset, chunkEnd);
        const reader = new FileReader();
        
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            if (rtcPeer.dataChannel && rtcPeer.dataChannel.readyState === 'open') {
              try {
                rtcPeer.dataChannel.send(reader.result);
                fileDetail.offset += reader.result.byteLength;
                const progress = (fileDetail.offset / file.size) * 100;
                this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress, direction: 'send' } });
                
                if (fileDetail.offset < file.size) {
                    requestAnimationFrame(sendChunk);
                } else {
                }

              } catch (e) {
                console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] Error sending chunk for ${fileDetail.id}:`, e);
                this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
              }
            } else {
              this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
            }
          } else {
            console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] FileReader result not ArrayBuffer for ${fileDetail.id}`);
            this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
          }
        };
        reader.onerror = (e) => {
          console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] FileReader error for ${fileDetail.id}:`, e);
          this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        };
        reader.readAsArrayBuffer(chunk);
      } else if (fileDetail.offset >= file.size) {
        console.log(`[WebRTCManager SENDER sendFileChunks sendChunk] File send COMPLETE: "${file.name}" (ID: ${fileDetail.id})`);
        this.emitEvent({ type: 'fileSendComplete', payload: { fileId: fileTransferId, peerId, name: file.name } });
        rtcPeer.filesToSend = rtcPeer.filesToSend.filter(f => f.id !== fileTransferId);
        this.sendQueuedFiles(peerId); 
      }
    };
    requestAnimationFrame(sendChunk);
  }

  public cleanupPeerConnection(peerId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer) {
      if (rtcPeer.dataChannel) {
        rtcPeer.dataChannel.close();
      }
      rtcPeer.pc.close();
      this.peerConnections.delete(peerId);
      
      rtcPeer.filesToSend.forEach(f => {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: f.id, peerId, progress: -1, direction: 'send' } });
      });
      if (rtcPeer.receivingFileInfo) {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: rtcPeer.receivingFileInfo.id, peerId, progress: -1, direction: 'receive' } });
      }
    } else {
    }
  }

  public getPeerConnection = (peerId: string) => this.peerConnections.get(peerId);
}

export default WebRTCManager.getInstance();