const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// macOS Text Injection using pbcopy/pbpaste and AppleScript
function injectMac(text, res) {
    // 1. Read current clipboard content to back it up
    exec('pbpaste', (err, oldClipboard) => {
        const backupText = oldClipboard || '';

        // 2. Pipe the new text to pbcopy to set clipboard
        const copyProc = exec('pbcopy', (copyErr) => {
            if (copyErr) {
                console.error('[Mac Inject] Copy failed:', copyErr);
                return res.status(500).json({ success: false, error: 'Failed to write to clipboard' });
            }

            // 3. Trigger AppleScript to press Command+V (Paste)
            const appleScript = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
            exec(appleScript, (pasteErr) => {
                if (pasteErr) {
                    console.error('[Mac Inject] AppleScript paste failed:', pasteErr);
                    return res.status(500).json({ success: false, error: 'Keystroke automation failed' });
                }

                // Respond immediately so the client UI remains responsive
                res.json({ success: true });

                // 4. Restore the original clipboard content after a short delay
                setTimeout(() => {
                    const restoreProc = exec('pbcopy');
                    restoreProc.stdin.write(backupText);
                    restoreProc.stdin.end();
                }, 250);
            });
        });

        // Write the text to be pasted to pbcopy's stdin
        copyProc.stdin.write(text);
        copyProc.stdin.end();
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

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`Remote Keyboard Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your computer browser`);
    console.log(`=================================================`);
});
