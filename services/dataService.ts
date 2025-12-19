/**
 * 本地数据服务
 * Electron 环境：通过 IPC 直接操作文件
 * Web 环境：通过 HTTP 与数据服务器通信
 */

// TypeScript 类型声明
declare global {
    interface Window {
        electronAPI?: {
            data?: {
                loadSessions: () => Promise<any[]>;
                saveSessions: (sessions: any[]) => Promise<boolean>;
                loadSettings: () => Promise<any>;
                saveSettings: (settings: any) => Promise<boolean>;
                loadQuickPrompts: () => Promise<any[] | null>;
                saveQuickPrompts: (prompts: any[]) => Promise<boolean>;
        loadWritingSamples: () => Promise<any[]>;
        saveWritingSamples: (samples: any[]) => Promise<boolean>;
        loadWritingSamplesEnabled: () => Promise<boolean>;
        saveWritingSamplesEnabled: (enabled: boolean) => Promise<boolean>;
        getDataDir: () => Promise<string>;
        selectDataDir: () => Promise<string | null>;
        getCurrentDataDir: () => Promise<string>;
        resetDataDir: () => Promise<string>;
            };
        };
    }
}

// 检测是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && 
                   window.electronAPI !== undefined;

// 数据服务器 URL（仅用于 Web 环境，支持动态端口）
let DATA_SERVER_URL = 'http://127.0.0.1:8765';

// 尝试检测数据服务器端口（如果默认端口不可用，尝试备用端口）
let portDetectionInProgress = false;
let portDetectionPromise: Promise<string> | null = null;

async function detectDataServerPort(): Promise<string> {
    const defaultPort = 8765;
    const maxAttempts = 5; // 减少尝试次数，只尝试 5 个端口
    
    // 获取当前页面的主机地址（如果是手机访问，会使用电脑的局域网 IP）
    const currentHost = window.location.hostname;
    // 如果当前是 localhost 或 127.0.0.1，优先尝试 127.0.0.1
    // 否则使用当前页面的主机地址（可能是局域网 IP）
    const hostsToTry = currentHost === 'localhost' || currentHost === '127.0.0.1' 
        ? ['127.0.0.1', currentHost] 
        : [currentHost, '127.0.0.1'];
    
    // 先尝试默认端口，遍历所有可能的主机地址
    for (const host of hostsToTry) {
        try {
            const response = await fetch(`http://${host}:${defaultPort}/api/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(500) // 减少超时时间
            });
            if (response.ok) {
                return `http://${host}:${defaultPort}`;
            }
        } catch (e) {
            // 继续尝试下一个主机
        }
    }
    
    // 尝试备用端口（最多尝试 5 个）
    for (let port = defaultPort + 1; port <= defaultPort + maxAttempts; port++) {
        for (const host of hostsToTry) {
            try {
                const response = await fetch(`http://${host}:${port}/api/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(300) // 减少超时时间
                });
                if (response.ok) {
                    DATA_SERVER_URL = `http://${host}:${port}`;
                    return DATA_SERVER_URL;
                }
            } catch (e) {
                // 继续尝试下一个端口
            }
        }
    }
    
    // 如果都不可用，返回默认 URL（使用当前主机）
    return `http://${hostsToTry[0]}:${defaultPort}`;
}

// 初始化时检测端口（带锁，避免并发检测）
let dataServerUrlInitialized = false;
async function getDataServerUrl(): Promise<string> {
    if (dataServerUrlInitialized) {
        return DATA_SERVER_URL;
    }
    
    // 如果正在检测，等待检测完成
    if (portDetectionInProgress && portDetectionPromise) {
        return await portDetectionPromise;
    }
    
    // 开始检测
    portDetectionInProgress = true;
    portDetectionPromise = detectDataServerPort().then((url) => {
        DATA_SERVER_URL = url;
        dataServerUrlInitialized = true;
        portDetectionInProgress = false;
        return url;
    }).catch((e) => {
        portDetectionInProgress = false;
        dataServerUrlInitialized = true; // 即使失败也标记为已初始化，避免重复尝试
        return `http://127.0.0.1:8765`; // 返回默认 URL
    });
    
    return await portDetectionPromise;
}

// 检查数据服务器是否可用（带缓存，避免重复检测）
let lastCheckTime = 0;
let lastCheckResult = false;
const CHECK_CACHE_DURATION = 5000; // 5秒内不重复检查（增加缓存时间）

// 添加检查锁，防止并发检查
let checkInProgress = false;
let checkPromise: Promise<boolean> | null = null;

export async function checkDataServer(): Promise<boolean> {
    // Electron 环境：直接返回 true（文件系统总是可用）
    if (isElectron) {
        return true;
    }
    
    // Web 环境：检查 HTTP 服务器
    const now = Date.now();
    // 如果最近检查过，直接返回缓存结果（无论成功还是失败）
    if (now - lastCheckTime < CHECK_CACHE_DURATION) {
        return lastCheckResult;
    }
    
    // 如果正在检查，等待检查完成
    if (checkInProgress && checkPromise) {
        return await checkPromise;
    }
    
    // 开始检查
    checkInProgress = true;
    checkPromise = (async () => {
        try {
            // 先获取 URL（只检测一次端口）
            const url = await getDataServerUrl();
            
            // 然后检查健康状态
            const response = await fetch(`${url}/api/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(500) // 减少超时时间
            });
            lastCheckResult = response.ok;
            lastCheckTime = Date.now();
            checkInProgress = false;
            return lastCheckResult;
        } catch (e) {
            lastCheckResult = false;
            lastCheckTime = Date.now();
            checkInProgress = false;
            return false;
        }
    })();
    
    return await checkPromise;
}

// 读取会话数据
export async function loadSessions(): Promise<any[] | null> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            const data = await window.electronAPI.data.loadSessions();
            return Array.isArray(data) ? data : null;
        } catch (e) {
            console.error('Failed to load sessions via IPC:', e);
            return null;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/sessions`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('加载会话数据超时，使用 localStorage');
        } else {
            console.error('Failed to load sessions from data server:', e);
        }
    }
    return null;
}

// 保存会话数据
export async function saveSessions(sessions: any[]): Promise<boolean> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.saveSessions(sessions);
        } catch (e) {
            console.error('Failed to save sessions via IPC:', e);
            return false;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 减少到 3 秒超时，更快失败
        
        const response = await fetch(`${url}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessions),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e: any) {
        // 静默处理错误，不输出日志，避免干扰
        // 保存失败不影响用户体验，因为 localStorage 已经保存了
        return false;
    }
}

// 读取设置
export async function loadSettings(): Promise<any | null> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.loadSettings();
        } catch (e) {
            console.error('Failed to load settings via IPC:', e);
            return null;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/settings`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('加载设置超时，使用 localStorage');
        } else {
            console.error('Failed to load settings from data server:', e);
        }
    }
    return null;
}

// 保存设置
export async function saveSettings(settings: any): Promise<boolean> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.saveSettings(settings);
        } catch (e) {
            console.error('Failed to save settings via IPC:', e);
            return false;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${url}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const success = response.ok;
        if (success) {
          console.log('✅ 设置已保存到数据服务器');
        } else {
          console.warn('⚠️ 设置保存到数据服务器失败:', response.status);
        }
        return success;
    } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.warn('⚠️ 保存设置到数据服务器失败:', e.message || e);
        }
        return false;
    }
}

// 读取快捷提示词
export async function loadQuickPrompts(): Promise<any[] | null> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            const data = await window.electronAPI.data.loadQuickPrompts();
            return data; // 可能是 null 或数组
        } catch (e) {
            console.error('Failed to load quick prompts via IPC:', e);
            return null;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/quickPrompts`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            return data; // 可能是 null 或数组
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            console.warn('加载快捷提示词超时，使用 localStorage');
        } else {
            console.error('Failed to load quick prompts from data server:', e);
        }
    }
    return null;
}

// 保存快捷提示词
export async function saveQuickPrompts(prompts: any[]): Promise<boolean> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.saveQuickPrompts(prompts);
        } catch (e) {
            console.error('Failed to save quick prompts via IPC:', e);
            return false;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${url}/api/quickPrompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prompts),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const success = response.ok;
        if (success) {
          console.log('✅ 快捷提示词已保存到数据服务器');
        } else {
          console.warn('⚠️ 快捷提示词保存到数据服务器失败:', response.status);
        }
        return success;
    } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.warn('⚠️ 保存快捷提示词到数据服务器失败:', e.message || e);
        }
        return false;
    }
}

// 读取范文数据
export async function loadWritingSamples(): Promise<any[] | null> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            const data = await window.electronAPI.data.loadWritingSamples();
            return Array.isArray(data) ? data : null;
        } catch (e) {
            console.error('Failed to load writing samples via IPC:', e);
            return null;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/writingSamples`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            return Array.isArray(data) ? data : null;
        }
    } catch (e: any) {
        if (e.name === 'AbortError') {
            // 超时错误，静默处理
        } else if (e.message?.includes('Failed to fetch') || e.message?.includes('CONNECTION_REFUSED')) {
            // 连接错误（数据服务器未运行），静默处理
        } else {
            console.warn('⚠️ 加载范文数据失败:', e.message || e);
        }
    }
    return null;
}

// 保存范文数据
export async function saveWritingSamples(samples: any[]): Promise<boolean> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.saveWritingSamples(samples);
        } catch (e) {
            console.error('Failed to save writing samples via IPC:', e);
            return false;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/writingSamples`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(samples),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e: any) {
        // 静默处理错误
        return false;
    }
}

// 读取范文启用状态
export async function loadWritingSamplesEnabled(): Promise<boolean | null> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            const data = await window.electronAPI.data.loadWritingSamplesEnabled();
            return typeof data === 'boolean' ? data : null;
        } catch (e) {
            console.error('Failed to load writing samples enabled via IPC:', e);
            return null;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/writingSamplesEnabled`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            return typeof data === 'boolean' ? data : null;
        }
    } catch (e: any) {
        if (e.name === 'AbortError') {
            // 超时错误，静默处理
        } else if (e.message?.includes('Failed to fetch') || e.message?.includes('CONNECTION_REFUSED')) {
            // 连接错误（数据服务器未运行），静默处理
        } else {
            console.warn('⚠️ 加载范文启用状态失败:', e.message || e);
        }
    }
    return null;
}

// 保存范文启用状态
export async function saveWritingSamplesEnabled(enabled: boolean): Promise<boolean> {
    // Electron 环境：使用 IPC
    if (isElectron && window.electronAPI?.data) {
        try {
            return await window.electronAPI.data.saveWritingSamplesEnabled(enabled);
        } catch (e) {
            console.error('Failed to save writing samples enabled via IPC:', e);
            return false;
        }
    }
    
    // Web 环境：使用 HTTP
    try {
        const url = await getDataServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        const response = await fetch(`${url}/api/writingSamplesEnabled`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enabled),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (e: any) {
        // 静默处理错误
        return false;
    }
}

