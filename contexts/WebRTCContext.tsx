"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import webRTCManager, { WebRTCEvent, BasePeer as ManagerBasePeer } from '@/lib/webRTCManager'; // Removed ManagerWebRTCPeer as it's not directly used here
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
  disconnectPeer: (peerId: string) => void;
  requestPeerList: () => void;
  isSignalingConnected: boolean;
  localPeer: UIPeer | null;
  peers: UIPeer[];
  initiateConnection: (peerId: string) => void;
  sendFile: (peerId: string, file: File) => string;
  acceptFileOffer: (uiTransferId: string) => void;
  rejectFileOffer: (uiTransferId: string) => void;
  activeTransfers: UIFileTransfer[];
  getTransferById: (uiTransferId: string) => UIFileTransfer | undefined;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export const WebRTCProvider = ({ children }: { children: ReactNode }) => {
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [localPeer, setLocalPeer] = useState<UIPeer | null>(null);
  const [peers, setPeers] = useState<UIPeer[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<UIFileTransfer[]>([]);
  const { toast } = useToast();

  const peersRef = useRef<UIPeer[]>(peers);
  const activeTransfersRef = useRef<UIFileTransfer[]>(activeTransfers);
  const localPeerRef = useRef<UIPeer | null>(localPeer);

  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { activeTransfersRef.current = activeTransfers; }, [activeTransfers]);
  useEffect(() => { localPeerRef.current = localPeer; }, [localPeer]);

  const updatePeer = useCallback((peerData: ManagerBasePeer, status: PeerStatus) => {
    setPeers(prev => {
      const existingIndex = prev.findIndex(p => p.id === peerData.id);
      if (existingIndex !== -1) {
        const updatedPeers = [...prev];
        updatedPeers[existingIndex] = { ...updatedPeers[existingIndex], name: peerData.name, status };
        return updatedPeers;
      }
      return [...prev, { ...peerData, status }];
    });
  }, []);
  
  const updateTransfer = useCallback((transferIdOrFileId: string, updates: Partial<UIFileTransfer>) => {
    setActiveTransfers(prev => {
        const newTransfers = prev.map(t =>
            (t.id === transferIdOrFileId || t.fileId === transferIdOrFileId) ? { ...t, ...updates, timestamp: Date.now() } : t
        );
        return newTransfers;
    });
  }, []);

  const findTransferByFileId = useCallback((fileId: string, peerId?: string, direction?: 'send' | 'receive') => {
    return activeTransfersRef.current.find(t => 
      t.fileId === fileId && 
      (peerId ? t.peerId === peerId : true) &&
      (direction ? t.direction === direction : true)
    );
  }, []);

  const disconnectPeer = useCallback((peerId: string) => {
    webRTCManager.cleanupPeerConnection(peerId);
  }, []);

  useEffect(() => {
    const handleWebRTCEvent = (event: WebRTCEvent) => {
      
      switch (event.type) {
        case 'signalingConnected': 
          console.log('[WebRTCContext] Signaling fully connected (websocket open + ID assigned)');
          setIsSignalingConnected(true); 
          break;
          
        case 'signalingDisconnected': 
          console.log('[WebRTCContext] Signaling disconnected');
          setIsSignalingConnected(false); 
          setLocalPeer(null); 
          setPeers([]); 
          setActiveTransfers(prev => prev.map(t => 
            (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') 
              ? {...t, status: 'error', progress: 0, timestamp: Date.now()} 
              : t
          ));
          break;
          
        case 'signalingError': 
          console.log('[WebRTCContext] Signaling error:', event.payload);
          toast({ title: "Signaling Error", description: String(event.payload), variant: "destructive" }); 
          setIsSignalingConnected(false);
          break;
          
        case 'localIdAssigned': 
          console.log('[WebRTCContext] Local ID assigned:', event.payload);
          const localPeerData = event.payload as ManagerBasePeer;
          setLocalPeer({ ...localPeerData, status: 'available', isLocal: true });
          break;
          
        case 'peerListUpdated':
          console.log('[WebRTCContext] Peer list updated:', event.payload);
          const serverPeerList = (event.payload as ManagerBasePeer[]).filter(p => p.id !== localPeerRef.current?.id);
          setPeers(prevPeers => {
            const newPeersState: UIPeer[] = [];
            const serverPeerMap = new Map(serverPeerList.map(p => [p.id, p]));
            serverPeerList.forEach(serverPeer => {
              const existingUiPeer = prevPeers.find(p => p.id === serverPeer.id);
              if (existingUiPeer) {
                newPeersState.push({
                  ...existingUiPeer, name: serverPeer.name,
                  status: (existingUiPeer.status === 'connecting' || existingUiPeer.status === 'connected') ? existingUiPeer.status : 'available',
                });
              } else { newPeersState.push({ ...serverPeer, status: 'available' }); }
            });
            prevPeers.forEach(prevPeer => {
              if ((prevPeer.status === 'connected' || prevPeer.status === 'connecting') && !serverPeerMap.has(prevPeer.id)) {
                if (!newPeersState.find(p => p.id === prevPeer.id)) { newPeersState.push(prevPeer); }
              }
            });
            return newPeersState;
          });
          break;
          
        case 'newPeerArrived':
          const newPeer = event.payload as ManagerBasePeer;
          if (localPeerRef.current && newPeer.id !== localPeerRef.current.id) {
            updatePeer(newPeer, 'available');
          }
          break;
          
        case 'peerLeft':
          const leftPeerPayload = event.payload as {peerId: string};
          setPeers(prev => prev.filter(p => p.id !== leftPeerPayload.peerId));
          setActiveTransfers(prev => prev.map(t => 
            t.peerId === leftPeerPayload.peerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') 
              ? {...t, status: 'error', timestamp: Date.now()} : t
          ));
          break;
          
        case 'rtcConnectionStateChange':
          const { peerId: rtcPeerId, state } = event.payload as { peerId: string, state: RTCIceConnectionState };
          const targetPeer = peersRef.current.find(p => p.id === rtcPeerId);
          const peerName = targetPeer?.name || 'Unknown Peer';
          if (state === 'connected') { updatePeer({id: rtcPeerId, name: peerName}, 'connected'); }
          else if (['disconnected', 'failed', 'closed'].includes(state)) {
            updatePeer({id: rtcPeerId, name: peerName}, 'disconnected');
            setActiveTransfers(prev => prev.map(t => t.peerId === rtcPeerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') ? {...t, status: 'error', timestamp: Date.now()} : t ));
          } else if (state === 'new' || state === 'checking') {
            if (targetPeer) { updatePeer({id: rtcPeerId, name: peerName}, 'connecting'); }
            else { setPeers(prev => [...prev, {id: rtcPeerId, name: peerName, status: 'connecting'}]); }
          }
          break;
          
        case 'dataChannelOpen':
          const dcOpenPayload = event.payload as { peerId: string };
          const openPeer = peersRef.current.find(p => p.id === dcOpenPayload.peerId);
          updatePeer({id: dcOpenPayload.peerId, name: openPeer?.name || 'Peer'}, 'connected');
          toast({title: "Peer Connected", description: `Ready to share with ${openPeer?.name || 'Peer'}.`});
          break;
          
        case 'dataChannelClose':
          const closedPeerId = event.payload.peerId;
          const closedPeer = peersRef.current.find(p => p.id === closedPeerId);
          setActiveTransfers(prev => prev.map(t => t.peerId === closedPeerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') ? { ...t, status: 'error', progress: 0, timestamp: Date.now() } : t ));
          updatePeer({ id: closedPeerId, name: closedPeer?.name || 'Peer' }, 'disconnected');
          toast({ title: "Data Channel Closed", description: `Connection to ${closedPeer?.name || 'Peer'} lost.`, variant: "destructive" });
          break;
          
        case 'fileOffered':
          const offer = event.payload as { id: string; name: string; size: number; type: string; senderId: string; senderName: string };  
          const existingOffer = activeTransfersRef.current.find(t => t.fileId === offer.id && t.peerId === offer.senderId && t.direction === 'receive');
          if (!existingOffer) {
            const newTransfer: UIFileTransfer = {
              id: offer.id,
              fileId: offer.id,
              name: offer.name, size: offer.size, type: offer.type,
              peerId: offer.senderId, peerName: offer.senderName,
              status: 'waiting_acceptance', progress: 0, direction: 'receive',
              timestamp: Date.now()
            };
            setActiveTransfers(prev => {
              const updatedTransfers = [...prev, newTransfer];
              return updatedTransfers;
            });
            toast({ title: "Incoming File", description: `${offer.senderName} wants to send ${offer.name}`});
          } else {
          }
          break;
          
        case 'fileAccepted':
          const acceptPayload = event.payload as { fileId: string; peerId: string };
          updateTransfer(acceptPayload.fileId, { status: 'transferring', timestamp: Date.now() });
          break;
          
        case 'fileRejected':
          const rejectPayload = event.payload as { fileId: string; peerId: string };          updateTransfer(rejectPayload.fileId, { status: 'rejected', progress: 0, timestamp: Date.now() });
          toast({ title: "Transfer Rejected", description: `Peer rejected file.`, variant: "destructive" });
          break;
          
        case 'fileProgress':
          const progressPayload = event.payload as { fileId: string; peerId: string; progress: number; direction: 'send' | 'receive' };
          if (progressPayload.progress === -1) {
            const currentTransferOnError = findTransferByFileId(progressPayload.fileId, progressPayload.peerId, progressPayload.direction);
            updateTransfer(progressPayload.fileId, { status: 'error', progress: currentTransferOnError?.progress || 0, timestamp: Date.now() });
          } else {
            const currentStatus = activeTransfersRef.current.find(t=>t.fileId === progressPayload.fileId)?.status;
            updateTransfer(progressPayload.fileId, { 
              progress: progressPayload.progress, 
              status: progressPayload.progress < 100 ? 'transferring' : (currentStatus || 'transferring'),
              timestamp: Date.now()
            });
          }
          break;
          
        case 'fileSendComplete':
          const sendComplete = event.payload as { fileId: string, peerId: string, name: string };
          updateTransfer(sendComplete.fileId, { status: 'completed', progress: 100, timestamp: Date.now() });
          toast({ title: "File Sent", description: `${sendComplete.name} sent successfully.` });
          break;
          
        case 'fileReceiveComplete':
          const receiveComplete = event.payload as { fileId: string; peerId: string; name: string; blob: Blob; type: string };
          updateTransfer(receiveComplete.fileId, { status: 'completed', progress: 100, blob: receiveComplete.blob, timestamp: Date.now() });
          toast({ title: "File Received", description: `${receiveComplete.name} received. Ready to save.`});
          break;
          
        case 'peerNameChanged':
          const { peerId: changedPeerId, name: newName } = event.payload as { peerId: string, name: string };
          setPeers(prev => prev.map(p => p.id === changedPeerId ? { ...p, name: newName } : p));
          setActiveTransfers(prev => prev.map(t => t.peerId === changedPeerId ? { ...t, peerName: newName } : t));
          if (localPeerRef.current && localPeerRef.current.id === changedPeerId) {
            setLocalPeer(prev => prev ? { ...prev, name: newName } : null);
          }
          break;
          
        default:
          console.warn('[WebRTCContext] Unhandled WebRTC event type:', event.type);
      }
    };

    webRTCManager.addListener(handleWebRTCEvent);
    return () => {
      webRTCManager.removeListener(handleWebRTCEvent);
    };
  }, [toast, updatePeer, updateTransfer, findTransferByFileId]);

  useEffect(() => {
    const timeoutInterval = setInterval(() => {
      const now = Date.now();
      const STALLED_TIMEOUT = 60000; 
      let changed = false;
      const newActiveTransfers = activeTransfersRef.current.map(t => {
        if ((t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') && (now - t.timestamp > STALLED_TIMEOUT)) {
          console.warn(`[WebRTCContext Timeout] Stalled transfer: ID=${t.id}, fileId=${t.fileId}, status=${t.status}. Marking as error.`);
          changed = true;
          return { ...t, status: 'error' as UIFileTransfer['status'], progress: t.progress };
        }
        return t;
      });
      if (changed) {
        setActiveTransfers(newActiveTransfers);
      }
    }, 15000);
    return () => clearInterval(timeoutInterval);
  }, []);

  const connectSignaling = useCallback((name: string) => {
    const savedSettings = JSON.parse(localStorage.getItem("connectshare-settings") || "{}");
    const displayName = name || savedSettings.displayName || `User-${generateId().substring(0,4)}`;
    if (displayName) {
      webRTCManager.connectSignaling(displayName);
    }
  }, [toast]);

  const disconnectSignaling = useCallback(() => {
    webRTCManager.disconnectSignaling();
  }, []);

  const initiateConnection = useCallback((peerId: string) => {
    const peer = peersRef.current.find(p => p.id === peerId);
    if (peer) {
      updatePeer(peer, 'connecting');
      webRTCManager.initiateConnection(peerId, peer.name);
    } else {
        console.warn(`[WebRTCContext initiateConnection] Peer not found: ${peerId}`);
        toast({title: "Connection Failed", description: `Peer ${peerId} not found.`, variant: "destructive"});
    }
  }, [updatePeer, toast]);

  const sendFile = useCallback((peerId: string, file: File): string => {
    const uiTransferId = generateId(); 
    const fileActualId = generateId(); 
    const peer = peersRef.current.find(p => p.id === peerId);
    if (!peer) {
      toast({ title: "Error Sending File", description: "Peer not found.", variant: "destructive" });
      console.error(`[WebRTCContext sendFile] Peer not found: ${peerId}`);
      return uiTransferId;
    }
    const newTransfer: UIFileTransfer = {
      id: uiTransferId, fileId: fileActualId, name: file.name, size: file.size, type: file.type,
      peerId: peerId, peerName: peer.name, status: 'pending', progress: 0, direction: 'send',
      file: file, timestamp: Date.now()
    };
    setActiveTransfers(prev => [...prev, newTransfer]);
    webRTCManager.queueFileForSend(peerId, file, fileActualId);
    return uiTransferId;
  }, [toast]);
  
  const acceptFileOffer = useCallback((uiTransferId: string) => {
    const transfer = activeTransfersRef.current.find(t => t.id === uiTransferId && t.direction === 'receive');
    if (transfer) {
      webRTCManager.acceptFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transfer.id, { status: 'transferring', timestamp: Date.now() });
    } else {
      console.error(`[WebRTCContext acceptFileOffer] Transfer not found for UI ID: "${uiTransferId}"`);
      toast({title: "Error", description: "Could not accept file offer. Transfer not found.", variant: "destructive"});
    }
  }, [updateTransfer, toast]);

  const rejectFileOffer = useCallback((uiTransferId: string) => {
    const transfer = activeTransfersRef.current.find(t => t.id === uiTransferId && t.direction === 'receive');
    if (transfer) {
      webRTCManager.rejectFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transfer.id, { status: 'rejected', timestamp: Date.now() });
    } else {
      console.error(`[WebRTCContext rejectFileOffer] Transfer not found for UI ID: "${uiTransferId}"`);
    }
  }, [updateTransfer]); 
  
  const getTransferById = useCallback((uiTransferId: string) => {
    return activeTransfersRef.current.find(t => t.id === uiTransferId);
  }, []);

  const requestPeerList = useCallback(() => {
    webRTCManager.requestPeerList();
  }, []);

  return (
    <WebRTCContext.Provider value={{ 
      connectSignaling, disconnectSignaling, disconnectPeer, requestPeerList,
      isSignalingConnected, localPeer, peers, 
      initiateConnection, sendFile, acceptFileOffer, rejectFileOffer,
      activeTransfers, getTransferById
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