# WhatsApp Session Manager

A complete web-based tool to manage WhatsApp multi-device sessions using **QR code** or **phone number pairing**. Sessions are automatically saved as timestamped ZIP files and can be downloaded anytime. Deployable on **Railway**, **Vercel**, or any Node.js hosting.

## ✨ Features

- **Two Authentication Methods**:
  - **QR Code**: Scan with WhatsApp → Link device
  - **Phone Pairing**: Get an 8-digit code (pops up on WhatsApp) → Enter code on your phone
- **Automatic Session Backup** – Every session is saved as a ZIP file with format:  
  `sessionId_day_month_year_timestamp.zip`
- **Session Management Dashboard** – View, download, or delete saved sessions
- **Ready for Cloud Deployment** – Works on Railway, Vercel (with external storage), or any VPS
- **Persistent Sessions** – Reuse downloaded session ZIP files anytime

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **WhatsApp Library**: Baileys (official multi-device support)
- **Session Storage**: File system (local or persistent volume)
- **ZIP Creation**: Archiver
- **QR Generation**: qrcode

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/whatsapp-session-manager.git
cd whatsapp-session-manager
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run locally
```bash
npm start
```

The app will be available at `http://localhost:3000`

## 🚀 Deployment

### Deploy to Railway (Recommended)

1. Push the code to a GitHub repository.
2. Log in to [Railway.app](https://railway.app).
3. Click **New Project** → **Deploy from GitHub repo**.
4. Select your repository.
5. Railway automatically detects the `Dockerfile` and deploys.
6. Your app gets a public URL (e.g., `https://your-app.up.railway.app`).

> Railway provides persistent disk storage (the `sessions/` folder) so your saved sessions won't disappear on redeploy.

### Deploy to Vercel (without persistent storage)

Vercel does **not** keep file system changes between requests. To use Vercel:
- Replace local file storage with **MongoDB**, **Supabase**, or **AWS S3**.
- Use the same Baileys logic, but store session credentials in a database.

### Deploy to any VPS (DigitalOcean, AWS, etc.)

1. Copy the project to your server.
2. Install Node.js 18+ and npm.
3. Run `npm install && npm start`.
4. Use **PM2** to keep it alive:  
   `pm2 start server.js --name whatsapp-session-manager`

## 📖 How to Use

### 1. Create a Session

#### **Method A: QR Code**
- Enter a unique **Session ID** (e.g., `my_business_account`).
- Click **“Create Session with QR Code”**.
- A QR code appears.
- Open WhatsApp on your phone → **Settings** → **Linked Devices** → **Link a Device** → Scan the QR code.

#### **Method B: Phone Number Pairing**
- Enter a unique **Session ID**.
- Enter your phone number in **international format** (no `+` or spaces, e.g., `12345678901`).
- Click **“Request Pairing Code”**.
- An 8-digit code appears on the webpage **and** also pops up on your WhatsApp.
- Open WhatsApp Web on your phone and enter that code.
- The session connects instantly.

### 2. Session is Saved
- As soon as the session is connected, it is automatically saved as a ZIP file inside the `sessions/` folder.
- The ZIP file name includes the date and timestamp:  
  `my_business_account_15_06_2025_1705312800000.zip`

### 3. Manage Sessions
- **See all sessions** – Listed on the main dashboard.
- **Download a session** – Click **“Download ZIP”** to get the session file.
- **Delete a session** – Removes both the folder and its ZIP archives.

## 📁 Project Structure

```
whatsapp-session-manager/
├── server.js                 # Express server & WhatsApp logic
├── package.json              # Dependencies
├── Dockerfile                # For Railway deployment
├── sessions/                 # Automatically created – stores session folders & ZIPs
├── public/
│   ├── index.html            # Dashboard UI
│   └── script.js             # Frontend logic
└── README.md                 # This file
```

## 🔐 Important Security Notes

- **Session files contain your WhatsApp credentials** (encrypted but still sensitive). Treat them like passwords.
- **Never share** session ZIP files with anyone.
- **Each WhatsApp account** can have up to 4 linked devices. Use a different session ID for each device if you need multiple connections.
- **For production**, add authentication (e.g., basic auth or login) to the dashboard and use HTTPS.

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not showing | Ensure your server is accessible from the network. Some cloud hosts block WebSocket connections; Railway works fine. |
| Pairing code doesn't pop up on WhatsApp | Make sure the phone number is in **international format** without leading `+`. Also, your WhatsApp version must support pairing codes (all recent versions do). |
| Session disconnects after some time | Baileys automatically reconnects. If it doesn't, delete the session folder and recreate it. |
| “Session already exists” error | Choose a different Session ID or delete the existing session from the dashboard. |
| Deploying on Railway – sessions lost after redeploy | Railway keeps the `sessions/` folder because it's inside the project root. If you want absolute persistence, use a **Railway Volume** or external storage. |

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

MIT

## 🙏 Acknowledgements

- [Baileys](https://github.com/whiskeysockets/baileys) – WhatsApp Web API
- [Express](https://expressjs.com/) – Web framework
