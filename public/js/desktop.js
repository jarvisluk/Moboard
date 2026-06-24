// Desktop Companion Controller
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const badgeConnection = document.getElementById('connection-badge');
    const txtRoomId = document.getElementById('room-id');
    const txtServerStatus = document.getElementById('server-status');
    const logList = document.getElementById('log-list');
    const qrcodeContainer = document.getElementById('qrcode');
    
    const btnCopyRoom = document.getElementById('btn-copy-room');
    const btnClearLog = document.getElementById('btn-clear-log');
    const btnTestInject = document.getElementById('btn-test-inject');
    
    const settingAutoPaste = document.getElementById('setting-auto-paste');
    const settingSound = document.getElementById('setting-sound');
    const soundPaste = document.getElementById('sound-paste');
    const settingMobileUrl = document.getElementById('setting-mobile-url');

    let peer = null;
    let peerId = '';
    let conn = null;
    let permissionRequestInFlight = false;

    // Public hosted URL for mobile client (HTTPS secure context)
    const DEFAULT_MOBILE_URL = 'https://moboard.pages.dev/';
    const MOBILE_URL_STORAGE_KEY = 'moboard_mobile_url';
    const DESKTOP_PEER_PREFIX = 'moboard-desktop';
    
    // Load saved custom URL or default
    let mobileUrl = localStorage.getItem(MOBILE_URL_STORAGE_KEY) || DEFAULT_MOBILE_URL;
    if (settingMobileUrl) {
        settingMobileUrl.value = mobileUrl;
    }

    // 1. Check Local Node.js Server Status
    checkServerStatus();

    // 2. Fetch Public IP and Initialize PeerJS
    fetchPublicIPAndStart();

    // Initialize Lucide Icons
    lucide.createIcons();

    // 3. Copy Room ID Button
    btnCopyRoom.addEventListener('click', () => {
        const roomId = txtRoomId.textContent;
        if (roomId && roomId !== '------') {
            navigator.clipboard.writeText(roomId);
            showToast('Room ID copied to clipboard!');
        }
    });

    // 4. Test Injection Button
    btnTestInject.addEventListener('click', () => {
        injectTextLocal('Moboard test paste completed successfully. [Test]');
    });

    // 5. Clear Log Button
    btnClearLog.addEventListener('click', () => {
        logList.innerHTML = `
            <div class="log-empty">
                <span class="empty-icon"><i data-lucide="message-square"></i></span>
                <p>No voice input received yet.<br>Connect your phone and start speaking!</p>
            </div>
        `;
        lucide.createIcons();
        showToast('Logs cleared');
    });

    // 6. Mobile URL Change Listener
    if (settingMobileUrl) {
        settingMobileUrl.addEventListener('input', () => {
            let val = settingMobileUrl.value.trim();
            if (!val) {
                val = DEFAULT_MOBILE_URL;
            }
            localStorage.setItem(MOBILE_URL_STORAGE_KEY, val);
            
            // Regenerate QR code immediately
            const currentCode = txtRoomId.textContent;
            if (currentCode && currentCode !== '------') {
                generatePairingQRCode(currentCode);
            }
        });
    }

    // --- Core WebRTC Functions ---

    function fetchPublicIPAndStart() {
        // Fetch public IP to generate auto-discovery Room ID
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                const ip = data.ip;
                console.log('[Desktop] Public IP detected:', ip);
                
                // Hash public IP into a 6-character room code
                const code = hashIP(ip);
                peerId = `${DESKTOP_PEER_PREFIX}-${code}`;
                txtRoomId.textContent = code;
                
                initializePeer(peerId, code);
            })
            .catch(err => {
                console.error('[Desktop] Failed to fetch public IP, generating random room ID:', err);
                const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                peerId = `${DESKTOP_PEER_PREFIX}-${randomCode}`;
                txtRoomId.textContent = randomCode;
                initializePeer(peerId, randomCode);
            });
    }

    function hashIP(ip) {
        let hash = 0;
        for (let i = 0; i < ip.length; i++) {
            hash = (hash << 5) - hash + ip.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        // Convert to base 36 and take 6 characters
        return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
    }

    function initializePeer(id, code) {
        console.log('[Desktop] Initializing PeerJS with ID:', id);
        
        peer = new Peer(id, {
            debug: 1 // Print errors only
        });

        peer.on('open', () => {
            console.log('[Desktop] PeerJS connection open. Listening for devices...');
            updateConnectionStatus('waiting');
            generatePairingQRCode(code);
        });

        peer.on('connection', (connection) => {
            console.log('[Desktop] Connection request from:', connection.peer);
            
            // Set up connection
            conn = connection;
            setupConnectionEvents(conn);
        });

        peer.on('error', (err) => {
            console.error('[Desktop] PeerJS error:', err);
            if (err.type === 'unavailable-id') {
                showToast('Error: Peer ID already in use. Retrying...', 'error');
                // Retry with a random appendix
                setTimeout(() => {
                    const randomSuffix = Math.floor(100 + Math.random() * 900);
                    initializePeer(`${id}-${randomSuffix}`, `${code}-${randomSuffix}`);
                }, 2000);
            } else {
                updateConnectionStatus('disconnected');
            }
        });
    }

    function setupConnectionEvents(connection) {
        connection.on('open', () => {
            console.log('[Desktop] Connected to mobile client!');
            updateConnectionStatus('connected', connection.metadata?.deviceName || 'Mobile Phone');
            showToast('Phone connected successfully!');
        });

        connection.on('data', (data) => {
            console.log('[Desktop] Data received:', data);
            if (data && data.text) {
                // Add to GUI log
                addLogItem(data.text);
                
                // Play notification sound
                if (settingSound.checked) {
                    soundPaste.currentTime = 0;
                    soundPaste.play().catch(e => console.log('Audio play failed:', e));
                }

                // Inject text into cursor
                if (settingAutoPaste.checked) {
                    injectTextLocal(data.text);
                } else {
                    showToast('Text received (Auto-paste disabled)');
                }
            }
        });

        connection.on('close', () => {
            console.log('[Desktop] Connection closed');
            updateConnectionStatus('waiting');
            showToast('Phone disconnected');
        });

        connection.on('error', (err) => {
            console.error('[Desktop] Connection error:', err);
            updateConnectionStatus('waiting');
        });
    }

    function generatePairingQRCode(code) {
        // Construct mobile URL with pairing arguments
        const baseUrl = localStorage.getItem(MOBILE_URL_STORAGE_KEY) || DEFAULT_MOBILE_URL;
        const url = `${baseUrl}?peerId=${DESKTOP_PEER_PREFIX}-${code}&roomCode=${code}`;
        console.log('[Desktop] Mobile URL:', url);
        
        qrcodeContainer.innerHTML = '';
        QRCode.toCanvas(document.createElement('canvas'), url, {
            width: 200,
            margin: 1,
            color: {
                dark: '#0a0915',
                light: '#ffffff'
            }
        }, (err, canvas) => {
            if (err) {
                console.error('[Desktop] QR code generation failed:', err);
                qrcodeContainer.innerHTML = '<span class="text-error">QR code failed</span>';
                return;
            }
            qrcodeContainer.appendChild(canvas);
        });
    }

    // --- Helper Functions ---

    function checkServerStatus() {
        // Query the local server without triggering paste automation.
        fetch('/health')
        .then(res => res.json())
        .then(data => {
            const accessibility = data.accessibility;
            if (accessibility && accessibility.required && accessibility.trusted === false) {
                txtServerStatus.textContent = 'Active (Needs Accessibility)';
                txtServerStatus.style.color = '#fbbf24';
            } else {
                txtServerStatus.textContent = 'Active (Ready)';
                txtServerStatus.style.color = '#34d399';
            }
        })
        .catch(err => {
            txtServerStatus.textContent = 'Connecting to Local Server...';
            txtServerStatus.style.color = '#fbbf24';
            setTimeout(checkServerStatus, 3000);
        });
    }

    function injectTextLocal(text) {
        // Send a POST request to the local Node.js server to paste the text
        fetch('/inject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                showToast('Pasting failed: ' + (data.error || 'Unknown error'), 'error');

                if (data.requiresAccessibility) {
                    requestMacPermission('/accessibility/request');
                } else if (data.requiresAutomation) {
                    requestMacPermission('/automation/request');
                }
            }
        })
        .catch(err => {
            console.error('[Desktop] Failed to call local server /inject API:', err);
            showToast('Local Node.js server unreachable', 'error');
        });
    }

    function requestMacPermission(endpoint) {
        if (permissionRequestInFlight) {
            return;
        }

        permissionRequestInFlight = true;
        fetch(endpoint, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (!data.success && !data.settingsOpened) {
                    showToast(data.message || 'Open macOS Privacy & Security settings to finish permission setup.', 'error');
                }
            })
            .catch(err => {
                console.error('[Desktop] Failed to request macOS permission:', err);
            })
            .finally(() => {
                permissionRequestInFlight = false;
            });
    }

    function addLogItem(text) {
        // Remove empty log placeholder if it exists
        const emptyPlaceholder = logList.querySelector('.log-empty');
        if (emptyPlaceholder) {
            logList.innerHTML = '';
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.innerHTML = `
            <div class="log-meta">
                <span>Pasted Successfully</span>
                <span>${timeStr}</span>
            </div>
            <div class="log-text">${escapeHTML(text)}</div>
        `;
        logList.insertBefore(logItem, logList.firstChild);
    }

    function updateConnectionStatus(status, deviceName = '') {
        badgeConnection.className = 'badge';
        if (status === 'connected') {
            badgeConnection.classList.add('badge-connected');
            badgeConnection.textContent = `Connected to ${deviceName}`;
        } else if (status === 'waiting') {
            badgeConnection.classList.add('badge-connecting');
            badgeConnection.textContent = 'Waiting for phone...';
        } else {
            badgeConnection.classList.add('badge-disconnected');
            badgeConnection.textContent = 'Disconnected';
        }
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
            <span>${escapeHTML(message)}</span>
        `;
        container.appendChild(toast);
        lucide.createIcons();
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px) scale(0.9)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
