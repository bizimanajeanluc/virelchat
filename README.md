# virelChat - End-to-End Encrypted Secure Messaging

virelChat is a state-of-the-art private messaging platform built on the Signal Protocol. It provides secure, encrypted communication for groups and individuals, ensuring your privacy is protected with multi-device support and ward-locked networking.

## Key Features

- **End-to-End Encryption (E2EE):** Every message is encrypted before it leaves your device.
- **Signal Protocol Integration:** Industry-standard security for your conversations.
- **Multi-Device Sync:** Securely sync your chats across all your devices.
- **Private Communities:** Create and join ward-locked secure group chats.
- **Secure Identity:** Verified cryptographic identities for all users.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment & Persistence (CRITICAL)

### SQLite Persistence
Since this app uses **SQLite** (`chat.db`), your data is stored in a local file. When deploying to cloud platforms (Railway, Render, etc.), you **MUST** configure a **Persistent Volume**:
1.  **Mount Point:** Mount a persistent volume at the location of your `chat.db` (default is root).
2.  **Environment Variable:** Set `DATABASE_PATH` in your cloud provider to point to the mounted file (e.g., `/data/chat.db`).

If you do not set up a persistent volume, **your database will be wiped** every time the server restarts or you redeploy.

### Production Build
To build the app for production:
```bash
npm run build
npm start
```

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Socket.io
- **Database:** SQLite (Better-SQLite3)
- **Encryption:** tweetnacl, Signal Protocol concepts

---
Built with privacy in mind.
