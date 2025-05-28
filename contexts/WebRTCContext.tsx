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
  id: string; // Unique ID for this transfer instance in the UI
  fileId: string; // ID of the file itself, used in WebRTC messages
  name: string;
  size: number;
  type: string;
  peerId: string;
  peerName: string;
  status: "pending" | "transferring" | "paused" | "completed" | "error" | "rejected" | "waiting_acceptance";
  progress: number; // 0-100
  direction: 'send' | 'receive';
  file?: File; // Present for sending
  blob?: Blob; // Present for received and completed
  timestamp: number; // For sorting and timeout
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
  sendFile: (peerId: string, file: File) => string; // Returns the transferId
  acceptFileOffer: (transferId: string) => void;
  rejectFileOffer: (transferId: string) => void;
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

  const peersRef = useRef<UIPeer[]>(peers);
  const activeTransfersRef = useRef<UIFileTransfer[]>(activeTransfers);
  const localPeerRef = useRef<UIPeer | null>(localPeer);

  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { activeTransfersRef.current = activeTransfers; }, [activeTransfers]);
  useEffect(() => { localPeerRef.current = localPeer; }, [localPeer]);

  const updatePeer = useCallback((peerData: ManagerBasePeer, status: PeerStatus) => {
    // console.log(`[WebRTCContext updatePeer] PeerId: ${peerData.id}, Name: ${peerData.name}, Status: ${status}`);
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
    // console.log(`[WebRTCContext updateTransfer] ID: ${transferIdOrFileId}, Updates:`, updates);
    setActiveTransfers(prev => {
        const newTransfers = prev.map(t =>
            (t.id === transferIdOrFileId || t.fileId === transferIdOrFileId) ? { ...t, ...updates, timestamp: Date.now() } : t
        );
        // if (!newTransfers.some(t => (t.id === transferIdOrFileId || t.fileId === transferIdOrFileId))) {
        //     console.warn(`[WebRTCContext updateTransfer] No transfer found to update for ID: ${transferIdOrFileId}`);
        // }
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
    console.log(`[WebRTCContext disconnectPeer] PeerId: ${peerId}`);
    webRTCManager.cleanupPeerConnection(peerId);
    // The 'peerLeft' or 'rtcConnectionStateChange' event from webRTCManager will handle UI updates
  }, []);

  useEffect(() => {
    const handleWebRTCEvent = (event: WebRTCEvent) => {
      // console.log(`[WebRTCContext handleWebRTCEvent] Type: ${event.type}`, event.payload !== undefined ? event.payload : '');
      
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
              ? {...t, status: 'error', progress: 0, timestamp: Date.now()} 
              : t
          ));
          break;
          
        case 'signalingError': 
          toast({ title: "Signaling Error", description: String(event.payload), variant: "destructive" }); 
          setIsSignalingConnected(false); // Assume disconnected on error
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
                  name: serverPeer.name, // Update name
                  // Preserve existing status if connected/connecting, otherwise set to available
                  status: (existingUiPeer.status === 'connecting' || existingUiPeer.status === 'connected')
                            ? existingUiPeer.status
                            : 'available',
                });
              } else {
                newPeersState.push({ ...serverPeer, status: 'available' });
              }
            });

            // Keep connected/connecting peers that might have been temporarily dropped by signaling list
            prevPeers.forEach(prevPeer => {
              if ((prevPeer.status === 'connected' || prevPeer.status === 'connecting') && !serverPeerMap.has(prevPeer.id)) {
                if (!newPeersState.find(p => p.id === prevPeer.id)) { // Avoid duplicates
                    newPeersState.push(prevPeer);
                }
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
              ? {...t, status: 'error', timestamp: Date.now()} 
              : t
          ));
          break;
          
        case 'rtcConnectionStateChange':
          const { peerId: rtcPeerId, state } = event.payload as { peerId: string, state: RTCIceConnectionState };
          const targetPeer = peersRef.current.find(p => p.id === rtcPeerId);
          const peerName = targetPeer?.name || 'Unknown Peer';
          
          if (state === 'connected') {
            updatePeer({id: rtcPeerId, name: peerName}, 'connected');
          } else if (['disconnected', 'failed', 'closed'].includes(state)) {
            updatePeer({id: rtcPeerId, name: peerName}, 'disconnected');
            // Mark active transfers with this peer as errored if not already completed/rejected
            setActiveTransfers(prev => prev.map(t => 
                t.peerId === rtcPeerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance')
                ? {...t, status: 'error', timestamp: Date.now()}
                : t
            ));
          } else if (state === 'new' || state === 'checking') {
             // Update if exists, or add if it's a new peer we're trying to connect to
            if (targetPeer) {
                updatePeer({id: rtcPeerId, name: peerName}, 'connecting');
            } else {
                // This case might happen if connection is initiated to a peer not yet in the list
                setPeers(prev => [...prev, {id: rtcPeerId, name: peerName, status: 'connecting'}]);
            }
          }
          break;
          
        case 'dataChannelOpen':
          const dcOpenPayload = event.payload as { peerId: string };
          const openPeer = peersRef.current.find(p => p.id === dcOpenPayload.peerId);
          const openPeerName = openPeer?.name || 'Peer';
          updatePeer({id: dcOpenPayload.peerId, name: openPeerName}, 'connected');
          toast({title: "Peer Connected", description: `Ready to share with ${openPeerName}.`});
          break;
          
        case 'dataChannelClose':
          const closedPeerId = event.payload.peerId;
          const closedPeer = peersRef.current.find(p => p.id === closedPeerId);
          const closedPeerName = closedPeer?.name || 'Peer';
          
          setActiveTransfers(prev => prev.map(t =>
            t.peerId === closedPeerId && (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance')
              ? { ...t, status: 'error', progress: 0, timestamp: Date.now() }
              : t
          ));
          // Update peer status, it might have already been updated by rtcConnectionStateChange
          updatePeer({ id: closedPeerId, name: closedPeerName }, 'disconnected');
          toast({ 
            title: "Data Channel Closed", 
            description: `Connection to ${closedPeerName} lost.`, 
            variant: "destructive" 
          });
          break;
          
        case 'fileOffered':
          // The payload from webRTCManager has 'id' for the file's unique identifier from metadata
          const offer = event.payload as { 
            id: string, // This is webRTCManager's receivingFileInfo.id, which is message.fileId
            name: string, 
            size: number, 
            type: string, 
            senderId: string, 
            senderName: string 
          };  
          
          console.log('[WebRTCContext] Raw fileOffered event.payload:', JSON.stringify(event.payload));

          const existingOffer = activeTransfersRef.current.find(t => 
            t.fileId === offer.id && t.peerId === offer.senderId && t.direction === 'receive'
          );
          
          if (!existingOffer) {
            const newTransfer: UIFileTransfer = {
              id: offer.id,         // Use the file's unique ID from metadata as the primary transfer ID for UI
              fileId: offer.id,     // And also as the fileId
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

            console.log('[WebRTCContext] Creating new UIFileTransfer for receive:', JSON.stringify(newTransfer));
            
            setActiveTransfers(prev => {
              const updatedTransfers = [...prev, newTransfer];
              // Log the relevant parts to confirm IDs
              console.log('[WebRTCContext] setActiveTransfers with new offer. New state will be:', 
                JSON.stringify(updatedTransfers.map(t => ({
                    id: t.id, 
                    fileId: t.fileId, 
                    name: t.name, 
                    status: t.status, 
                    peerId: t.peerId 
                }))));
              return updatedTransfers;
            });
            toast({
              title: "Incoming File", 
              description: `${offer.senderName} wants to send ${offer.name}`
            });
          } else {
            console.log(`[WebRTCContext] File offer already exists for fileId (offer.id): ${offer.id}, peerId: ${offer.senderId}`);
          }
          break;
          
        case 'fileAccepted': // Received when the other peer accepts our file offer
          const acceptPayload = event.payload as { fileId: string; peerId: string };
          console.log(`[WebRTCContext] File accepted by peer: fileId="${acceptPayload.fileId}", peerId="${acceptPayload.peerId}"`);
          updateTransfer(acceptPayload.fileId, { status: 'transferring', timestamp: Date.now() });
          break;
          
        case 'fileRejected': // Received when the other peer rejects our file offer
          const rejectPayload = event.payload as { fileId: string; peerId: string };
          console.log(`[WebRTCContext] File rejected by peer: fileId="${rejectPayload.fileId}", peerId="${rejectPayload.peerId}"`);
          updateTransfer(rejectPayload.fileId, { status: 'rejected', progress: 0, timestamp: Date.now() });
          toast({ 
            title: "Transfer Rejected", 
            description: `Peer rejected file.`, // Consider adding file name if available
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
          
          // console.log(`[WebRTCContext] File progress: fileId="${progressPayload.fileId}", progress=${progressPayload.progress}, direction=${progressPayload.direction}`);
          
          if (progressPayload.progress === -1) { // Error occurred
            // console.warn(`[WebRTCContext] Error progress received for fileId: ${progressPayload.fileId}`);
            const currentTransferOnError = findTransferByFileId(progressPayload.fileId, progressPayload.peerId, progressPayload.direction);
            updateTransfer(progressPayload.fileId, { 
              status: 'error', 
              progress: currentTransferOnError?.progress || 0, // Keep last known progress on error
              timestamp: Date.now()
            });
          } else {
            updateTransfer(progressPayload.fileId, { 
              progress: progressPayload.progress, 
              // Ensure status is transferring if progress is happening and not yet completed/errored
              status: progressPayload.progress < 100 ? 'transferring' : (activeTransfersRef.current.find(t=>t.fileId === progressPayload.fileId)?.status || 'transferring'),
              timestamp: Date.now()
            });
          }
          break;
          
        case 'fileSendComplete':
          const sendComplete = event.payload as { fileId: string, peerId: string, name: string };
          console.log(`[WebRTCContext] File send complete: fileId="${sendComplete.fileId}", name="${sendComplete.name}"`);
          updateTransfer(sendComplete.fileId, { status: 'completed', progress: 100, timestamp: Date.now() });
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
          console.log(`[WebRTCContext] File receive complete: fileId="${receiveComplete.fileId}", name="${receiveComplete.name}"`);
          updateTransfer(receiveComplete.fileId, { 
            status: 'completed', 
            progress: 100, 
            blob: receiveComplete.blob,
            timestamp: Date.now() 
          });
          toast({
            title: "File Received", 
            description: `${receiveComplete.name} received. Ready to save.`
          });
          break;
          
        case 'peerNameChanged':
          const { peerId: changedPeerId, name: newName } = event.payload as { peerId: string, name: string };
          console.log(`[WebRTCContext] Peer name changed: peerId="${changedPeerId}", newName="${newName}"`);
          setPeers(prev => prev.map(p => p.id === changedPeerId ? { ...p, name: newName } : p));
          setActiveTransfers(prev => prev.map(t => 
            t.peerId === changedPeerId ? { ...t, peerName: newName } : t
          ));
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
  }, [toast, updatePeer, updateTransfer, findTransferByFileId]); // Added findTransferByFileId dependency

  useEffect(() => {
    const timeoutInterval = setInterval(() => {
      const now = Date.now();
      const STALLED_TIMEOUT = 60000; // 60 seconds
      let changed = false;
      const newActiveTransfers = activeTransfersRef.current.map(t => {
        if ((t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting_acceptance') && (now - t.timestamp > STALLED_TIMEOUT)) {
          console.warn(`[WebRTCContext Timeout] Stalled transfer detected for ID: ${t.id} (fileId: ${t.fileId}), status: ${t.status}. Marking as error.`);
          changed = true;
          return { ...t, status: 'error' as UIFileTransfer['status'], progress: t.progress }; // Keep current progress on timeout
        }
        return t;
      });
      if (changed) {
        setActiveTransfers(newActiveTransfers);
      }
    }, 15000); // Check every 15 seconds
    
    return () => clearInterval(timeoutInterval);
  }, []); // No dependencies, runs once

  const connectSignaling = useCallback((name: string) => {
    const savedSettings = JSON.parse(localStorage.getItem("connectshare-settings") || "{}");
    const displayName = name || savedSettings.displayName || `User-${generateId().substring(0,4)}`;
    if (displayName) {
      console.log('[WebRTCContext connectSignaling] With name:', displayName);
      webRTCManager.connectSignaling(displayName);
    } else {
      // This case should ideally not be hit if displayName always has a fallback
      toast({
        title: "Display Name Needed", 
        description: "Please set your display name in Settings or a default will be used.", 
        variant: "destructive"
      });
    }
  }, [toast]);

  const disconnectSignaling = useCallback(() => {
    console.log('[WebRTCContext disconnectSignaling]');
    webRTCManager.disconnectSignaling();
  }, []);

  const initiateConnection = useCallback((peerId: string) => {
    const peer = peersRef.current.find(p => p.id === peerId);
    if (peer) {
      console.log(`[WebRTCContext initiateConnection] To peerId: ${peerId}, name: ${peer.name}`);
      updatePeer(peer, 'connecting'); // Optimistically set to connecting
      webRTCManager.initiateConnection(peerId, peer.name);
    } else {
        console.warn(`[WebRTCContext initiateConnection] Peer not found in local list: ${peerId}`);
        toast({title: "Connection Failed", description: `Peer ${peerId} not found.`, variant: "destructive"});
    }
  }, [updatePeer, toast]); // Added toast dependency

  const sendFile = useCallback((peerId: string, file: File): string => {
    const uiTransferId = generateId(); // This ID is for the UI state tracking
    const fileActualId = generateId(); // This ID goes into WebRTC messages as fileId
    const peer = peersRef.current.find(p => p.id === peerId);
    
    if (!peer) {
      toast({ title: "Error Sending File", description: "Peer not found.", variant: "destructive" });
      console.error(`[WebRTCContext sendFile] Peer not found: ${peerId}`);
      return uiTransferId; // Return a dummy ID, transfer won't proceed
    }

    console.log(`[WebRTCContext sendFile] File: "${file.name}", To Peer: ${peer.name} (${peerId}), UITransferID: ${uiTransferId}, FileActualID: ${fileActualId}`);

    const newTransfer: UIFileTransfer = {
      id: uiTransferId,       // UI's unique ID for this transfer instance
      fileId: fileActualId,   // The ID that will be used in metadata and RTC messages
      name: file.name,
      size: file.size,
      type: file.type,
      peerId: peerId,
      peerName: peer.name,
      status: 'pending', // Will move to 'waiting_acceptance' after metadata is sent/queued
      progress: 0,
      direction: 'send',
      file: file,
      timestamp: Date.now()
    };

    setActiveTransfers(prev => [...prev, newTransfer]);
    webRTCManager.queueFileForSend(peerId, file, fileActualId); // Pass fileActualId to manager
    return uiTransferId; // Return UI transfer ID to caller if needed
  }, [toast]); // Added toast dependency
  
  const acceptFileOffer = useCallback((uiTransferId: string) => { // This ID is UIFileTransfer.id
    console.log(`[WebRTCContext acceptFileOffer] Received UI Transfer ID: "${uiTransferId}"`);
    const transfer = activeTransfersRef.current.find(t => 
      t.id === uiTransferId && t.direction === 'receive'
    );
    
    if (transfer) {
      console.log(`[WebRTCContext acceptFileOffer] Found transfer: id="${transfer.id}", fileId="${transfer.fileId}", peerId="${transfer.peerId}". Attempting to accept.`);
      webRTCManager.acceptFileOffer(transfer.peerId, transfer.fileId); // Use transfer.fileId for RTC message
      updateTransfer(transfer.id, { status: 'transferring', timestamp: Date.now() });
    } else {
      console.error(`[WebRTCContext acceptFileOffer] Transfer not found in activeTransfers for UI ID: "${uiTransferId}"`);
      console.error('[WebRTCContext acceptFileOffer] Current activeTransfersRef:', JSON.stringify(activeTransfersRef.current.map(t => ({id: t.id, fileId: t.fileId, name: t.name, direction: t.direction}))));
      toast({title: "Error", description: "Could not accept file offer. Transfer not found.", variant: "destructive"});
    }
  }, [updateTransfer, toast]); // Added toast

  const rejectFileOffer = useCallback((uiTransferId: string) => { // This ID is UIFileTransfer.id
    console.log(`[WebRTCContext rejectFileOffer] Received UI Transfer ID: "${uiTransferId}"`);
    const transfer = activeTransfersRef.current.find(t => 
      t.id === uiTransferId && t.direction === 'receive'
    );
    
    if (transfer) {
      console.log(`[WebRTCContext rejectFileOffer] Found transfer: id="${transfer.id}", fileId="${transfer.fileId}", peerId="${transfer.peerId}". Attempting to reject.`);
      webRTCManager.rejectFileOffer(transfer.peerId, transfer.fileId); // Use transfer.fileId for RTC message
      updateTransfer(transfer.id, { status: 'rejected', timestamp: Date.now() });
      // Optionally remove from activeTransfers after a delay or immediately
      // setTimeout(() => {
      //   setActiveTransfers(prev => prev.filter(t => t.id !== uiTransferId));
      // }, 5000); 
    } else {
      console.error(`[WebRTCContext rejectFileOffer] Transfer not found for rejection with UI ID: "${uiTransferId}"`);
    }
  }, [updateTransfer]); 
  
  const getTransferById = useCallback((uiTransferId: string) => { // This ID is UIFileTransfer.id
    return activeTransfersRef.current.find(t => t.id === uiTransferId);
  }, []);

  const requestPeerList = useCallback(() => {
    console.log('[WebRTCContext requestPeerList]');
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