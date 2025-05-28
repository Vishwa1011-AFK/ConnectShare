import { toast } from '@/hooks/use-toast';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

const CHUNK_SIZE = 16 * 1024; // 16KB

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
  | 'dataChannelMessage' // For generic string messages if any
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
    console.log(`[WebRTCManager] connectSignaling called with name: ${name}`);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.localName !== name) {
        console.log(`[WebRTCManager] Signaling already open, updating name from ${this.localName} to ${name}`);
        this.localName = name;
        this.sendSignalingMessage({ type: 'update-name', name: this.localName });
      } else {
        console.log(`[WebRTCManager] Signaling already open and name is the same: ${name}`);
      }
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING)) {
      console.log(`[WebRTCManager] Signaling connection already in progress.`);
      return;
    }

    this.localName = name;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const signalingUrl = `${protocol}//${host}/api/signaling?name=${encodeURIComponent(name)}`;
    console.log(`[WebRTCManager] Attempting to connect to signaling server: ${signalingUrl}`);

    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      console.log('[WebRTCManager] Signaling WebSocket connected.');
      this.emitEvent({ type: 'signalingConnected' });
    };

    this.ws.onmessage = async (event) => {
      const messageString = event.data as string;
      console.log(`[WebRTCManager] Received signaling message: ${messageString}`);
      const message = JSON.parse(messageString);

      switch (message.type) {
        case 'registered':
          this.localId = message.peerId;
          this.localName = message.yourName; // Server might sanitize/confirm name
          console.log(`[WebRTCManager] Registered with ID: ${this.localId}, Name: ${this.localName}`);
          this.emitEvent({ type: 'localIdAssigned', payload: { id: this.localId, name: this.localName } });
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
          console.error(`[WebRTCManager] Signaling Server Error: ${message.message}`);
          toast({ title: "Signaling Server Error", description: message.message, variant: "destructive" });
          this.emitEvent({ type: 'signalingError', payload: message.message });
          break;
        case 'peer-name-updated':
            console.log(`[WebRTCManager] Peer name updated event from signaling: peerId=${message.peerId}, name=${message.name}`);
            this.emitEvent({ type: 'peerNameChanged', payload: { peerId: message.peerId, name: message.name } });
            // Also update internal state if we have a connection to this peer
            const peerToUpdateName = this.peerConnections.get(message.peerId);
            if (peerToUpdateName) {
                peerToUpdateName.name = message.name;
            }
            break;
        default:
          console.warn('[WebRTCManager] Unknown signaling message type:', message.type);
      }
    };

    this.ws.onerror = (errorEvent) => {
      console.error('[WebRTCManager] Signaling WebSocket error:', errorEvent);
      this.emitEvent({ type: 'signalingError', payload: 'WebSocket connection error' });
      this.ws = null; // Ensure ws is nullified on error
    };

    this.ws.onclose = (closeEvent) => {
      console.log(`[WebRTCManager] Signaling WebSocket closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
      this.emitEvent({ type: 'signalingDisconnected' });
      this.localId = null;
      this.peerConnections.forEach(conn => this.cleanupPeerConnection(conn.id)); // Cleanup all connections
      this.peerConnections.clear();
      this.ws = null;
    };
  }

  public disconnectSignaling() {
    console.log('[WebRTCManager] disconnectSignaling called.');
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
    console.log('[WebRTCManager] requestPeerList called.');
    if (this.isSignalingConnected()) {
      this.sendSignalingMessage({ type: 'get-peers' });
    } else {
        console.warn('[WebRTCManager] Cannot request peer list, not connected to signaling.');
    }
  }

  public addListener = (listener: EventListener) => this.listeners.add(listener);
  public removeListener = (listener: EventListener) => this.listeners.delete(listener);
  private emitEvent = (event: WebRTCEvent) => {
    // console.log(`[WebRTCManager] Emitting event: ${event.type}`, event.payload !== undefined ? event.payload : '');
    this.listeners.forEach(listener => listener(event));
  }
  private sendSignalingMessage = (message: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[WebRTCManager] Sending signaling message:`, message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebRTCManager] Cannot send signaling message, WebSocket not open or not connected.');
      toast({ title: "Signaling Error", description: "Cannot send message, not connected.", variant: "destructive" });
    }
  }

  private async createRTCPeerConnection(peerId: string, peerName: string, polite: boolean): Promise<WebRTCPeerConnection> {
    console.log(`[WebRTCManager createRTCPeerConnection] For peerId: ${peerId}, peerName: ${peerName}, polite: ${polite}`);
    if (this.peerConnections.has(peerId)) {
      console.log(`[WebRTCManager createRTCPeerConnection] Found existing connection for ${peerId}.`);
      return this.peerConnections.get(peerId)!;
    }
    console.log(`[WebRTCManager createRTCPeerConnection] Creating new RTCPeerConnection for ${peerId}.`);

    const pc = new RTCPeerConnection(STUN_SERVERS);
    const rtcPeer: WebRTCPeerConnection = { id: peerId, name: peerName, pc, polite, filesToSend: [] };
    this.peerConnections.set(peerId, rtcPeer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTCManager onicecandidate] Sending ICE candidate for ${peerId} to signaling server.`);
        this.sendSignalingMessage({ type: 'ice-candidate', to: peerId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTCManager oniceconnectionstatechange] Peer ${peerId} ICE state: ${pc.iceConnectionState}`);
      this.emitEvent({ type: 'rtcConnectionStateChange', payload: { peerId, state: pc.iceConnectionState } });
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        console.log(`[WebRTCManager oniceconnectionstatechange] Cleaning up peer connection for ${peerId} due to state: ${pc.iceConnectionState}`);
        this.cleanupPeerConnection(peerId);
      }
    };
    
    pc.onnegotiationneeded = async () => {
      console.log(`[WebRTCManager onnegotiationneeded] For peer ${peerId}. Polite: ${rtcPeer.polite}, Making Offer: ${rtcPeer.makingOffer}, Signaling State: ${pc.signalingState}`);
      if (!rtcPeer.polite || rtcPeer.makingOffer || pc.signalingState !== 'stable') {
        console.log(`[WebRTCManager onnegotiationneeded] Skipping negotiation for ${peerId}.`);
        return;
      }
      rtcPeer.makingOffer = true;
      console.log(`[WebRTCManager onnegotiationneeded] Making offer for ${peerId}.`);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[WebRTCManager onnegotiationneeded] Sending offer for ${peerId} to signaling server.`);
        this.sendSignalingMessage({ type: 'offer', to: peerId, offer: pc.localDescription });
      } catch (err) { 
        console.error(`[WebRTCManager onnegotiationneeded] Error creating offer for ${peerId}:`, err);
      }
      finally { rtcPeer.makingOffer = false; }
    };

    pc.ondatachannel = (event) => {
      console.log(`[WebRTCManager ondatachannel] Received data channel from ${peerId}: ${event.channel.label}`);
      rtcPeer.dataChannel = event.channel;
      this.setupDataChannelEvents(rtcPeer);
      // Note: dataChannelOpen event is emitted inside setupDataChannelEvents's onopen
    };

    return rtcPeer;
  }

  public async initiateConnection(peerId: string, peerName: string) {
    console.log(`[WebRTCManager initiateConnection] To peerId: ${peerId}, peerName: ${peerName}`);
    if (!this.localId) { 
        console.error('[WebRTCManager initiateConnection] Local ID not set, cannot initiate.');
        return; 
    }
    if (this.localId === peerId) { 
        console.warn('[WebRTCManager initiateConnection] Attempting to connect to self, aborting.');
        return; 
    }
    
    const rtcPeer = await this.createRTCPeerConnection(peerId, peerName, false); // Initiator is not polite by default
    
    if (!rtcPeer.dataChannel) {
      console.log(`[WebRTCManager initiateConnection] Creating data channel for ${peerId}.`);
      const dataChannel = rtcPeer.pc.createDataChannel('fileTransfer', { ordered: true });
      rtcPeer.dataChannel = dataChannel;
      this.setupDataChannelEvents(rtcPeer);
    } else {
        console.log(`[WebRTCManager initiateConnection] Data channel already exists for ${peerId}.`);
    }

    // Only create and send offer if signaling state allows
    if (rtcPeer.pc.signalingState === "stable") {
        rtcPeer.makingOffer = true;
        console.log(`[WebRTCManager initiateConnection] Creating and sending offer to ${peerId}.`);
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
        console.warn(`[WebRTCManager initiateConnection] Signaling state for ${peerId} is not stable (${rtcPeer.pc.signalingState}), not creating offer now. onnegotiationneeded should handle it.`);
    }
  }

  private async handleOffer(fromId: string, fromName: string, offer: RTCSessionDescriptionInit) {
    console.log(`[WebRTCManager handleOffer] From peerId: ${fromId}, peerName: ${fromName}`);
    const rtcPeer = this.peerConnections.get(fromId) || await this.createRTCPeerConnection(fromId, fromName, true); // Receiver is polite
    
    const offerCollision = !!(rtcPeer.makingOffer || rtcPeer.pc.signalingState !== "stable");
    rtcPeer.isIgnoringOffer = !rtcPeer.polite && offerCollision;

    if (rtcPeer.isIgnoringOffer) {
      console.log(`[WebRTCManager handleOffer] Ignoring offer from ${fromId} due to collision and not being polite.`);
      return;
    }
    
    console.log(`[WebRTCManager handleOffer] Processing offer from ${fromId}.`);
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await rtcPeer.pc.createAnswer();
      await rtcPeer.pc.setLocalDescription(answer);
      console.log(`[WebRTCManager handleOffer] Sending answer to ${fromId}.`);
      this.sendSignalingMessage({ type: 'answer', to: fromId, answer: rtcPeer.pc.localDescription });
    } catch (err) { 
      console.error(`[WebRTCManager handleOffer] Error handling offer from ${fromId}:`, err);
    }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    console.log(`[WebRTCManager handleAnswer] From peerId: ${fromId}`);
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { 
        console.warn(`[WebRTCManager handleAnswer] Peer ${fromId} not found.`);
        return; 
    }
    console.log(`[WebRTCManager handleAnswer] Processing answer from ${fromId}.`);
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) { 
      console.error(`[WebRTCManager handleAnswer] Error handling answer from ${fromId}:`, err);
    }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    console.log(`[WebRTCManager handleIceCandidate] From peerId: ${fromId}`);
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { 
        console.warn(`[WebRTCManager handleIceCandidate] Peer ${fromId} not found.`);
        return; 
    }
    try {
      if (candidate) {
        console.log(`[WebRTCManager handleIceCandidate] Adding ICE candidate for ${fromId}.`);
        await rtcPeer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) { 
      // Not a critical error if candidate is null or already added
      if (err instanceof Error && !err.message.includes("InvalidAccessError") && !err.message.includes("Already added")) {
        console.warn(`[WebRTCManager handleIceCandidate] Error handling ICE candidate from ${fromId}:`, err);
      }
    }
  }

  private setupDataChannelEvents(rtcPeer: WebRTCPeerConnection) {
    const { dataChannel, id: peerId } = rtcPeer;
    if (!dataChannel) {
        console.error(`[WebRTCManager setupDataChannelEvents] Data channel for peer ${peerId} is null.`);
        return;
    }
    console.log(`[WebRTCManager setupDataChannelEvents] Setting up events for data channel with ${peerId}. Current state: ${dataChannel.readyState}`);

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
        const isSenderContext = this.localId && this.localId !== peerId; // Heuristic
        const logPrefix = isSenderContext ? `[WebRTCManager SENDER processing msg from ${peerId}]` : `[WebRTCManager RECEIVER processing msg from ${peerId}]`;
        
        console.log(`${logPrefix}: Raw string: ${event.data}`);
        const message = JSON.parse(event.data);
        console.log(`${logPrefix}: Parsed:`, message);
        
        switch (message.type) {
          case 'file-metadata': // This case is primarily for the RECEIVER
            console.log(`[WebRTCManager RECEIVER side, peer ${peerId}]: file-metadata received. Accessing message.fileId: "${message.fileId}" (Type: ${typeof message.fileId})`);
            rtcPeer.receivingFileInfo = { 
              ...message.payload, 
              id: message.fileId, 
              receivedBytes: 0, 
              chunks: [], 
              senderId: peerId, 
              senderName: peerName // Name of the peer who sent the metadata
            };
            this.emitEvent({ type: 'fileOffered', payload: { ...rtcPeer.receivingFileInfo } });
            break;
          case 'file-accept': // This case is primarily for the SENDER
            console.log(`[WebRTCManager SENDER side, from peer ${peerId}]: file-accept received for fileId: "${message.fileId}" (Type: ${typeof message.fileId})`);
            this.emitEvent({ type: 'fileAccepted', payload: { fileId: message.fileId, peerId } });
            if (typeof message.fileId === 'string' && message.fileId.length > 0) {
              this.sendFileChunks(peerId, message.fileId);
            } else {
              console.error(`[WebRTCManager SENDER side, from peer ${peerId}]: Received file-accept with invalid or missing fileId:`, message.fileId);
              this.emitEvent({ type: 'fileProgress', payload: { fileId: message.fileId, peerId, progress: -1, direction: 'send' } });
            }
            break;
          case 'file-reject': // This case is primarily for the SENDER
            console.log(`[WebRTCManager SENDER side, from peer ${peerId}]: file-reject received for fileId: "${message.fileId}"`);
            this.emitEvent({ type: 'fileRejected', payload: { fileId: message.fileId, peerId } });
            rtcPeer.filesToSend = rtcPeer.filesToSend.filter(f => f.id !== message.fileId);
            break;
          default: // For generic string messages if any
            console.log(`${logPrefix}: Unhandled string message type: ${message.type}`);
            this.emitEvent({ type: 'dataChannelMessage', payload: { peerId, message } });
        }
      } else if (event.data instanceof ArrayBuffer) { // This case is primarily for the RECEIVER
        console.log(`[WebRTCManager RECEIVER side, from peer ${peerId}]: Received ArrayBuffer chunk. Size: ${event.data.byteLength}`);
        if (rtcPeer.receivingFileInfo) {
          const info = rtcPeer.receivingFileInfo;
          console.log(`[WebRTCManager RECEIVER side, from peer ${peerId}]: Current receivingFileInfo for ${info.name} (fileId: ${info.id}): received ${info.receivedBytes} / ${info.size} bytes.`);
          info.chunks.push(event.data);
          info.receivedBytes += event.data.byteLength;
          const progress = (info.receivedBytes / info.size) * 100;
          this.emitEvent({ type: 'fileProgress', payload: { fileId: info.id, peerId, progress, direction: 'receive' } });

          if (info.receivedBytes === info.size) {
            const fileBlob = new Blob(info.chunks, { type: info.type });
            console.log(`[WebRTCManager RECEIVER side, from peer ${peerId}]: File receive COMPLETE for fileId: ${info.id} (${info.name})`);
            this.emitEvent({ type: 'fileReceiveComplete', payload: { fileId: info.id, peerId, name: info.name, blob: fileBlob, type: info.type } });
            rtcPeer.receivingFileInfo = undefined; // Clear info for next file
          }
        } else {
            console.warn(`[WebRTCManager RECEIVER side, from peer ${peerId}]: Received ArrayBuffer chunk but no receivingFileInfo is set. This chunk will be discarded.`);
        }
      } else {
        console.warn(`[WebRTCManager SENDER/RECEIVER, peer ${peerId}]: Received unknown data type on data channel:`, event.data);
      }
    } catch (error) {
      console.error(`[WebRTCManager SENDER/RECEIVER, peer ${peerId}]: Error processing data channel message:`, error, '\nRaw data:', event.data);
    }
  }

  public queueFileForSend(peerId: string, file: File, fileTransferId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer) { 
      console.error(`[WebRTCManager queueFileForSend] Peer connection not found for peerId: ${peerId}. Cannot queue file: ${file.name}`);
      this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } }); // Emit error
      return; 
    }
    
    console.log(`[WebRTCManager queueFileForSend] Queueing file "${file.name}" (ID: ${fileTransferId}) for peer ${peerId}`);
    rtcPeer.filesToSend.push({ file, id: fileTransferId, metadataSent: false, offset: 0 });
    
    if (rtcPeer.dataChannel && rtcPeer.dataChannel.readyState === 'open') {
      console.log(`[WebRTCManager queueFileForSend] Data channel for ${peerId} is open, attempting to send queued files.`);
      this.sendQueuedFiles(peerId);
    } else {
      console.log(`[WebRTCManager queueFileForSend] Data channel for ${peerId} not ready (state: ${rtcPeer.dataChannel?.readyState}). File "${file.name}" will be sent when ready.`);
      // No toast here, context layer might handle this UI feedback
    }
  }

  private sendQueuedFiles(peerId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer || !rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open') {
      console.warn(`[WebRTCManager sendQueuedFiles] Cannot send queued files for ${peerId} - data channel not ready or peer not found. DC state: ${rtcPeer?.dataChannel?.readyState}`);
      return;
    }

    const fileDetail = rtcPeer.filesToSend.find(f => !f.metadataSent);
    if (fileDetail) {
      console.log(`[WebRTCManager sendQueuedFiles] Found file to send metadata for: "${fileDetail.file.name}" (ID: ${fileDetail.id}) to peer ${peerId}`);
      const metadata = {
        type: 'file-metadata',
        fileId: fileDetail.id,
        payload: { name: fileDetail.file.name, size: fileDetail.file.size, type: fileDetail.file.type },
      };
      const metadataString = JSON.stringify(metadata);
      console.log(`[WebRTCManager sendQueuedFiles] Sending metadata string to ${peerId}: ${metadataString}`);
      try {
        rtcPeer.dataChannel.send(metadataString);
        fileDetail.metadataSent = true; // Mark as sent only after successful send
      } catch (e) {
        console.error(`[WebRTCManager sendQueuedFiles] Error sending metadata for ${fileDetail.id} to ${peerId}:`, e);
        // Do not mark as sent, it will be retried or fail if channel closes
      }
    } else {
        console.log(`[WebRTCManager sendQueuedFiles] No files with unsent metadata in queue for peer ${peerId}.`);
    }
  }
  
  public acceptFileOffer(peerId: string, fileId: string) {
    console.log(`[WebRTCManager acceptFileOffer] For peerId: ${peerId}, fileId: "${fileId}"`);
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      console.log(`[WebRTCManager acceptFileOffer] Sending file-accept for fileId: "${fileId}" to peer ${peerId}`);
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-accept', fileId }));
    } else {
      console.warn(`[WebRTCManager acceptFileOffer] Cannot send file-accept for fileId: "${fileId}" to peer ${peerId}. Data channel not open (state: ${rtcPeer?.dataChannel?.readyState})`);
    }
    // Do not clear receivingFileInfo here, clear it after successful reception or explicit rejection/error
  }

  public rejectFileOffer(peerId: string, fileId: string) {
    console.log(`[WebRTCManager rejectFileOffer] For peerId: ${peerId}, fileId: "${fileId}"`);
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      console.log(`[WebRTCManager rejectFileOffer] Sending file-reject for fileId: "${fileId}" to peer ${peerId}`);
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-reject', fileId }));
    } else {
        console.warn(`[WebRTCManager rejectFileOffer] Cannot send file-reject for fileId: "${fileId}" to peer ${peerId}. Data channel not open (state: ${rtcPeer?.dataChannel?.readyState})`);
    }

    if (rtcPeer && rtcPeer.receivingFileInfo && rtcPeer.receivingFileInfo.id === fileId) {
      console.log(`[WebRTCManager rejectFileOffer] Clearing receivingFileInfo for rejected fileId: "${fileId}"`);
      rtcPeer.receivingFileInfo = undefined;
    }
  }

  private async sendFileChunks(peerId: string, fileTransferId: string) {
    console.log(`[WebRTCManager SENDER sendFileChunks] Called for peerId: ${peerId}, fileTransferId: "${fileTransferId}" (Type: ${typeof fileTransferId})`);
    const rtcPeer = this.peerConnections.get(peerId);
    
    if (rtcPeer) {
      console.log(`[WebRTCManager SENDER sendFileChunks] rtcPeer.filesToSend for peer ${peerId}:`, JSON.stringify(rtcPeer.filesToSend.map(f => ({ id: f.id, name: f.file.name, metadataSent: f.metadataSent, offset: f.offset }))));
    } else {
      console.error(`[WebRTCManager SENDER sendFileChunks] rtcPeer not found for peerId: ${peerId}`);
      // Emit error if fileTransferId was valid, as the attempt was made for a known transfer
      if (typeof fileTransferId === 'string' && fileTransferId.length > 0) {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      }
      return;
    }

    const fileDetail = (typeof fileTransferId === 'string' && fileTransferId.length > 0)
                       ? rtcPeer.filesToSend.find(f => f.id === fileTransferId) 
                       : undefined;

    console.log(`[WebRTCManager SENDER sendFileChunks] Found fileDetail:`, fileDetail ? {id: fileDetail.id, name: fileDetail.file.name, offset: fileDetail.offset} : 'NOT FOUND');

    if (!rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open' || !fileDetail) {
      console.error(`[WebRTCManager SENDER sendFileChunks] Cannot send file chunks - missing prerequisites. Peer: ${!!rtcPeer}, DataChannel: ${!!rtcPeer.dataChannel}, DC.readyState: ${rtcPeer.dataChannel?.readyState}, FileDetail: ${!!fileDetail}`);
      if (typeof fileTransferId === 'string' && fileTransferId.length > 0) {
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      }
      return;
    }
    
    console.log(`[WebRTCManager SENDER sendFileChunks] Starting to send file chunks for: "${fileDetail.file.name}" (ID: ${fileDetail.id})`);
    const { file } = fileDetail;

    const sendChunk = () => {
      if (!rtcPeer.dataChannel) {
        console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel for peer ${peerId} became null during send. Aborting fileId: ${fileTransferId}.`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        return;
      }
      if (rtcPeer.dataChannel.readyState !== 'open') {
        console.warn(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel for peer ${peerId} is no longer open (state: ${rtcPeer.dataChannel.readyState}). Aborting send for fileId: ${fileTransferId}`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        return;
      }

      if (fileDetail.offset < file.size) {
        // Buffer management: Check if buffer is too full
        if (rtcPeer.dataChannel.bufferedAmount > CHUNK_SIZE * 10) { // e.g., 10 chunks buffer
          console.log(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel buffer full for fileId ${fileDetail.id} (buffered: ${rtcPeer.dataChannel.bufferedAmount} bytes). Waiting...`);
          setTimeout(sendChunk, 50); // Wait for buffer to clear slightly
          return;
        }

        const chunkEnd = Math.min(fileDetail.offset + CHUNK_SIZE, file.size);
        const chunk = file.slice(fileDetail.offset, chunkEnd);
        const reader = new FileReader();
        
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            if (rtcPeer.dataChannel && rtcPeer.dataChannel.readyState === 'open') {
              try {
                // console.log(`[WebRTCManager SENDER sendFileChunks sendChunk] Sending chunk for ${fileDetail.id}: offset ${fileDetail.offset}, size ${reader.result.byteLength}`);
                rtcPeer.dataChannel.send(reader.result);
                fileDetail.offset += reader.result.byteLength;
                const progress = (fileDetail.offset / file.size) * 100;
                this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress, direction: 'send' } });
                
                if (fileDetail.offset < file.size) {
                    requestAnimationFrame(sendChunk); // Continue sending
                } else {
                    // This means all chunks are sent, handled by the else if below
                }

              } catch (e) {
                console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] Error sending chunk for ${fileDetail.id}:`, e);
                this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
              }
            } else {
              console.warn(`[WebRTCManager SENDER sendFileChunks sendChunk] Data channel for ${fileDetail.id} closed or not available during chunk send (readyState: ${rtcPeer.dataChannel?.readyState})`);
              this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
            }
          } else {
            console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] FileReader result is not ArrayBuffer for ${fileDetail.id}`);
            this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
          }
        };
        reader.onerror = (e) => {
          console.error(`[WebRTCManager SENDER sendFileChunks sendChunk] FileReader error for ${fileDetail.id}:`, e);
          this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        };
        reader.readAsArrayBuffer(chunk);
      } else if (fileDetail.offset >= file.size) { // All chunks sent
        console.log(`[WebRTCManager SENDER sendFileChunks sendChunk] File send COMPLETE: "${file.name}" (ID: ${fileDetail.id})`);
        this.emitEvent({ type: 'fileSendComplete', payload: { fileId: fileTransferId, peerId, name: file.name } });
        // Remove the completed file from the queue
        rtcPeer.filesToSend = rtcPeer.filesToSend.filter(f => f.id !== fileTransferId);
        // Check if there are more files to send for this peer
        this.sendQueuedFiles(peerId); 
      }
    };
    requestAnimationFrame(sendChunk); // Start the sending loop
  }

  public cleanupPeerConnection(peerId: string) {
    console.log(`[WebRTCManager cleanupPeerConnection] For peerId: ${peerId}`);
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer) {
      if (rtcPeer.dataChannel) {
        console.log(`[WebRTCManager cleanupPeerConnection] Closing data channel for ${peerId}`);
        rtcPeer.dataChannel.close();
        // dataChannelClose event will be emitted by the onclose handler
      }
      console.log(`[WebRTCManager cleanupPeerConnection] Closing RTCPeerConnection for ${peerId}`);
      rtcPeer.pc.close();
      this.peerConnections.delete(peerId);
      // Emit peerLeft after fully cleaning up locally
      // The oniceconnectionstatechange handler might also emit peerLeft or rtcConnectionStateChange
      // this.emitEvent({ type: 'peerLeft', payload: { peerId } }); // This might be redundant if oniceconnectionstatechange handles it
      
      // Mark any pending or in-progress file transfers for this peer as errored
      rtcPeer.filesToSend.forEach(f => {
        console.log(`[WebRTCManager cleanupPeerConnection] Marking queued send file ${f.id} as error for peer ${peerId}`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: f.id, peerId, progress: -1, direction: 'send' } });
      });
      if (rtcPeer.receivingFileInfo) {
        console.log(`[WebRTCManager cleanupPeerConnection] Marking receiving file ${rtcPeer.receivingFileInfo.id} as error for peer ${peerId}`);
        this.emitEvent({ type: 'fileProgress', payload: { fileId: rtcPeer.receivingFileInfo.id, peerId, progress: -1, direction: 'receive' } });
      }
    } else {
        console.log(`[WebRTCManager cleanupPeerConnection] No active connection found for peerId: ${peerId}`);
    }
  }

  public getPeerConnection = (peerId: string) => this.peerConnections.get(peerId);
}

export default WebRTCManager.getInstance();