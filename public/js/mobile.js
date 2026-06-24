// Mobile Client Controller
document.addEventListener('DOMContentLoaded', () => {
    // UI Screens & Controls
    const screenPair = document.getElementById('pair-screen');
    const screenDictation = document.getElementById('dictation-screen');
    const bottomControls = document.getElementById('bottom-controls');
    const badgeStatus = document.getElementById('mobile-badge');
    
    // Pairing Controls
    const codeInputs = document.querySelectorAll('.code-input-char');
    const btnPair = document.getElementById('btn-pair');
    
    // Dictation Controls
    const editor = document.getElementById('editor');
    const charCount = document.getElementById('char-count');
    const btnClearEditor = document.getElementById('btn-clear-editor');
    
    const btnMic = document.getElementById('btn-mic');
    const micIconWrapper = document.getElementById('mic-icon-wrapper');
    const recordStatus = document.getElementById('record-status');
    const settingAutoSend = document.getElementById('setting-auto-send');
    const langSelect = document.getElementById('lang-select');
    const btnSendText = document.getElementById('btn-send-text');

    let peer = null;
    let conn = null;
    let isConnected = false;
    let targetDesktopPeerId = '';
    
    // Speech Recognition
    let recognition = null;
    let isRecording = false;
    let lastSentIndex = 0;

    // 1. Code Input Tab Automation
    setupCodeInputTabs();

    // Initialize Lucide Icons
    lucide.createIcons();

    // 2. Parse URL parameters (check if QR code scanned)
    const urlParams = new URLSearchParams(window.location.search);
    const paramPeerId = urlParams.get('peerId');
    const paramRoomCode = urlParams.get('roomCode');

    if (paramPeerId) {
        console.log('[Mobile] Peer ID found in URL:', paramPeerId);
        targetDesktopPeerId = paramPeerId;
        // Autofill inputs for visual confirmation
        if (paramRoomCode && paramRoomCode.length === 6) {
            for (let i = 0; i < 6; i++) {
                codeInputs[i].value = paramRoomCode[i];
            }
        }
        connectToPC(targetDesktopPeerId);
    } else {
        // No URL param, try Auto-Discovery via Public IP
        autoDiscoverPC();
    }

    // 3. Manual Pairing Button
    btnPair.addEventListener('click', () => {
        let code = '';
        codeInputs.forEach(input => code += input.value.trim().toUpperCase());
        
        if (code.length !== 6) {
            showToast('Please enter the 6-character code', 'error');
            return;
        }
        
        targetDesktopPeerId = `rk-desktop-${code}`;
        connectToPC(targetDesktopPeerId);
    });

    // 4. Send Text Button
    btnSendText.addEventListener('click', () => {
        const text = editor.value.trim();
        if (!text) {
            showToast('Please speak or type some text first', 'error');
            return;
        }
        sendTextOverWebRTC(text);
        editor.value = '';
        updateCharCount();
        showToast('Sent!');
    });

    // 5. Clear Editor Button
    btnClearEditor.addEventListener('click', () => {
        editor.value = '';
        updateCharCount();
    });

    // 6. Character Count Listener
    editor.addEventListener('input', updateCharCount);

    // 7. Mic Toggle Button
    btnMic.addEventListener('click', toggleRecording);

    // --- Pairing Screen Logic ---

    function setupCodeInputTabs() {
        codeInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value.length >= 1) {
                    // Move to next input
                    if (index < codeInputs.length - 1) {
                        codeInputs[index + 1].focus();
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    // Move back on backspace
                    codeInputs[index - 1].focus();
                }
            });
        });
        
        // Default show pairing screen initially
        screenPair.style.display = 'block';
    }

    // --- Auto-Discovery via Public IP ---

    function autoDiscoverPC() {
        updateBadgeStatus('connecting', 'Locating PC...');
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                const ip = data.ip;
                const code = hashIP(ip);
                console.log('[Mobile] IP detected. Matching Room Code:', code);
                
                targetDesktopPeerId = `rk-desktop-${code}`;
                // Attempt connection
                connectToPC(targetDesktopPeerId, true); // true for silent background check
            })
            .catch(err => {
                console.warn('[Mobile] Auto-discovery failed (offline or blocked). Show manual entry.', err);
                updateBadgeStatus('disconnected');
                screenPair.style.display = 'block';
            });
    }

    function hashIP(ip) {
        let hash = 0;
        for (let i = 0; i < ip.length; i++) {
            hash = (hash << 5) - hash + ip.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
    }

    // --- WebRTC Connection Logic ---

    function connectToPC(targetId, silent = false) {
        if (!silent) {
            updateBadgeStatus('connecting');
            btnPair.disabled = true;
            btnPair.textContent = 'Connecting...';
        }

        // Initialize PeerJS for Mobile Client (with a random suffix ID)
        const mobilePeerId = `rk-mobile-${Math.random().toString(36).substring(2, 7)}`;
        
        if (peer) {
            peer.destroy();
        }

        peer = new Peer(mobilePeerId, {
            debug: 1
        });

        peer.on('open', () => {
            console.log('[Mobile] PeerJS ready. Connecting to Desktop ID:', targetId);
            
            // Connect to desktop companion
            const connection = peer.connect(targetId, {
                metadata: {
                    deviceName: getDeviceLabel()
                }
            });

            setupConnectionEvents(connection, silent);
        });

        peer.on('error', (err) => {
            console.error('[Mobile] PeerJS error:', err);
            handleConnectionFailure(silent);
        });
    }

    function setupConnectionEvents(connection, silent) {
        connection.on('open', () => {
            console.log('[Mobile] WebRTC Channel Opened!');
            conn = connection;
            isConnected = true;
            
            // UI Transition
            screenPair.style.display = 'none';
            screenDictation.style.display = 'flex';
            bottomControls.style.display = 'flex';
            
            updateBadgeStatus('connected');
            showToast('Connected to PC!');
            
            // Init speech recognition
            initSpeechRecognition();
        });

        connection.on('close', () => {
            console.log('[Mobile] Connection closed by PC');
            handleDisconnect();
        });

        connection.on('error', (err) => {
            console.error('[Mobile] WebRTC Connection error:', err);
            handleConnectionFailure(silent);
        });
    }

    function handleConnectionFailure(silent) {
        isConnected = false;
        if (!silent) {
            showToast('Failed to connect. Double check code/network.', 'error');
            updateBadgeStatus('disconnected');
            btnPair.disabled = false;
            btnPair.textContent = 'Connect to PC';
            screenPair.style.display = 'block';
        } else {
            // Auto-discovery failed silently, show manual screen
            updateBadgeStatus('disconnected');
            screenPair.style.display = 'block';
        }
    }

    function handleDisconnect() {
        isConnected = false;
        updateBadgeStatus('disconnected');
        showToast('Disconnected from PC', 'error');
        
        // UI Reset
        screenDictation.style.display = 'none';
        bottomControls.style.display = 'none';
        screenPair.style.display = 'block';
        btnPair.disabled = false;
        btnPair.textContent = 'Connect to PC';
        
        if (isRecording) {
            stopRecording();
        }
    }

    function sendTextOverWebRTC(textToSend) {
        if (conn && isConnected) {
            conn.send({ text: textToSend });
        } else {
            showToast('Not connected to PC', 'error');
        }
    }

    // --- Web Speech API Logic ---

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            recordStatus.textContent = 'Speech recognition not supported in this browser.';
            btnMic.disabled = true;
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onstart = () => {
            isRecording = true;
            btnMic.classList.add('recording');
            micIconWrapper.innerHTML = '<i data-lucide="square"></i>';
            lucide.createIcons();
            recordStatus.textContent = 'Listening... Speak now';
            recordStatus.className = 'record-status status-listening';
            lastSentIndex = 0;
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            // Loop through speech recognition results
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    
                    // Stream in real-time if Auto-Send is on
                    if (settingAutoSend.checked && i >= lastSentIndex) {
                        sendTextOverWebRTC(transcript);
                        lastSentIndex = i + 1;
                    }
                } else {
                    interimTranscript += transcript;
                }
            }

            // Append final transcripts and show interim results in editor
            if (finalTranscript) {
                editor.value += finalTranscript;
            }
            
            // Temporarily append interim results to textarea for feedback, without saving them
            const baseText = editor.value;
            if (interimTranscript) {
                editor.value = baseText + interimTranscript;
            }
            
            // Reset back to base text if no interim results are pending
            if (!interimTranscript && finalTranscript) {
                editor.value = baseText;
            }
            
            updateCharCount();
        };

        recognition.onerror = (event) => {
            console.error('[Speech Recognition] Error:', event.error);
            if (event.error === 'not-allowed') {
                showToast('Microphone access denied', 'error');
                stopRecording();
            }
        };

        recognition.onend = () => {
            // Auto restart if still recording (iOS/Chrome sometimes timeout)
            if (isRecording) {
                recognition.start();
            } else {
                btnMic.classList.remove('recording');
                micIconWrapper.innerHTML = '<i data-lucide="mic"></i>';
                lucide.createIcons();
                recordStatus.textContent = 'Recording stopped';
                recordStatus.className = 'record-status status-idle';
            }
        };
    }

    function toggleRecording() {
        if (!recognition) return;
        
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        if (!recognition) return;
        editor.focus();
        recognition.lang = langSelect.value;
        recognition.start();
    }

    function stopRecording() {
        if (!recognition) return;
        isRecording = false;
        recognition.stop();
    }

    // --- Helper Functions ---

    function getDeviceLabel() {
        const userAgent = navigator.userAgent;
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iPhone';
        if (/Android/.test(userAgent)) return 'Android Device';
        if (/Macintosh/.test(userAgent)) return 'Mac';
        if (/Windows/.test(userAgent)) return 'Windows PC';
        return 'Mobile Browser';
    }

    function updateCharCount() {
        const len = editor.value.length;
        charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
    }

    function updateBadgeStatus(status, text = '') {
        badgeStatus.className = 'badge';
        if (status === 'connected') {
            badgeStatus.classList.add('badge-connected');
            badgeStatus.textContent = 'Connected';
        } else if (status === 'connecting') {
            badgeStatus.classList.add('badge-connecting');
            badgeStatus.textContent = text || 'Connecting...';
        } else {
            badgeStatus.classList.add('badge-disconnected');
            badgeStatus.textContent = 'Offline';
        }
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
            <span>${message}</span>
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
});
