// This is a simplified WebRTC implementation for demonstration purposes
// In a real application, you would need a more robust implementation

export type PeerConnection = {
  id: string
  name: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
}

export type FileTransfer = {
  id: string
  file: File
  progress: number
  status: "pending" | "transferring" | "paused" | "completed" | "error"
  peerConnection: PeerConnection
}

class WebRTCService {
  private peerConnections: Map<string, PeerConnection> = new Map()
  private fileTransfers: Map<string, FileTransfer> = new Map()
  private localPeerId: string
  private localPeerName: string

  constructor() {
    this.localPeerId = this.generateId()
    this.localPeerName = "Anonymous"
  }

  setLocalPeerName(name: string) {
    this.localPeerName = name
  }

  getLocalPeerId() {
    return this.localPeerId
  }

  getLocalPeerName() {
    return this.localPeerName
  }

  // Create a new peer connection
  createPeerConnection(peerId: string, peerName: string): PeerConnection {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    const connection: PeerConnection = {
      id: peerId,
      name: peerName,
      connection: peerConnection,
    }

    // Set up data channel for file transfer
    const dataChannel = peerConnection.createDataChannel("fileTransfer")
    connection.dataChannel = dataChannel

    this.setupDataChannelEvents(connection)
    this.peerConnections.set(peerId, connection)

    return connection
  }

  // Set up event listeners for the data channel
  private setupDataChannelEvents(peerConnection: PeerConnection) {
    const { dataChannel } = peerConnection

    if (!dataChannel) return

    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer: ${peerConnection.name}`)
    }

    dataChannel.onclose = () => {
      console.log(`Data channel closed with peer: ${peerConnection.name}`)
    }

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with peer: ${peerConnection.name}`, error)
    }

    dataChannel.onmessage = (event) => {
      // Handle incoming messages
      console.log(`Received message from peer: ${peerConnection.name}`, event.data)
    }
  }

  // Send a file to a peer
  sendFile(peerId: string, file: File): string {
    const peerConnection = this.peerConnections.get(peerId)

    if (!peerConnection || !peerConnection.dataChannel) {
      throw new Error("Peer connection not found or data channel not established")
    }

    const transferId = this.generateId()

    const fileTransfer: FileTransfer = {
      id: transferId,
      file,
      progress: 0,
      status: "pending",
      peerConnection,
    }

    this.fileTransfers.set(transferId, fileTransfer)

    // In a real implementation, you would chunk the file and send it
    // This is a simplified version

    return transferId
  }

  // Generate a random ID
  private generateId(): string {
    return Math.random().toString(36).substring(2, 9)
  }

  // Get all peer connections
  getPeerConnections(): PeerConnection[] {
    return Array.from(this.peerConnections.values())
  }

  // Get all file transfers
  getFileTransfers(): FileTransfer[] {
    return Array.from(this.fileTransfers.values())
  }

  // Disconnect from a peer
  disconnectPeer(peerId: string) {
    const peerConnection = this.peerConnections.get(peerId)

    if (peerConnection) {
      if (peerConnection.dataChannel) {
        peerConnection.dataChannel.close()
      }

      peerConnection.connection.close()
      this.peerConnections.delete(peerId)
    }
  }

  // Disconnect from all peers
  disconnectAll() {
    for (const peerId of this.peerConnections.keys()) {
      this.disconnectPeer(peerId)
    }
  }
}

// Create a singleton instance
export const webRTCService = new WebRTCService()

export default webRTCService
