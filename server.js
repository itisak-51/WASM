const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const multer = require('multer');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    Browsers 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure sessions directory exists
const SESSIONS_DIR = path.join(__dirname, 'sessions');
fs.ensureDirSync(SESSIONS_DIR);

// In-memory session store
const activeSessions = new Map();

// Helper: Get formatted timestamp for ZIP files
function getFormattedTimestamp() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const timestamp = now.getTime();
    return `${day}_${month}_${year}_${timestamp}`;
}

// Helper: Create ZIP archive of session folder
async function createSessionZip(sessionId) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    const timestamp = getFormattedTimestamp();
    const zipFileName = `${sessionId}_${timestamp}.zip`;
    const zipFilePath = path.join(SESSIONS_DIR, zipFileName);
    
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => resolve(zipFilePath));
        archive.on('error', reject);
        
        archive.pipe(output);
        archive.directory(sessionPath, false);
        archive.finalize();
    });
}

// API: Create session (supports both methods)
app.post('/api/session/create', async (req, res) => {
    const { sessionId, phoneNumber } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }
    
    // Check if session already exists
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    if (fs.existsSync(sessionPath)) {
        return res.status(400).json({ error: 'Session already exists' });
    }
    
    try {
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: state,
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false,
            syncFullHistory: false
        });
        
        // Store session data
        activeSessions.set(sessionId, { sock, saveCreds, status: 'connecting' });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && !phoneNumber) {
                // Generate QR code data URL
                const qrDataUrl = await QRCode.toDataURL(qr);
                activeSessions.set(sessionId, { 
                    ...activeSessions.get(sessionId), 
                    qr: qrDataUrl,
                    status: 'qr_generated'
                });
            }
            
            if (connection === 'open') {
                activeSessions.set(sessionId, { 
                    ...activeSessions.get(sessionId), 
                    status: 'connected',
                    qr: null
                });
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                activeSessions.set(sessionId, { 
                    ...activeSessions.get(sessionId), 
                    status: 'disconnected'
                });
                
                if (shouldReconnect) {
                    // Reconnection logic here if needed
                }
            }
        });
        
        // Handle pairing code request if phone number provided
        if (phoneNumber) {
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (connection === 'connecting' || !!qr) {
                    try {
                        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
                        const code = await sock.requestPairingCode(formattedNumber);
                        activeSessions.set(sessionId, { 
                            ...activeSessions.get(sessionId), 
                            pairingCode: code,
                            status: 'pairing_code_generated'
                        });
                    } catch (err) {
                        console.error('Pairing code error:', err);
                        activeSessions.set(sessionId, { 
                            ...activeSessions.get(sessionId), 
                            status: 'pairing_error',
                            error: err.message
                        });
                    }
                }
            });
        }
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        res.json({ 
            success: true, 
            message: phoneNumber ? 'Pairing code requested' : 'Session created, waiting for QR',
            sessionId 
        });
        
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Get session status
app.get('/api/session/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        status: session.status,
        qr: session.qr || null,
        pairingCode: session.pairingCode || null
    });
});

// API: List all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await fs.readdir(SESSIONS_DIR);
        const sessionList = [];
        
        for (const session of sessions) {
            const sessionPath = path.join(SESSIONS_DIR, session);
            const stat = await fs.stat(sessionPath);
            
            // Check if it's a session folder (not a zip file)
            if (stat.isDirectory()) {
                const activeSession = activeSessions.get(session);
                sessionList.push({
                    id: session,
                    status: activeSession?.status || 'unknown',
                    created: stat.birthtime,
                    hasZip: fs.existsSync(path.join(SESSIONS_DIR, `${session}_*.zip`))
                });
            }
        }
        
        res.json({ sessions: sessionList });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Download session as ZIP
app.get('/api/session/:sessionId/download', async (req, res) => {
    const { sessionId } = req.params;
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const zipPath = await createSessionZip(sessionId);
        const zipFileName = path.basename(zipPath);
        res.download(zipPath, zipFileName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Delete session
app.delete('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Remove from active sessions
        activeSessions.delete(sessionId);
        
        // Delete folder and any ZIP files
        await fs.remove(sessionPath);
        
        // Delete associated ZIP files
        const files = await fs.readdir(SESSIONS_DIR);
        for (const file of files) {
            if (file.startsWith(sessionId) && file.endsWith('.zip')) {
                await fs.remove(path.join(SESSIONS_DIR, file));
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`WhatsApp Session Manager running on port ${port}`);
});
