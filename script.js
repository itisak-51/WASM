let currentMethod = 'qr';
let statusInterval = null;

function selectMethod(method) {
    currentMethod = method;
    document.querySelectorAll('.method-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('qrMethod').style.display = method === 'qr' ? 'block' : 'none';
    document.getElementById('phoneMethod').style.display = method === 'phone' ? 'block' : 'none';
}

async function createSession(method) {
    const sessionId = method === 'qr' 
        ? document.getElementById('sessionIdQR').value 
        : document.getElementById('sessionIdPhone').value;
    
    if (!sessionId) {
        alert('Please enter a Session ID');
        return;
    }
    
    const data = { sessionId };
    
    if (method === 'phone') {
        const phoneNumber = document.getElementById('phoneNumber').value;
        if (!phoneNumber) {
            alert('Please enter a phone number');
            return;
        }
        data.phoneNumber = phoneNumber;
    }
    
    try {
        const response = await fetch('/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            startStatusPolling(sessionId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error creating session: ' + error.message);
    }
}

function startStatusPolling(sessionId) {
    if (statusInterval) clearInterval(statusInterval);
    
    statusInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}/status`);
            const data = await response.json();
            updateStatusDisplay(sessionId, data);
            
            if (data.status === 'connected') {
                clearInterval(statusInterval);
                loadSessions();
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    }, 2000);
}

function updateStatusDisplay(sessionId, data) {
    const statusDiv = document.getElementById('sessionStatus');
    
    let html = `<div class="status ${data.status}">
        <strong>Session: ${sessionId}</strong><br>
        Status: ${data.status}
    </div>`;
    
    if (data.qr) {
        html += `<div class="qr-container">
            <h3>Scan this QR code with WhatsApp:</h3>
            <img src="${data.qr}" alt="QR Code">
        </div>`;
    }
    
    if (data.pairingCode) {
        html += `<div class="pairing-code">
            <h3>Your 8-digit pairing code:</h3>
            <div style="font-size: 48px;">${data.pairingCode}</div>
            <p>Enter this code in WhatsApp Web on your phone</p>
        </div>`;
    }
    
    statusDiv.innerHTML = html;
}

async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();
        
        const sessionsList = document.getElementById('sessionsList');
        
        if (data.sessions.length === 0) {
            sessionsList.innerHTML = '<p>No sessions found. Create one above.</p>';
            return;
        }
        
        let html = '';
        for (const session of data.sessions) {
            html += `
                <div class="session-item">
                    <div>
                        <strong>${session.id}</strong><br>
                        Status: ${session.status}<br>
                        Created: ${new Date(session.created).toLocaleString()}
                    </div>
                    <div class="session-actions">
                        <button onclick="downloadSession('${session.id}')">Download ZIP</button>
                        <button onclick="deleteSession('${session.id}')">Delete</button>
                    </div>
                </div>
            `;
        }
        
        sessionsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

async function downloadSession(sessionId) {
    window.location.href = `/api/session/${sessionId}/download`;
}

async function deleteSession(sessionId) {
    if (confirm(`Are you sure you want to delete session ${sessionId}?`)) {
        try {
            const response = await fetch(`/api/session/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('Session deleted successfully');
                loadSessions();
            } else {
                alert('Error deleting session');
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// Load sessions on page load
loadSessions();
