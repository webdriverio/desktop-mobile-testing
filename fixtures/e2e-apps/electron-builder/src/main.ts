import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';

// Global storage for received deeplinks (for test verification)
declare global {
  var receivedDeeplinks: string[];
  var deeplinkCount: number;
}

globalThis.receivedDeeplinks = [];
globalThis.deeplinkCount = 0;

const isTest = process.env.TEST === 'true';
const isSplashEnabled = Boolean(process.env.ENABLE_SPLASH_WINDOW);
const PROTOCOL = 'testapp';

const appPath = app.getAppPath();
const appRootPath = `${appPath}/dist`;
const resourcePaths = {
  preloadJs: `${appRootPath}/preload.cjs`,
  splashHtml: `${appRootPath}/splash.html`,
  indexHtml: `${appRootPath}/index.html`,
} as const;

let mainWindow: BrowserWindow;
let splashWindow: BrowserWindow;

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    x: 25,
    y: 35,
    width: 200,
    height: 300,
    webPreferences: {
      preload: resourcePaths.preloadJs,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow.destroy();
  });
  mainWindow.loadFile(resourcePaths.indexHtml);

  mainWindow.on('ready-to-show', () => {
    mainWindow.title = 'this is the title of the main window';
    // mainWindow.webContents.openDevTools();
  });
};

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    x: 25,
    y: 110,
    width: 200,
    height: 200,
    frame: false,
    webPreferences: {
      preload: resourcePaths.preloadJs,
      sandbox: !isTest,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile(resourcePaths.splashHtml);
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
};

// Parse userData from command line on Windows BEFORE app.ready
// This must be done early to ensure single instance lock works correctly
if (process.platform === 'win32') {
  const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) {
    try {
      const parsed = new URL(url);
      const userDataPath = parsed.searchParams.get('userData');
      if (userDataPath) {
        console.log(`[Deeplink] Setting userData path from deeplink: ${userDataPath}`);
        app.setPath('userData', userDataPath);
      }
    } catch (error) {
      console.error('[Deeplink] Failed to parse deeplink URL:', error);
    }
  }
}

// Register protocol handler
// In development (when using electron directly), we need to specify the path
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // In production (packaged app), just register the protocol
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Implement single instance lock for deeplink handling
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Deeplink] Another instance is already running. Quitting...');
  app.quit();
} else {
  // Handle second-instance event (when deeplink triggers while app is running)
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    console.log('[Deeplink] Second instance detected, command line:', commandLine);

    // Find the deeplink URL in command line arguments
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleDeeplink(url);
    }

    // Focus the main window if it exists
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // Handle deeplink on macOS (open-url event)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('[Deeplink] open-url event:', url);
    handleDeeplink(url);
  });
}

app.on('ready', () => {
  console.log('main log');
  console.warn('main warn');
  console.error('main error');

  if (isSplashEnabled) {
    createSplashWindow();

    // to minimize the E2E test duration, we can switch to the main window programmatically
    ipcMain.handle('switch-main-window', () => {
      splashWindow.hide();
      createMainWindow();
      splashWindow.destroy();
    });
  } else {
    createMainWindow();
  }

  ipcMain.handle('increase-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height + 10, width: bounds.width + 10 });
  });

  ipcMain.handle('decrease-window-size', () => {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({ ...bounds, height: bounds.height - 10, width: bounds.width - 10 });
  });

  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select txt',
      filters: [
        { name: 'TXT', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'openDirectory'],
    });
    console.log(result);
    return result;
  });

  // Check if app was launched with a deeplink URL (Windows/Linux)
  const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) {
    console.log('[Deeplink] App launched with deeplink:', url);
    handleDeeplink(url);
  }
});

function handleDeeplink(url: string) {
  console.log('[Deeplink] Handling deeplink:', url);

  try {
    // Parse the URL
    const parsed = new URL(url);

    // Remove userData parameter before storing (it's only for internal use)
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('userData');
    const cleanUrlString = cleanUrl.toString();

    // Store the received deeplink for test verification
    globalThis.receivedDeeplinks.push(cleanUrlString);
    globalThis.deeplinkCount++;

    console.log('[Deeplink] Stored deeplink:', cleanUrlString);
    console.log('[Deeplink] Total deeplinks received:', globalThis.deeplinkCount);
    console.log('[Deeplink] All deeplinks:', globalThis.receivedDeeplinks);

    // Update the UI if window exists
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('deeplink-received', {
        url: cleanUrlString,
        protocol: parsed.protocol,
        host: parsed.host,
        pathname: parsed.pathname,
        search: parsed.search,
        searchParams: Object.fromEntries(parsed.searchParams.entries()),
      });
    }
  } catch (error) {
    console.error('[Deeplink] Failed to handle deeplink:', error);
  }
}
