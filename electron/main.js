/**
 * Electron 主进程
 * 直接操作文件系统，无需数据服务器
 */

import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electron;
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置文件路径（用于存储用户选择的数据目录）
const CONFIG_FILE = path.join(app.getPath('userData'), 'app-config.json');

// 读取配置文件
function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const content = fs.readFileSync(CONFIG_FILE, 'utf8');
            return content ? JSON.parse(content) : {};
        }
    } catch (e) {
        console.error(`Error reading config:`, e);
    }
    return {};
}

// 写入配置文件
function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing config:`, e);
        return false;
    }
}

// 获取数据目录（优先使用用户选择的目录）
function getDataDir() {
    const config = readConfig();
    if (config.dataDir) {
        // 返回用户选择的目录（即使不存在，会在使用时创建）
        const selectedDir = config.dataDir;
        // 确保目录存在
        if (!fs.existsSync(selectedDir)) {
            try {
                fs.mkdirSync(selectedDir, { recursive: true });
                console.log(`✅ 创建用户选择的数据目录: ${selectedDir}`);
            } catch (e) {
                console.error(`❌ 无法创建数据目录 ${selectedDir}:`, e);
                // 如果创建失败，回退到默认目录
                return path.join(app.getPath('userData'), 'data');
            }
        }
        return selectedDir;
    }
    // 默认使用系统标准应用数据目录
    return path.join(app.getPath('userData'), 'data');
}

// 初始化数据目录
let DATA_DIR = getDataDir();

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✅ 创建数据目录: ${DATA_DIR}`);
}

// 动态获取数据目录的函数（用于 FILES 对象）
function getDataDirPath() {
    return getDataDir();
}

// 获取数据文件路径（动态，支持目录变更）
function getDataFiles() {
    const dataDir = getDataDirPath();
    return {
        sessions: path.join(dataDir, 'sessions.json'),
        settings: path.join(dataDir, 'settings.json'),
        quickPrompts: path.join(dataDir, 'quickPrompts.json'),
        writingSamples: path.join(dataDir, 'writingSamples.json'),
        writingSamplesEnabled: path.join(dataDir, 'writingSamplesEnabled.json')
    };
}

// 读取文件
function readFile(filePath, defaultValue = null) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content ? JSON.parse(content) : defaultValue;
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return defaultValue;
}

// 写入文件
function writeFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
        return false;
    }
}

// 注册 IPC 处理器（直接文件操作）
ipcMain.handle('data:loadSessions', () => {
    const FILES = getDataFiles();
    return readFile(FILES.sessions, []);
});

ipcMain.handle('data:saveSessions', (event, sessions) => {
    const FILES = getDataFiles();
    return writeFile(FILES.sessions, sessions);
});

ipcMain.handle('data:loadSettings', () => {
    const FILES = getDataFiles();
    return readFile(FILES.settings, {});
});

ipcMain.handle('data:saveSettings', (event, settings) => {
    const FILES = getDataFiles();
    return writeFile(FILES.settings, settings);
});

ipcMain.handle('data:loadQuickPrompts', () => {
    const FILES = getDataFiles();
    return readFile(FILES.quickPrompts, null);
});

ipcMain.handle('data:saveQuickPrompts', (event, prompts) => {
    const FILES = getDataFiles();
    return writeFile(FILES.quickPrompts, prompts);
});

ipcMain.handle('data:getDataDir', () => {
    return getDataDirPath();
});

ipcMain.handle('data:loadWritingSamples', () => {
    const FILES = getDataFiles();
    return readFile(FILES.writingSamples, []);
});

ipcMain.handle('data:saveWritingSamples', (event, samples) => {
    const FILES = getDataFiles();
    return writeFile(FILES.writingSamples, samples);
});

ipcMain.handle('data:loadWritingSamplesEnabled', () => {
    const FILES = getDataFiles();
    return readFile(FILES.writingSamplesEnabled, true);
});

ipcMain.handle('data:saveWritingSamplesEnabled', (event, enabled) => {
    const FILES = getDataFiles();
    return writeFile(FILES.writingSamplesEnabled, enabled);
});

// 目录选择相关 IPC 处理器
ipcMain.handle('data:selectDataDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择数据保存目录'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const selectedDir = result.filePaths[0];
        const config = readConfig();
        config.dataDir = selectedDir;
        writeConfig(config);
        
        // 更新数据目录
        DATA_DIR = selectedDir;
        
        // 确保新目录存在
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        
        console.log(`✅ 数据目录已更改为: ${DATA_DIR}`);
        return selectedDir;
    }
    
    return null;
});

ipcMain.handle('data:getCurrentDataDir', () => {
    return getDataDirPath();
});

// 重置数据目录为默认值
ipcMain.handle('data:resetDataDir', () => {
    const config = readConfig();
    delete config.dataDir;
    writeConfig(config);
    
    DATA_DIR = path.join(app.getPath('userData'), 'data');
    console.log(`✅ 数据目录已重置为默认: ${DATA_DIR}`);
    return DATA_DIR;
});

// 窗口控制 IPC 处理器
let mainWindow = null;

ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window:close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

console.log(`📁 数据目录: ${getDataDirPath()}`);

// 创建窗口
function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../build/icon.png'), // 如果有图标
        frame: true, // 显示标准窗口框架（包含最小化、最大化、关闭按钮）
        titleBarStyle: 'default', // 默认标题栏样式（Windows）
        autoHideMenuBar: true, // 自动隐藏菜单栏
        show: false // 先不显示，等加载完成
    });
    
    // 确保菜单栏隐藏
    win.setMenuBarVisibility(false);

    // 开发环境：连接到 Vite 开发服务器（仅在明确指定开发模式时）
    if (process.env.ELECTRON_DEV === 'true' && process.env.NODE_ENV !== 'production') {
        // 从环境变量获取端口，或自动检测
        const vitePort = process.env.VITE_PORT || '3000';
        
        const tryLoadURL = (port) => {
            return new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:${port}`, (res) => {
                    resolve(port);
                });
                req.on('error', () => {
                    if (port === 3000) {
                        // 如果 3000 失败，尝试 3001
                        tryLoadURL(3001).then(resolve).catch(reject);
                    } else {
                        reject(new Error(`无法连接到端口 ${port}`));
                    }
                });
                req.setTimeout(2000, () => {
                    req.destroy();
                    if (port === 3000) {
                        tryLoadURL(3001).then(resolve).catch(reject);
                    } else {
                        reject(new Error(`端口 ${port} 超时`));
                    }
                });
            });
        };
        
        // 如果环境变量指定了端口，直接使用；否则自动检测
        if (vitePort && vitePort !== '3000') {
            win.loadURL(`http://localhost:${vitePort}`);
            win.webContents.openDevTools();
        } else {
            tryLoadURL(parseInt(vitePort)).then((port) => {
                // 验证这是 Vite 服务器而不是代理服务器
                const verifyReq = http.get(`http://localhost:${port}`, (res) => {
                    // 检查响应头，Vite 服务器会有特定的响应
                    if (res.headers['x-powered-by'] === 'Vite' || res.statusCode === 200) {
                        win.loadURL(`http://localhost:${port}`);
                        win.webContents.openDevTools();
                    } else {
                        // 如果不是 Vite 服务器，尝试其他端口
                        console.log(`端口 ${port} 不是 Vite 服务器，尝试其他端口...`);
                        if (port === 3000) {
                            tryLoadURL(3001).then((p) => {
                                win.loadURL(`http://localhost:${p}`);
                                win.webContents.openDevTools();
                            }).catch(() => {
                                win.loadURL('http://localhost:3000');
                                win.webContents.openDevTools();
                            });
                        } else {
                            win.loadURL('http://localhost:3000');
                            win.webContents.openDevTools();
                        }
                    }
                });
                verifyReq.on('error', () => {
                    // 如果验证失败，尝试其他端口
                    if (port === 3000) {
                        tryLoadURL(3001).then((p) => {
                            win.loadURL(`http://localhost:${p}`);
                            win.webContents.openDevTools();
                        }).catch(() => {
                            win.loadURL('http://localhost:3000');
                            win.webContents.openDevTools();
                        });
                    } else {
                        win.loadURL('http://localhost:3000');
                        win.webContents.openDevTools();
                    }
                });
            }).catch(() => {
                // 如果都失败，尝试 3000（因为 3001 可能是代理服务器）
                win.loadURL('http://localhost:3000');
                win.webContents.openDevTools();
            });
        }
    } else {
        // 生产环境：加载构建后的文件
        // 在打包后的应用中，dist 目录会被打包到 app.asar 中
        // 使用 app.getAppPath() 获取正确的应用路径
        
        // 获取应用路径（打包后会在 app.asar 中）
        const appPath = app.getAppPath();
        console.log('应用路径:', appPath);
        
        // 尝试多个可能的路径
        const possiblePaths = [
            path.join(appPath, 'dist', 'index.html'),  // 打包后的路径
            path.join(__dirname, '../dist/index.html'),  // 开发环境
            path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),  // asar 内部
            path.join(process.resourcesPath, 'dist', 'index.html')  // 未打包
        ];
        
        let loaded = false;
        for (const indexPath of possiblePaths) {
            try {
                // 检查文件是否存在（对于 asar 中的文件，需要使用特殊方式）
                let exists = false;
                try {
                    exists = fs.existsSync(indexPath);
                } catch (e) {
                    // asar 中的文件可能无法用 existsSync 检查，直接尝试加载
                    exists = true;
                }
                
                if (exists) {
                    console.log('尝试加载路径:', indexPath);
                    // 使用 loadFile，它会自动处理路径和资源加载
                    win.loadFile(indexPath).then(() => {
                        console.log('✅ 成功加载:', indexPath);
                        loaded = true;
                    }).catch((err) => {
                        console.log('❌ 加载失败:', indexPath, err.message);
                    });
                    loaded = true;
                    break;
                }
            } catch (e) {
                console.log('路径检查失败:', indexPath, e.message);
            }
        }
        
        if (!loaded) {
            console.error('所有路径都失败，使用默认路径');
            // 使用默认路径
            const defaultPath = path.join(appPath, 'dist', 'index.html');
            win.loadFile(defaultPath).catch((err) => {
                console.error('加载文件失败:', err);
                // 显示错误信息
                win.webContents.executeJavaScript(`
                    document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; color: red;">
                        <h1>加载失败</h1>
                        <p>无法加载应用文件。请检查安装是否完整。</p>
                        <p>错误: ${err.message}</p>
                        <p>应用路径: ${appPath}</p>
                    </div>';
                `);
            });
        }
    }

    // 窗口加载完成后显示
    win.once('ready-to-show', () => {
        win.show();
    });
    
    // 保存窗口引用
    mainWindow = win;

    return win;
}

// 应用准备就绪
app.whenReady().then(() => {
    // 创建窗口
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

