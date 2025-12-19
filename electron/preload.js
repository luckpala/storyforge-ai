/**
 * Electron 预加载脚本
 * 在渲染进程中提供安全的 API
 */

import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 平台信息
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    },
    
    // 窗口控制（仅 Electron 环境）
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized')
    },
    
    // 数据文件操作（通过 IPC 调用主进程）
    data: {
        loadSessions: () => ipcRenderer.invoke('data:loadSessions'),
        saveSessions: (sessions) => ipcRenderer.invoke('data:saveSessions', sessions),
        loadSettings: () => ipcRenderer.invoke('data:loadSettings'),
        saveSettings: (settings) => ipcRenderer.invoke('data:saveSettings', settings),
        loadQuickPrompts: () => ipcRenderer.invoke('data:loadQuickPrompts'),
        saveQuickPrompts: (prompts) => ipcRenderer.invoke('data:saveQuickPrompts', prompts),
        loadWritingSamples: () => ipcRenderer.invoke('data:loadWritingSamples'),
        saveWritingSamples: (samples) => ipcRenderer.invoke('data:saveWritingSamples', samples),
        loadWritingSamplesEnabled: () => ipcRenderer.invoke('data:loadWritingSamplesEnabled'),
        saveWritingSamplesEnabled: (enabled) => ipcRenderer.invoke('data:saveWritingSamplesEnabled', enabled),
        getDataDir: () => ipcRenderer.invoke('data:getDataDir'),
        selectDataDir: () => ipcRenderer.invoke('data:selectDataDir'),
        getCurrentDataDir: () => ipcRenderer.invoke('data:getCurrentDataDir'),
        resetDataDir: () => ipcRenderer.invoke('data:resetDataDir')
    }
});

