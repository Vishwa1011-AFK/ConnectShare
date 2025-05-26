import { toast } from '@/hooks/use-toast';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

const CHUNK_SIZE = 16 * 1024;

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
  | 'fileReceiveComplete';

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const signalingUrl = `${protocol}//${host}/api/signaling?name=${encodeURIComponent(name)}`;

    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      this.emitEvent({ type: 'signalingConnected' });
    };

    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data as string);

      switch (message.type) {
        case 'registered':
          this.localId = message.peerId;
          this.localName = message.yourName;
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
          toast({ title: "Signaling Server Error", description: message.message, variant: "destructive" });
          break;
        default:
          console.warn('Unknown signaling message type:', message.type);
      }
    };

    this.ws.onerror = (error) => {
      this.emitEvent({ type: 'signalingError', payload: 'Connection error' });
      this.ws = null;
    };

    this.ws.onclose = () => {
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
    return this.ws?.readyState === WebSocket.OPEN && this.localId !== null;
  }
  
  public getLocalId = () => this.localId;
  public getLocalName = () => this.localName;

  public addListener = (listener: EventListener) => this.listeners.add(listener);
  public removeListener = (listener: EventListener) => this.listeners.delete(listener);
  private emitEvent = (event: WebRTCEvent) => this.listeners.forEach(listener => listener(event));
  private sendSignalingMessage = (message: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
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
      if (!rtcPeer.polite || rtcPeer.makingOffer || pc.signalingState !== 'stable') return;
      rtcPeer.makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignalingMessage({ type: 'offer', to: peerId, offer: pc.localDescription });
      } catch (err) { }
      finally { rtcPeer.makingOffer = false; }
    };

    pc.ondatachannel = (event) => {
      rtcPeer.dataChannel = event.channel;
      this.setupDataChannelEvents(rtcPeer);
      this.emitEvent({ type: 'dataChannelOpen', payload: { peerId } });
    };

    return rtcPeer;
  }

  public async initiateConnection(peerId: string, peerName: string) {
    if (!this.localId) { return; }
    if (this.localId === peerId) { return; }
    
    const rtcPeer = await this.createRTCPeerConnection(peerId, peerName, false);
    
    if (!rtcPeer.pc.getSenders().find(sender => sender.track?.kind === 'application')) {
      const dataChannel = rtcPeer.pc.createDataChannel('fileTransfer', { ordered: true });
      rtcPeer.dataChannel = dataChannel;
      this.setupDataChannelEvents(rtcPeer);
    }

    rtcPeer.makingOffer = true;
    try {
      const offer = await rtcPeer.pc.createOffer();
      await rtcPeer.pc.setLocalDescription(offer);
      this.sendSignalingMessage({ type: 'offer', to: peerId, offer: rtcPeer.pc.localDescription });
    } catch (err) { this.cleanupPeerConnection(peerId); }
    finally { rtcPeer.makingOffer = false; }
  }

  private async handleOffer(fromId: string, fromName: string, offer: RTCSessionDescriptionInit) {
    const rtcPeer = this.peerConnections.get(fromId) || await this.createRTCPeerConnection(fromId, fromName, true);
    
    const offerCollision = rtcPeer.makingOffer || rtcPeer.pc.signalingState !== "stable";
    rtcPeer.isIgnoringOffer = !rtcPeer.polite && offerCollision;
    if (rtcPeer.isIgnoringOffer) {
      return;
    }
    
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await rtcPeer.pc.createAnswer();
      await rtcPeer.pc.setLocalDescription(answer);
      this.sendSignalingMessage({ type: 'answer', to: fromId, answer: rtcPeer.pc.localDescription });
    } catch (err) { }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { return; }
    try {
      await rtcPeer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) { }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const rtcPeer = this.peerConnections.get(fromId);
    if (!rtcPeer) { return; }
    try {
      if (candidate) {
        await rtcPeer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) { }
  }

  private setupDataChannelEvents(rtcPeer: WebRTCPeerConnection) {
    const { dataChannel, id: peerId, name: peerName } = rtcPeer;
    if (!dataChannel) return;

    dataChannel.onopen = () => {
      this.emitEvent({ type: 'dataChannelOpen', payload: { peerId } });
      this.sendQueuedFiles(peerId);
    };
    dataChannel.onclose = () => {
      this.emitEvent({ type: 'dataChannelClose', payload: { peerId } });
    };
    dataChannel.onerror = (error) => {
      this.emitEvent({ type: 'dataChannelError', payload: { peerId, error } });
    };
    dataChannel.onmessage = (event) => this.handleDataChannelMessage(event, rtcPeer);
  }

  private handleDataChannelMessage(event: MessageEvent, rtcPeer: WebRTCPeerConnection) {
    const { id: peerId, name: peerName } = rtcPeer;
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'file-metadata':
            rtcPeer.receivingFileInfo = { ...message.payload, id: message.fileId, receivedBytes: 0, chunks: [], senderId: peerId, senderName: peerName };
            this.emitEvent({ type: 'fileOffered', payload: { ...rtcPeer.receivingFileInfo } });
            break;
          case 'file-accept':
            this.emitEvent({ type: 'fileAccepted', payload: { fileId: message.fileId, peerId } });
            this.sendFileChunks(peerId, message.fileId);
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
            this.emitEvent({ type: 'fileReceiveComplete', payload: { fileId: info.id, peerId, name: info.name, blob: fileBlob, type: info.type } });
            rtcPeer.receivingFileInfo = undefined;
          }
        }
      }
    } catch (error) {
      console.error('Error processing data channel message:', error, '\nRaw data:', event.data);
    }
  }

  public queueFileForSend(peerId: string, file: File, fileTransferId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer) { return; }
    
    rtcPeer.filesToSend.push({ file, id: fileTransferId, metadataSent: false, offset: 0 });
    
    if (rtcPeer.dataChannel && rtcPeer.dataChannel.readyState === 'open') {
      this.sendQueuedFiles(peerId);
    } else {
      toast({ title: "File Queued", description: `${file.name} will be sent once connection is ready.` });
    }
  }

  private sendQueuedFiles(peerId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (!rtcPeer || !rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open') return;

    const fileDetail = rtcPeer.filesToSend.find(f => !f.metadataSent);
    if (fileDetail) {
      const metadata = {
        type: 'file-metadata',
        fileId: fileDetail.id,
        payload: { name: fileDetail.file.name, size: fileDetail.file.size, type: fileDetail.file.type },
      };
      rtcPeer.dataChannel.send(JSON.stringify(metadata));
      fileDetail.metadataSent = true;
    }
  }
  
  public acceptFileOffer(peerId: string, fileId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-accept', fileId }));
    }
    if (rtcPeer && rtcPeer.receivingFileInfo && rtcPeer.receivingFileInfo.id === fileId) {
      rtcPeer.receivingFileInfo = undefined;
    }
  }

  public rejectFileOffer(peerId: string, fileId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    if (rtcPeer?.dataChannel?.readyState === 'open') {
      rtcPeer.dataChannel.send(JSON.stringify({ type: 'file-reject', fileId }));
    }
    if (rtcPeer && rtcPeer.receivingFileInfo && rtcPeer.receivingFileInfo.id === fileId) {
      rtcPeer.receivingFileInfo = undefined;
    }
  }

  private async sendFileChunks(peerId: string, fileTransferId: string) {
    const rtcPeer = this.peerConnections.get(peerId);
    const fileDetail = rtcPeer?.filesToSend.find(f => f.id === fileTransferId);

    if (!rtcPeer || !rtcPeer.dataChannel || rtcPeer.dataChannel.readyState !== 'open' || !fileDetail) {
      this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
      return;
    }
    
    const { file } = fileDetail;

    const sendChunk = () => {
      if (fileDetail.offset < file.size && rtcPeer.dataChannel?.readyState === 'open') {
        if (rtcPeer.dataChannel.bufferedAmount > CHUNK_SIZE * 10) {
          setTimeout(sendChunk, 100);
          return;
        }

        const chunk = file.slice(fileDetail.offset, fileDetail.offset + CHUNK_SIZE);
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer && rtcPeer.dataChannel?.readyState === 'open') {
            try {
              rtcPeer.dataChannel.send(reader.result);
              fileDetail.offset += reader.result.byteLength;
              const progress = (fileDetail.offset / file.size) * 100;
              this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress, direction: 'send' } });
              requestAnimationFrame(sendChunk);
            } catch (e) {
              this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
            }
          }
        };
        reader.onerror = (e) => {
          this.emitEvent({ type: 'fileProgress', payload: { fileId: fileTransferId, peerId, progress: -1, direction: 'send' } });
        };
        reader.readAsArrayBuffer(chunk);
      } else if (fileDetail.offset >= file.size) {
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
      this.emitEvent({ type: 'peerLeft', payload: { peerId } });
    }
  }

  public getPeerConnection = (peerId: string) => this.peerConnections.get(peerId);
}

export default WebRTCManager.getInstance();