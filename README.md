# ConnectShare - Peer-to-Peer File Sharing

ConnectShare is a modern, serverless peer-to-peer (P2P) file sharing application that allows users to transfer files directly between browsers without needing to upload them to a central server. It leverages **WebRTC** for direct communication and a **Cloudflare Worker** for signaling, ensuring fast, private, and secure file transfers.

## Live Demo

Experience ConnectShare live at: **[https://connect-share-delta.vercel.app/](https://connect-share-delta.vercel.app/)**

-----

## Features

  * **Direct P2P Transfers:** Files are sent directly from sender to receiver, increasing speed and privacy.
  * **No File Size Limits:** Because there's no server upload, you can share files of any size.
  * **Real-time Peer Discovery:** Instantly see who is online and available to connect with.
  * **Secure & Private:** Utilizes the encrypted channels of WebRTC for secure data transfer.
  * **Modern UI/UX:** Built with Next.js, shadcn/ui, and Framer Motion for a clean, responsive, and animated user experience.
  * **Dark Mode:** Includes a theme-aware interface that respects your system preferences.

-----

## Technologies Used

  * **Frontend:** [Next.js](https://nextjs.org/) (React Framework), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
  * **UI Components:** [shadcn/ui](https://ui.shadcn.com/), [Framer Motion](https://www.framer.com/motion/)
  * **P2P Communication:** [WebRTC](https://webrtc.org/)
  * **Backend Signaling:** [Cloudflare Workers](https://workers.cloudflare.com/) with Durable Objects for WebSocket management.
  * **Deployment:** [Vercel](https://vercel.com/) for the frontend, [Cloudflare](https://www.cloudflare.com/) for the signaling server.

-----

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

  * Node.js (v18 or later)
  * npm
  * A Cloudflare account (for deploying the signaling server)

### Installation & Setup

#### 1\. Clone the Repository

```bash
git clone https://github.com/Vishwa1011-AFK/ConnectShare.git
cd ConnectShare
```

#### 2\. Install Dependencies

```bash
npm install
```

#### 3\. Set Up the Signaling Server

The signaling server runs on a Cloudflare Worker. You will need to deploy it separately. The code for the signaling server can be found in the `Websocket-Server_ConnectShare` directory of this repository.

1.  Navigate to the signaling server directory and deploy it to your Cloudflare account.
2.  Once deployed, you will get a URL like `https://your-worker-name.your-account.workers.dev`.

#### 4\. Configure Environment Variables

1.  In the root of the `ConnectShare` project, create a new file named `.env.local`.

2.  Add your Cloudflare Worker URL to this file:

    ```env
    # The URL you got after deploying your Cloudflare Worker
    NEXT_PUBLIC_CF_WORKER_URL="wss://your-worker-name.your-account.workers.dev"

    # Set this to 'false' to use the live Cloudflare Worker from your local machine
    NEXT_PUBLIC_FORCE_LOCAL_SIGNALING="false"
    ```

#### 5\. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result. You can open it in two different browser tabs or on two different devices on the same network to test the P2P connection.
