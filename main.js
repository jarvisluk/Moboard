const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// 1. Boot up the local Express server inside the Electron app
require('./server.js');

function createWindow() {
    // 2. Create the browser window
    const mainWindow = new BrowserWindow({
        width: 960,
        height: 740,
        minWidth: 800,
        minHeight: 600,
        title: "Remote Keyboard Control Panel",
        backgroundColor: '#0a0915', // Matches --bg-primary
        icon: path.join(__dirname, 'public', 'favicon.ico'), // Fallback if icon exists
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
                { label: 'About Remote Keyboard', role: 'about' },
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

// 5. App Lifecycle Listeners
app.whenReady().then(() => {
    createWindow();

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
