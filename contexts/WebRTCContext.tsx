"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import webRTCManager, { WebRTCEvent, BasePeer as ManagerBasePeer, WebRTCPeerConnection as ManagerWebRTCPeer } from '@/lib/webRTCManager';
import { useToast } from '@/hooks/use-toast';
import { generateId } from '@/lib/utils';

export type PeerStatus = "available" | "connecting" | "connected" | "disconnected" | "failed";

export interface UIPeer extends ManagerBasePeer {
  status: PeerStatus;
  isLocal?: boolean;
}

export interface UIFileTransfer {
  id: string;
  fileId: string;
  name: string;
  size: number;
  type: string;
  peerId: string;
  peerName: string;
  status: "pending" | "transferring" | "paused" | "completed" | "error" | "rejected" | "waiting_acceptance";
  progress: number;
  direction: 'send' | 'receive';
  file?: File;
  blob?: Blob;
  timestamp: number;
}

interface WebRTCContextType {
  connectSignaling: (name: string) => void;
  disconnectSignaling: () => void;
  isSignalingConnected: boolean;
  localPeer: UIPeer | null;
  peers: UIPeer[];
  initiateConnection: (peerId: string) => void;
  sendFile: (peerId: string, file: File) => string;
  acceptFileOffer: (fileOfferId: string) => void;
  rejectFileOffer: (fileOfferId: string) => void;
  activeTransfers: UIFileTransfer[];
  getTransferById: (transferId: string) => UIFileTransfer | undefined;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const WebRTCProvider = ({ children }: { children: ReactNode }) => {
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [localPeer, setLocalPeer] = useState<UIPeer | null>(null);
  const [peers, setPeers] = useState<UIPeer[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<UIFileTransfer[]>([]);
  const { toast } = useToast();

  const updatePeer = useCallback((peerData: ManagerBasePeer, status: PeerStatus) => {
    setPeers(prev => {
      const existing = prev.find(p => p.id === peerData.id);
      if (existing) {
        return prev.map(p => p.id === peerData.id ? { ...p, name: peerData.name, status } : p);
      }
      return [...prev, { ...peerData, status }];
    });
  }, []);

  const findTransferByFileIdAndPeer = (fileId: string, peerId: string) => {
    return activeTransfers.find(t => t.fileId === fileId && t.peerId === peerId);
  };
  
  const updateTransfer = useCallback((transferId: string, updates: Partial<UIFileTransfer>) => {
    setActiveTransfers(prev => prev.map(t => t.id === transferId ? { ...t, ...updates } : t));
  }, []);

  useEffect(() => {
    const handleWebRTCEvent = (event: WebRTCEvent) => {
      console.log('Context Event:', event.type, event.payload);
      switch (event.type) {
        case 'signalingConnected': setIsSignalingConnected(true); break;
        case 'signalingDisconnected': 
            setIsSignalingConnected(false); 
            setLocalPeer(null); 
            setPeers([]); 
            setActiveTransfers(prev => prev.map(t => (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') ? {...t, status: 'error', progress: 0} : t));
            break;
        case 'signalingError': toast({ title: "Signaling Error", description: event.payload, variant: "destructive" }); break;
        case 'localIdAssigned': 
            setLocalPeer({ ...(event.payload as ManagerBasePeer), status: 'available', isLocal: true });
            break;
        case 'peerListUpdated':
          setPeers((event.payload as ManagerBasePeer[]).map(p => ({ ...p, status: 'available' })));
          break;
        case 'newPeerArrived':
          if (localPeer && (event.payload as ManagerBasePeer).id !== localPeer.id) {
            updatePeer(event.payload as ManagerBasePeer, 'available');
          }
          break;
        case 'peerLeft':
          setPeers(prev => prev.filter(p => p.id !== (event.payload as {peerId: string}).peerId));
          setActiveTransfers(prev => prev.map(t => t.peerId === (event.payload as {peerId: string}).peerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') ? {...t, status: 'error'} : t));
          break;
        case 'rtcConnectionStateChange':
            const { peerId: rtcPeerId, state } = event.payload as { peerId: string, state: RTCIceConnectionState };
            if (state === 'connected') updatePeer({id: rtcPeerId, name: peers.find(p=>p.id === rtcPeerId)?.name || 'Unknown'}, 'connected');
            else if (['disconnected', 'failed', 'closed'].includes(state)) updatePeer({id: rtcPeerId, name: peers.find(p=>p.id === rtcPeerId)?.name || 'Unknown'}, 'disconnected');
            else if (state === 'connecting' || state === 'new' || state === 'checking') updatePeer({id: rtcPeerId, name: peers.find(p=>p.id === rtcPeerId)?.name || 'Unknown'}, 'connecting');
            break;
        case 'dataChannelOpen':
            const dcOpenPayload = event.payload as { peerId: string };
            updatePeer({id: dcOpenPayload.peerId, name: peers.find(p=>p.id === dcOpenPayload.peerId)?.name || 'Unknown'}, 'connected');
            toast({title: "Peer Connected", description: `Ready to share with ${peers.find(p=>p.id === dcOpenPayload.peerId)?.name || 'peer'}`});
            break;
        case 'fileOffered':
            const offer = event.payload as { fileId: string, name: string, size: number, type: string, senderId: string, senderName: string };
            const existingOffer = activeTransfers.find(t => t.id === offer.fileId && t.peerId === offer.senderId && t.direction === 'receive');
            if (!existingOffer) {
                setActiveTransfers(prev => [...prev, {
                    id: offer.fileId,
                    fileId: offer.fileId,
                    name: offer.name,
                    size: offer.size,
                    type: offer.type,
                    peerId: offer.senderId,
                    peerName: offer.senderName,
                    status: 'waiting_acceptance',
                    progress: 0,
                    direction: 'receive',
                    timestamp: Date.now()
                }]);
                toast({title: "Incoming File", description: `${offer.senderName} wants to send ${offer.name}`});
            }
            break;
        case 'fileAccepted':
            const acceptPayload = event.payload as { fileId: string; peerId: string };
            updateTransfer(acceptPayload.fileId, { status: 'transferring' });
            break;
        case 'fileRejected':
            const rejectPayload = event.payload as { fileId: string; peerId: string };
            updateTransfer(rejectPayload.fileId, { status: 'rejected', progress: 0 });
            toast({ title: "Transfer Rejected", description: `Peer rejected file.`, variant: "destructive" });
            break;
        case 'fileProgress':
            const progressPayload = event.payload as { fileId: string, peerId: string, progress: number, direction: 'send' | 'receive' };
            if (progressPayload.progress === -1) {
                updateTransfer(progressPayload.fileId, { status: 'error', progress: activeTransfers.find(t => t.id === progressPayload.fileId)?.progress || 0 });
            } else {
                updateTransfer(progressPayload.fileId, { progress: progressPayload.progress, status: 'transferring' });
            }
            break;
        case 'fileSendComplete':
            const sendComplete = event.payload as { fileId: string, peerId: string, name: string };
            updateTransfer(sendComplete.fileId, { status: 'completed', progress: 100 });
            toast({title: "File Sent", description: `${sendComplete.name} sent successfully.`});
            break;
        case 'fileReceiveComplete':
            const receiveComplete = event.payload as { fileId: string, peerId: string, name: string, blob: Blob, type: string };
            updateTransfer(receiveComplete.fileId, { status: 'completed', progress: 100, blob: receiveComplete.blob });
            toast({title: "File Received", description: `${receiveComplete.name} received. Ready to save.`});
            break;
      }
    };

    webRTCManager.addListener(handleWebRTCEvent);
    return () => {
      webRTCManager.removeListener(handleWebRTCEvent);
    };
  }, [toast, updatePeer, updateTransfer, localPeer, peers, activeTransfers]);

  const connectSignaling = (name: string) => {
    const savedSettings = JSON.parse(localStorage.getItem("connectshare-settings") || "{}");
    const displayName = name || savedSettings.displayName || "Anonymous";
    if (displayName) {
      webRTCManager.connectSignaling(displayName);
    } else {
      toast({title: "Name Required", description: "Please set a display name in settings first.", variant: "destructive"});
    }
  };

  const disconnectSignaling = () => webRTCManager.disconnectSignaling();

  const initiateConnection = (peerId: string) => {
    const peer = peers.find(p => p.id === peerId);
    if (peer) {
      updatePeer(peer, 'connecting');
      webRTCManager.initiateConnection(peerId, peer.name);
    }
  };

  const sendFile = (peerId: string, file: File): string => {
    const transferId = generateId();
    const peer = peers.find(p => p.id === peerId);
    if (!peer) {
        toast({title: "Error", description: "Peer not found.", variant: "destructive"});
        return transferId;
    }

    setActiveTransfers(prev => [...prev, {
      id: transferId,
      fileId: transferId,
      name: file.name,
      size: file.size,
      type: file.type,
      peerId: peerId,
      peerName: peer.name,
      status: 'pending',
      progress: 0,
      direction: 'send',
      file: file,
      timestamp: Date.now()
    }]);
    webRTCManager.queueFileForSend(peerId, file, transferId);
    return transferId;
  };
  
  const acceptFileOffer = (transferId: string) => {
    const transfer = activeTransfers.find(t => t.id === transferId && t.direction === 'receive');
    if (transfer) {
      webRTCManager.acceptFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transferId, { status: 'transferring' });
    }
  };

  const rejectFileOffer = (transferId: string) => {
    const transfer = activeTransfers.find(t => t.id === transferId && t.direction === 'receive');
    if (transfer) {
      webRTCManager.rejectFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transferId, { status: 'rejected' });
      setTimeout(() => setActiveTransfers(prev => prev.filter(t => t.id !== transferId)), 3000);
    }
  };
  
  const getTransferById = (transferId: string) => {
    return activeTransfers.find(t => t.id === transferId);
  };

  return (
    <WebRTCContext.Provider value={{ 
        connectSignaling, 
        disconnectSignaling, 
        isSignalingConnected, 
        localPeer, 
        peers, 
        initiateConnection,
        sendFile,
        acceptFileOffer,
        rejectFileOffer,
        activeTransfers,
        getTransferById
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = (): WebRTCContextType => {
  const context = useContext(WebRTCContext);
  if (context === undefined) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};