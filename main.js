const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const APP_NAME = 'Moboard';
let mainWindow = null;
let isQuitting = false;

// 1. Boot up the local Express server inside the Electron app
const serverRuntime = require('./server.js');

function createWindow(serverPort = serverRuntime.getPort()) {
    const isMac = process.platform === 'darwin';

    // 2. Create the browser window
    mainWindow = new BrowserWindow({
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
            sandbox: true,
            backgroundThrottling: false
        }
    });

    // 3. Load the local Express server URL
    mainWindow.loadURL(`http://localhost:${serverPort}`);

    // 4. Customize the Menu Bar (clean and minimal)
    const template = [
        {
            label: isMac ? 'Application' : 'File',
            submenu: [
                { label: `About ${APP_NAME}`, role: 'about' },
                { type: 'separator' },
                { label: isMac ? 'Quit' : 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit(); } }
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

    mainWindow.on('close', (event) => {
        if (process.platform === 'darwin' && !isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 5. App Lifecycle Listeners
app.whenReady().then(async () => {
    app.setName(APP_NAME);
    const { port } = await serverRuntime.ready;
    createWindow(port);

    app.on('activate', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
            return;
        }

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
    });
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
