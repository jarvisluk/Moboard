const { app, BrowserWindow, Menu, systemPreferences, dialog, shell } = require('electron');
const path = require('path');

const APP_NAME = 'Moboard';
const ACCESSIBILITY_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

// 1. Boot up the local Express server inside the Electron app
require('./server.js');

function createWindow() {
    // 2. Create the browser window
    const mainWindow = new BrowserWindow({
        width: 960,
        height: 740,
        minWidth: 800,
        minHeight: 600,
        title: `${APP_NAME} Control Panel`,
        backgroundColor: '#0a0915', // Matches --bg-primary
        icon: path.join(__dirname, 'public', 'favicon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    // 3. Load the local Express server URL
    mainWindow.loadURL('http://localhost:3000');

    // 4. Customize the Menu Bar (clean and minimal)
    const template = [
        {
            label: 'Application',
            submenu: [
                { label: `About ${APP_NAME}`, role: 'about' },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'Command+Q', click: () => { app.quit(); } }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: 'Toggle Developer Tools', accelerator: 'Alt+CmdOrCtrl+I', role: 'toggleDevTools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        // Dereference window object
    });
}

async function openAccessibilitySettings() {
    try {
        await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
    } catch (err) {
        console.error('[Permissions] Failed to open Accessibility settings:', err.message || err);
    }
}

async function requestAccessibilityAccessIfNeeded() {
    if (process.platform !== 'darwin') {
        return;
    }

    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (trusted) {
        return;
    }

    // This registers the current app for Accessibility access. macOS may not
    // show a separate prompt again after the app was previously listed or denied.
    systemPreferences.isTrustedAccessibilityClient(true);

    const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Accessibility Permission Required',
        message: `${APP_NAME} needs Accessibility access to auto-paste text.`,
        detail: `macOS may not show a separate permission popup if ${APP_NAME} is already listed or was denied before.\n\nOpen System Settings, enable "${APP_NAME}" in Privacy & Security -> Accessibility, then restart the app.\n\nIf you launched the app with npm start, macOS may list Terminal, your shell app, or Electron instead.`,
        buttons: ['Open System Settings', 'OK'],
        defaultId: 0,
        cancelId: 1
    });

    if (response === 0) {
        await openAccessibilitySettings();
    }
}

// 5. App Lifecycle Listeners
app.whenReady().then(() => {
    app.setName(APP_NAME);
    createWindow();

    requestAccessibilityAccessIfNeeded().catch((err) => {
        console.error('[Permissions] Accessibility request failed:', err.message || err);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
