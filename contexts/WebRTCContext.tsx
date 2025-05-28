"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  disconnectPeer: (peerId: string) => void;
  requestPeerList: () => void;
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

  // Use refs to avoid stale closures in useEffect
  const peersRef = useRef<UIPeer[]>([]);
  const activeTransfersRef = useRef<UIFileTransfer[]>([]);
  const localPeerRef = useRef<UIPeer | null>(null);

  // Update refs whenever state changes
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    activeTransfersRef.current = activeTransfers;
  }, [activeTransfers]);

  useEffect(() => {
    localPeerRef.current = localPeer;
  }, [localPeer]);

  const updatePeer = useCallback((peerData: ManagerBasePeer, status: PeerStatus) => {
    setPeers(prev => {
      const existing = prev.find(p => p.id === peerData.id);
      if (existing) {
        return prev.map(p => p.id === peerData.id ? { ...p, name: peerData.name, status } : p);
      }
      return [...prev, { ...peerData, status }];
    });
  }, []);

  const findTransferByFileId = useCallback((fileId: string, peerId?: string) => {
    return activeTransfersRef.current.find(t => 
      t.fileId === fileId && (peerId ? t.peerId === peerId : true)
    );
  }, []);
  
  const updateTransfer = useCallback((transferId: string, updates: Partial<UIFileTransfer>) => {
    setActiveTransfers(prev => prev.map(t => 
      (t.id === transferId || t.fileId === transferId) ? { ...t, ...updates } : t
    ));
  }, []);

  const disconnectPeer = useCallback((peerId: string) => {
    webRTCManager.cleanupPeerConnection(peerId);
  }, []);

  useEffect(() => {
    const handleWebRTCEvent = (event: WebRTCEvent) => {
      console.log('WebRTC Event:', event.type, event.payload);
      
      switch (event.type) {
        case 'signalingConnected': 
          setIsSignalingConnected(true); 
          break;
          
        case 'signalingDisconnected': 
          setIsSignalingConnected(false); 
          setLocalPeer(null); 
          setPeers([]); 
          setActiveTransfers(prev => prev.map(t => 
            (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') 
              ? {...t, status: 'error', progress: 0} 
              : t
          ));
          break;
          
        case 'signalingError': 
          toast({ title: "Signaling Error", description: event.payload, variant: "destructive" }); 
          break;
          
        case 'localIdAssigned': 
          const localPeerData = event.payload as ManagerBasePeer;
          setLocalPeer({ ...localPeerData, status: 'available', isLocal: true });
          break;
          
        case 'peerListUpdated':
          const serverPeerList = (event.payload as ManagerBasePeer[]).filter(p => p.id !== localPeerRef.current?.id);
          setPeers(prevPeers => {
            const newPeersState: UIPeer[] = [];
            const serverPeerMap = new Map(serverPeerList.map(p => [p.id, p]));

            serverPeerList.forEach(serverPeer => {
              const existingUiPeer = prevPeers.find(p => p.id === serverPeer.id);
              if (existingUiPeer) {
                newPeersState.push({
                  ...existingUiPeer,
                  name: serverPeer.name,
                  status: (existingUiPeer.status === 'connecting' || existingUiPeer.status === 'connected')
                            ? existingUiPeer.status
                            : 'available',
                });
              } else {
                newPeersState.push({ ...serverPeer, status: 'available' });
              }
            });

            prevPeers.forEach(prevPeer => {
              if ((prevPeer.status === 'connected' || prevPeer.status === 'connecting') && !serverPeerMap.has(prevPeer.id)) {
                newPeersState.push(prevPeer);
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
              ? {...t, status: 'error'} 
              : t
          ));
          break;
          
        case 'rtcConnectionStateChange':
          const { peerId: rtcPeerId, state } = event.payload as { peerId: string, state: RTCIceConnectionState };
          const targetPeer = peersRef.current.find(p => p.id === rtcPeerId);
          const peerName = targetPeer?.name || 'Unknown';
          
          if (state === 'connected') {
            updatePeer({id: rtcPeerId, name: peerName}, 'connected');
          } else if (['disconnected', 'failed', 'closed'].includes(state)) {
            updatePeer({id: rtcPeerId, name: peerName}, 'disconnected');
          } else if (state === 'new' || state === 'checking') {
            updatePeer({id: rtcPeerId, name: peerName}, 'connecting');
          }
          break;
          
        case 'dataChannelOpen':
          const dcOpenPayload = event.payload as { peerId: string };
          const openPeer = peersRef.current.find(p => p.id === dcOpenPayload.peerId);
          const openPeerName = openPeer?.name || 'peer';
          updatePeer({id: dcOpenPayload.peerId, name: openPeerName}, 'connected');
          toast({title: "Peer Connected", description: `Ready to share with ${openPeerName}`});
          break;
          
        case 'dataChannelClose':
          const closedPeerId = event.payload.peerId;
          const closedPeer = peersRef.current.find(p => p.id === closedPeerId);
          const closedPeerName = closedPeer?.name || 'peer';
          
          setActiveTransfers(prev => prev.map(t =>
            t.peerId === closedPeerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance')
              ? { ...t, status: 'error', progress: 0 }
              : t
          ));
          toast({ 
            title: "Data Channel Closed", 
            description: `Connection to ${closedPeerName} lost.`, 
            variant: "destructive" 
          });
          break;
          
        case 'fileOffered':
          const offer = event.payload as { 
            fileId: string, 
            name: string, 
            size: number, 
            type: string, 
            senderId: string, 
            senderName: string 
          };
          
          // Check if we already have this transfer
          const existingOffer = activeTransfersRef.current.find(t => 
            t.fileId === offer.fileId && t.peerId === offer.senderId && t.direction === 'receive'
          );
          
          if (!existingOffer) {
            const newTransfer: UIFileTransfer = {
              id: offer.fileId, // Use fileId as the transfer ID for receives
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
            };
            
            setActiveTransfers(prev => [...prev, newTransfer]);
            toast({
              title: "Incoming File", 
              description: `${offer.senderName} wants to send ${offer.name}`
            });
          }
          break;
          
        case 'fileAccepted':
          const acceptPayload = event.payload as { fileId: string; peerId: string };
          console.log('File accepted:', acceptPayload);
          updateTransfer(acceptPayload.fileId, { status: 'transferring' });
          break;
          
        case 'fileRejected':
          const rejectPayload = event.payload as { fileId: string; peerId: string };
          console.log('File rejected:', rejectPayload);
          updateTransfer(rejectPayload.fileId, { status: 'rejected', progress: 0 });
          toast({ 
            title: "Transfer Rejected", 
            description: `Peer rejected file.`, 
            variant: "destructive" 
          });
          break;
          
        case 'fileProgress':
          const progressPayload = event.payload as { 
            fileId: string, 
            peerId: string, 
            progress: number, 
            direction: 'send' | 'receive' 
          };
          
          console.log('File progress:', progressPayload);
          
          if (progressPayload.progress === -1) {
            // Error occurred
            const currentTransfer = findTransferByFileId(progressPayload.fileId, progressPayload.peerId);
            updateTransfer(progressPayload.fileId, { 
              status: 'error', 
              progress: currentTransfer?.progress || 0 
            });
          } else {
            updateTransfer(progressPayload.fileId, { 
              progress: progressPayload.progress, 
              status: 'transferring' 
            });
          }
          break;
          
        case 'fileSendComplete':
          const sendComplete = event.payload as { fileId: string, peerId: string, name: string };
          console.log('File send complete:', sendComplete);
          updateTransfer(sendComplete.fileId, { status: 'completed', progress: 100 });
          toast({
            title: "File Sent", 
            description: `${sendComplete.name} sent successfully.`
          });
          break;
          
        case 'fileReceiveComplete':
          const receiveComplete = event.payload as { 
            fileId: string, 
            peerId: string, 
            name: string, 
            blob: Blob, 
            type: string 
          };
          console.log('File receive complete:', receiveComplete);
          updateTransfer(receiveComplete.fileId, { 
            status: 'completed', 
            progress: 100, 
            blob: receiveComplete.blob 
          });
          toast({
            title: "File Received", 
            description: `${receiveComplete.name} received. Ready to save.`
          });
          break;
          
        case 'peerNameChanged':
          const { peerId: changedPeerId, name: newName } = event.payload as { peerId: string, name: string };
          setPeers(prev => prev.map(p => p.id === changedPeerId ? { ...p, name: newName } : p));
          setActiveTransfers(prev => prev.map(t => 
            t.peerId === changedPeerId ? { ...t, peerName: newName } : t
          ));
          if (localPeerRef.current && localPeerRef.current.id === changedPeerId) {
            setLocalPeer(prev => prev ? { ...prev, name: newName } : null);
          }
          break;
          
        default:
          console.warn('Unhandled WebRTC event:', event.type);
      }
    };

    webRTCManager.addListener(handleWebRTCEvent);
    return () => {
      webRTCManager.removeListener(handleWebRTCEvent);
    };
  }, [toast, updatePeer, updateTransfer, findTransferByFileId]);

  // Timeout cleanup for stalled transfers
  useEffect(() => {
    const timeoutInterval = setInterval(() => {
      const now = Date.now();
      setActiveTransfers(prev => prev.map(t => {
        if ((t.status === 'transferring' || t.status === 'pending') && now - t.timestamp > 30000) { // 30 seconds
          return { ...t, status: 'error', progress: t.progress };
        }
        return t;
      }));
    }, 5000); 
    
    return () => clearInterval(timeoutInterval);
  }, []);

  const connectSignaling = useCallback((name: string) => {
    const savedSettings = JSON.parse(localStorage.getItem("connectshare-settings") || "{}");
    const displayName = name || savedSettings.displayName || "Anonymous";
    if (displayName) {
      console.log('Connecting to signaling with name:', displayName);
      webRTCManager.connectSignaling(displayName);
    } else {
      toast({
        title: "Name Required", 
        description: "Please set a display name in settings first.", 
        variant: "destructive"
      });
    }
  }, [toast]);

  const disconnectSignaling = useCallback(() => {
    console.log('Disconnecting from signaling');
    webRTCManager.disconnectSignaling();
  }, []);

  const initiateConnection = useCallback((peerId: string) => {
    const peer = peersRef.current.find(p => p.id === peerId);
    if (peer) {
      console.log('Initiating connection to peer:', peerId, peer.name);
      updatePeer(peer, 'connecting');
      webRTCManager.initiateConnection(peerId, peer.name);
    }
  }, [updatePeer]);

  const sendFile = useCallback((peerId: string, file: File): string => {
    const transferId = generateId();
    const peer = peersRef.current.find(p => p.id === peerId);
    
    if (!peer) {
      toast({
        title: "Error", 
        description: "Peer not found.", 
        variant: "destructive"
      });
      return transferId;
    }

    console.log('Sending file:', file.name, 'to peer:', peerId, 'with transferId:', transferId);

    const newTransfer: UIFileTransfer = {
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
    };

    setActiveTransfers(prev => [...prev, newTransfer]);
    webRTCManager.queueFileForSend(peerId, file, transferId);
    return transferId;
  }, [toast]);
  
  const acceptFileOffer = useCallback((transferId: string) => {
    const transfer = activeTransfersRef.current.find(t => 
      (t.id === transferId || t.fileId === transferId) && t.direction === 'receive'
    );
    
    if (transfer) {
      console.log('Accepting file offer:', transferId, transfer.fileId);
      webRTCManager.acceptFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transferId, { status: 'transferring' });
    } else {
      console.error('Transfer not found for acceptance:', transferId);
    }
  }, [updateTransfer]);

  const rejectFileOffer = useCallback((transferId: string) => {
    const transfer = activeTransfersRef.current.find(t => 
      (t.id === transferId || t.fileId === transferId) && t.direction === 'receive'
    );
    
    if (transfer) {
      console.log('Rejecting file offer:', transferId, transfer.fileId);
      webRTCManager.rejectFileOffer(transfer.peerId, transfer.fileId);
      updateTransfer(transferId, { status: 'rejected' });
      setTimeout(() => {
        setActiveTransfers(prev => prev.filter(t => t.id !== transferId && t.fileId !== transferId));
      }, 3000);
    } else {
      console.error('Transfer not found for rejection:', transferId);
    }
  }, [updateTransfer]);
  
  const getTransferById = useCallback((transferId: string) => {
    return activeTransfersRef.current.find(t => t.id === transferId || t.fileId === transferId);
  }, []);

  const requestPeerList = useCallback(() => {
    console.log('Requesting peer list');
    webRTCManager.requestPeerList();
  }, []);

  return (
    <WebRTCContext.Provider value={{ 
      connectSignaling, 
      disconnectSignaling,
      disconnectPeer,
      requestPeerList,
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