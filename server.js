const express = require('express');
const cors = require('cors');
const { exec, execFile } = require('child_process');
const path = require('path');
const os = require('os');

// Prevent EPIPE errors from crashing the app when stdout/stderr has no consumer (e.g. Electron without a terminal)
if (process.stdout && process.stdout.on) {
    process.stdout.on('error', (err) => { if (err.code !== 'EPIPE') throw err; });
}
if (process.stderr && process.stderr.on) {
    process.stderr.on('error', (err) => { if (err.code !== 'EPIPE') throw err; });
}
// Catch any other uncaught exceptions to prevent the app from crashing
process.on('uncaughtException', (err) => {
    if (err.code !== 'EPIPE') {
        // Re-throw non-EPIPE errors so they are not silently swallowed
        throw err;
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
const APP_NAME = 'Moboard';
const ACCESSIBILITY_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const AUTOMATION_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getElectronApi() {
    if (!process.versions || !process.versions.electron) {
        return null;
    }

    try {
        const electron = require('electron');
        return electron && typeof electron === 'object' ? electron : null;
    } catch (err) {
        console.warn('[Permissions] Electron API unavailable:', err.message || err);
        return null;
    }
}

function getAppName() {
    const electron = getElectronApi();
    if (electron && electron.app && typeof electron.app.getName === 'function') {
        try {
            return electron.app.getName() || APP_NAME;
        } catch (err) {
            console.warn('[Permissions] Failed to read Electron app name:', err.message || err);
        }
    }

    return APP_NAME;
}

function getMacAccessibilityStatus(prompt = false) {
    const platform = os.platform();
    const baseStatus = {
        platform,
        required: platform === 'darwin',
        supported: false,
        trusted: platform !== 'darwin',
        canPrompt: false,
        appName: getAppName()
    };

    if (platform !== 'darwin') {
        return baseStatus;
    }

    const electron = getElectronApi();
    if (!electron || !electron.systemPreferences || typeof electron.systemPreferences.isTrustedAccessibilityClient !== 'function') {
        return {
            ...baseStatus,
            trusted: null,
            message: 'Accessibility status is only available inside the Electron desktop app.'
        };
    }

    try {
        return {
            ...baseStatus,
            supported: true,
            canPrompt: true,
            trusted: electron.systemPreferences.isTrustedAccessibilityClient(prompt)
        };
    } catch (err) {
        return {
            ...baseStatus,
            trusted: null,
            error: err.message || String(err)
        };
    }
}

function openMacSettings(url) {
    const electron = getElectronApi();
    if (electron && electron.shell && typeof electron.shell.openExternal === 'function') {
        return electron.shell.openExternal(url)
            .then(() => ({ opened: true }))
            .catch((err) => ({ opened: false, error: err.message || String(err) }));
    }

    return new Promise((resolve) => {
        execFile('/usr/bin/open', [url], (err) => {
            resolve(err ? { opened: false, error: err.message || String(err) } : { opened: true });
        });
    });
}

function macAccessibilityPermissionMessage() {
    const appName = getAppName();
    return `macOS Accessibility permission required. Enable "${appName}" in System Settings -> Privacy & Security -> Accessibility, then restart the app. If you launched with npm start, macOS may list Terminal, your shell app, or Electron instead. (Text has been copied to your clipboard; you can manually paste it using Cmd+V)`;
}

function macAutomationPermissionMessage() {
    const appName = getAppName();
    return `macOS Automation permission required. Enable "${appName}" to control System Events in System Settings -> Privacy & Security -> Automation, then try again. (Text has been copied to your clipboard; you can manually paste it using Cmd+V)`;
}

function classifyMacPasteError(err) {
    const message = err && (err.message || String(err));
    if (!message) {
        return 'unknown';
    }

    if (
        message.includes('Not authorized to send Apple events') ||
        message.includes('not authorized to send apple events') ||
        message.includes('-1743')
    ) {
        return 'automation';
    }

    if (
        message.includes('not allowed to send keystrokes') ||
        message.includes('assistive access') ||
        message.includes('System Events got an error')
    ) {
        return 'accessibility';
    }

    return 'unknown';
}

app.get('/health', (req, res) => {
    res.json({
        success: true,
        platform: os.platform(),
        port: global.SERVER_PORT || PORT,
        accessibility: getMacAccessibilityStatus(false)
    });
});

app.get('/accessibility/status', (req, res) => {
    res.json({
        success: true,
        accessibility: getMacAccessibilityStatus(false)
    });
});

app.post('/accessibility/request', async (req, res) => {
    let accessibility = getMacAccessibilityStatus(false);

    if (accessibility.required && accessibility.supported && accessibility.trusted === false) {
        accessibility = getMacAccessibilityStatus(true);
    }

    const settingsResult = accessibility.required && accessibility.trusted !== true
        ? await openMacSettings(ACCESSIBILITY_SETTINGS_URL)
        : { opened: false };

    res.json({
        success: accessibility.trusted === true,
        accessibility,
        settingsOpened: settingsResult.opened,
        error: settingsResult.error,
        message: accessibility.trusted === true
            ? 'Accessibility access is already granted.'
            : macAccessibilityPermissionMessage()
    });
});

app.post('/automation/request', async (req, res) => {
    const settingsResult = os.platform() === 'darwin'
        ? await openMacSettings(AUTOMATION_SETTINGS_URL)
        : { opened: false };

    res.json({
        success: settingsResult.opened,
        settingsOpened: settingsResult.opened,
        error: settingsResult.error,
        message: macAutomationPermissionMessage()
    });
});

// Text Injection Endpoint
app.post('/inject', (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ success: false, error: 'No text provided' });
    }

    console.log(`[Inject] Received text to inject: "${text}"`);
    
    const platform = os.platform();
    if (platform === 'darwin') {
        injectMac(text, res);
    } else if (platform === 'win32') {
        injectWindows(text, res);
    } else if (platform === 'linux') {
        injectLinux(text, res);
    } else {
        res.status(500).json({ success: false, error: `Unsupported platform: ${platform}` });
    }
});

// Key Press Endpoint
app.post('/key', (req, res) => {
    const { key } = req.body;
    if (key !== 'Enter') {
        return res.status(400).json({ success: false, error: 'Unsupported key' });
    }

    console.log(`[Key] Received key press: "${key}"`);

    const platform = os.platform();
    if (platform === 'darwin') {
        pressMacKey(key, res);
    } else if (platform === 'win32') {
        pressWindowsKey(key, res);
    } else if (platform === 'linux') {
        pressLinuxKey(key, res);
    } else {
        res.status(500).json({ success: false, error: `Unsupported platform: ${platform}` });
    }
});

const MAC_UTF8_ENV = {
    ...process.env,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    LC_CTYPE: 'UTF-8'
};

function getElectronClipboard() {
    if (!process.versions || !process.versions.electron) {
        return null;
    }

    try {
        return require('electron').clipboard;
    } catch (err) {
        console.warn('[Mac Inject] Electron clipboard unavailable, falling back to pbcopy:', err.message || err);
        return null;
    }
}

function writeMacClipboardWithPbcopy(text, callback) {
    let done = false;
    const finish = (err) => {
        if (done) return;
        done = true;
        callback(err);
    };

    const copyProc = execFile('/usr/bin/pbcopy', [], { env: MAC_UTF8_ENV }, finish);
    copyProc.stdin.on('error', finish);
    copyProc.stdin.end(Buffer.from(text, 'utf8'));
}

function pasteMacClipboard(res, restoreClipboard) {
    const accessibility = getMacAccessibilityStatus(false);
    if (accessibility.required && accessibility.supported && accessibility.trusted === false) {
        return res.status(200).json({
            success: false,
            error: macAccessibilityPermissionMessage(),
            code: 'mac_accessibility_missing',
            copiedToClipboard: true,
            requiresAccessibility: true,
            accessibility
        });
    }

    const appleScript = 'tell application "System Events" to keystroke "v" using command down';
    execFile('/usr/bin/osascript', ['-e', appleScript], (pasteErr) => {
        if (pasteErr) {
            console.error('[Mac Inject] AppleScript paste failed:', pasteErr.message || pasteErr);

            const failureType = classifyMacPasteError(pasteErr);
            const errorMsg = failureType === 'accessibility'
                ? macAccessibilityPermissionMessage()
                : failureType === 'automation'
                    ? macAutomationPermissionMessage()
                    : 'Keystroke automation failed. (Text has been copied to your clipboard; you can manually paste it using Cmd+V)';

            return res.status(200).json({
                success: false,
                error: errorMsg,
                code: failureType === 'accessibility'
                    ? 'mac_accessibility_missing'
                    : failureType === 'automation'
                        ? 'mac_automation_missing'
                        : 'mac_paste_failed',
                copiedToClipboard: true,
                requiresAccessibility: failureType === 'accessibility',
                requiresAutomation: failureType === 'automation'
            });
        }

        // Respond immediately so the client UI remains responsive
        res.json({ success: true });

        // Restore the original clipboard content after a short delay
        setTimeout(() => {
            try {
                restoreClipboard();
            } catch (restoreErr) {
                console.error('[Mac Inject] Clipboard restore failed:', restoreErr.message || restoreErr);
            }
        }, 250);
    });
}

function pressMacKey(key, res) {
    const accessibility = getMacAccessibilityStatus(false);
    if (accessibility.required && accessibility.supported && accessibility.trusted === false) {
        return res.status(200).json({
            success: false,
            error: macAccessibilityPermissionMessage(),
            code: 'mac_accessibility_missing',
            requiresAccessibility: true,
            accessibility
        });
    }

    const keyCodes = {
        Enter: 36
    };
    const keyCode = keyCodes[key];
    if (!keyCode) {
        return res.status(400).json({ success: false, error: 'Unsupported key' });
    }

    const appleScript = `tell application "System Events" to key code ${keyCode}`;
    execFile('/usr/bin/osascript', ['-e', appleScript], (pressErr) => {
        if (pressErr) {
            console.error('[Mac Key] AppleScript key press failed:', pressErr.message || pressErr);

            const failureType = classifyMacPasteError(pressErr);
            const errorMsg = failureType === 'accessibility'
                ? macAccessibilityPermissionMessage()
                : failureType === 'automation'
                    ? macAutomationPermissionMessage()
                    : 'Keystroke automation failed.';

            return res.status(200).json({
                success: false,
                error: errorMsg,
                code: failureType === 'accessibility'
                    ? 'mac_accessibility_missing'
                    : failureType === 'automation'
                        ? 'mac_automation_missing'
                        : 'mac_key_failed',
                requiresAccessibility: failureType === 'accessibility',
                requiresAutomation: failureType === 'automation'
            });
        }

        res.json({ success: true });
    });
}

// macOS Text Injection using the Electron clipboard when packaged, with a UTF-8 pbcopy fallback
function injectMac(text, res) {
    const electronClipboard = getElectronClipboard();
    if (electronClipboard) {
        try {
            const backupText = electronClipboard.readText();
            electronClipboard.writeText(text);
            pasteMacClipboard(res, () => electronClipboard.writeText(backupText));
        } catch (err) {
            console.error('[Mac Inject] Electron clipboard write failed:', err.message || err);
            res.status(500).json({ success: false, error: 'Failed to write to clipboard' });
        }
        return;
    }

    // 1. Read current clipboard content to back it up
    execFile('/usr/bin/pbpaste', [], { encoding: 'utf8', env: MAC_UTF8_ENV }, (err, oldClipboard) => {
        const backupText = oldClipboard || '';

        // 2. Pipe the new text to pbcopy to set clipboard
        writeMacClipboardWithPbcopy(text, (copyErr) => {
            if (copyErr) {
                console.error('[Mac Inject] Copy failed:', copyErr);
                return res.status(500).json({ success: false, error: 'Failed to write to clipboard' });
            }

            // 3. Trigger AppleScript to press Command+V (Paste)
            pasteMacClipboard(res, () => writeMacClipboardWithPbcopy(backupText, (restoreErr) => {
                if (restoreErr) {
                    console.error('[Mac Inject] Clipboard restore failed:', restoreErr.message || restoreErr);
                }
            }));
        });
    });
}

// Windows Text Injection using PowerShell
function injectWindows(text, res) {
    // Escaping double quotes for PowerShell
    const escapedText = text.replace(/"/g, '`"');
    
    // PowerShell script to save clipboard, set new text, press Ctrl+V, then restore clipboard
    // Note: We run it in a single PowerShell command chain
    const powershellCmd = `powershell -Command "
        Add-Type -AssemblyName System.Windows.Forms;
        $oldText = '';
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            $oldText = [System.Windows.Forms.Clipboard]::GetText();
        }
        [System.Windows.Forms.Clipboard]::SetText(\\"${escapedText}\\");
        [System.Windows.Forms.SendKeys]::SendWait('^v');
        Start-Sleep -Milliseconds 250;
        if ($oldText -ne '') {
            [System.Windows.Forms.Clipboard]::SetText($oldText);
        } else {
            [System.Windows.Forms.Clipboard]::Clear();
        }
    "`;

    exec(powershellCmd, (err) => {
        if (err) {
            console.error('[Win Inject] PowerShell command failed:', err);
            return res.status(500).json({ success: false, error: 'PowerShell paste simulation failed' });
        }
        res.json({ success: true });
    });
}

function pressWindowsKey(key, res) {
    const sendKey = key === 'Enter' ? '{ENTER}' : '';
    if (!sendKey) {
        return res.status(400).json({ success: false, error: 'Unsupported key' });
    }

    const powershellCmd = `powershell -Command "
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait('${sendKey}');
    "`;

    exec(powershellCmd, (err) => {
        if (err) {
            console.error('[Win Key] PowerShell command failed:', err);
            return res.status(500).json({ success: false, error: 'PowerShell key simulation failed' });
        }
        res.json({ success: true });
    });
}

// Linux Text Injection using xclip and xdotool
function injectLinux(text, res) {
    const escapedText = text.replace(/"/g, '\\"');
    
    // Save clipboard, copy text, press Ctrl+V, and restore clipboard
    // Requires xclip and xdotool packages to be installed
    const linuxCmd = `
        OLD_CLIP=$(xclip -o -selection clipboard 2>/dev/null || echo "");
        echo -n "${escapedText}" | xclip -selection clipboard;
        xdotool key ctrl+v;
        sleep 0.25;
        echo -n "$OLD_CLIP" | xclip -selection clipboard;
    `;

    exec(linuxCmd, (err) => {
        if (err) {
            console.error('[Linux Inject] Linux inject command failed:', err);
            return res.status(500).json({ success: false, error: 'Linux xdotool paste failed' });
        }
        res.json({ success: true });
    });
}

function pressLinuxKey(key, res) {
    const xdotoolKey = key === 'Enter' ? 'Return' : '';
    if (!xdotoolKey) {
        return res.status(400).json({ success: false, error: 'Unsupported key' });
    }

    exec(`xdotool key ${xdotoolKey}`, (err) => {
        if (err) {
            console.error('[Linux Key] xdotool key failed:', err);
            return res.status(500).json({ success: false, error: 'Linux xdotool key failed' });
        }
        res.json({ success: true });
    });
}

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`=================================================`);
        console.log(`Moboard Server running on port ${port}`);
        console.log(`Open http://localhost:${port} in your computer browser`);
        console.log(`=================================================`);

        // Expose the actual port globally so other parts of the app can read it
        global.SERVER_PORT = port;
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${port} is already in use, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('[Server] Failed to start:', err);
            throw err;
        }
    });

    return server;
}

startServer(PORT);
