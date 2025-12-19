# StoryForge AI - 打包和分发指南

本指南将帮助您将 StoryForge AI 打包分发给朋友，并生成安卓版本。

## 📦 方案一：桌面版打包（推荐）

### 方法1：构建静态文件（最简单）

这种方式适合技术用户，他们可以在自己的电脑上运行。

#### 步骤：

1. **构建生产版本**
   ```bash
   npm run build
   ```
   构建完成后，所有文件会在 `dist` 目录中。

2. **打包分发**
   - 将 `dist` 文件夹压缩成 zip 文件
   - 创建一个简单的启动说明文件

3. **创建启动脚本**

   创建 `启动说明.txt`：
   ```
   StoryForge AI 使用说明
   ====================
   
   1. 解压此文件夹
   2. 安装 Node.js（如果还没有安装）
      - 下载地址：https://nodejs.org/
      - 安装后验证：打开命令行，输入 node --version
   
   3. 安装 http-server（用于运行静态文件）
      打开命令行，输入：
      npm install -g http-server
   
   4. 启动应用
      在 dist 文件夹中打开命令行，输入：
      http-server -p 3000
   
   5. 在浏览器中打开
      http://localhost:3000
   
   6. 配置 API Key
      - 点击右上角的钥匙图标
      - 输入您的 API Key
      - 支持 Google Gemini、DeepSeek、OpenAI 等
   ```

### 方法2：使用 Electron 打包成桌面应用（更友好）

将应用打包成独立的桌面应用，用户双击即可运行。

#### 安装 Electron 依赖

```bash
npm install --save-dev electron electron-builder
```

#### 创建 Electron 主进程文件

创建 `electron/main.js`：

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 开发环境
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // 生产环境
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

#### 修改 package.json

添加以下内容：

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  },
  "build": {
    "appId": "com.storyforge.ai",
    "productName": "StoryForge AI",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "build/icon.icns"
    },
    "linux": {
      "target": ["AppImage"],
      "icon": "build/icon.png"
    }
  }
}
```

#### 安装额外依赖

```bash
npm install --save-dev concurrently wait-on
```

#### 打包

```bash
# Windows
npm run electron:build:win

# Mac
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

打包完成后，可执行文件会在 `release` 目录中。

---

## 📱 方案二：安卓版打包

使用 Capacitor 将 Web 应用转换为原生安卓应用。

### 步骤1：安装 Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
npx cap init
```

初始化时会询问：
- App name: `StoryForge AI`
- App ID: `com.storyforge.ai`
- Web dir: `dist`

### 步骤2：构建 Web 应用

```bash
npm run build
```

### 步骤3：添加安卓平台

```bash
npx cap add android
npx cap sync
```

### 步骤4：配置安卓应用

编辑 `android/app/src/main/AndroidManifest.xml`，确保有网络权限：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 步骤5：在 Android Studio 中打开

```bash
npx cap open android
```

### 步骤6：构建 APK

1. 在 Android Studio 中：
   - 点击 `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - 或者点击 `Build` → `Generate Signed Bundle / APK`

2. 选择签名方式（首次需要创建密钥）

3. 构建完成后，APK 文件在：
   `android/app/build/outputs/apk/release/app-release.apk`

### 步骤7：安装到设备

- 通过 USB 连接手机/平板
- 在 Android Studio 中点击运行按钮
- 或者将 APK 文件传输到设备上手动安装

---

## 🔑 关于 API Key

**重要**：应用不包含任何硬编码的 API Key。用户需要：

1. 打开应用
2. 点击右上角的钥匙图标
3. 输入自己的 API Key
4. 支持多种 API 提供商：
   - Google Gemini
   - DeepSeek
   - SiliconFlow
   - OpenAI / 兼容 OpenAI 的 API

所有 API Key 都存储在用户的本地浏览器中，不会上传到任何服务器。

---

## 📋 分发清单

### 桌面版分发包应包含：

1. ✅ 构建后的 `dist` 文件夹（或 Electron 打包文件）
2. ✅ `启动说明.txt` 或 `README.md`
3. ✅ Node.js 安装说明（如果需要）

### 安卓版分发包应包含：

1. ✅ APK 安装文件
2. ✅ 安装说明（允许安装未知来源应用的方法）
3. ✅ 使用说明（如何配置 API Key）

---

## 🚀 快速打包脚本

创建 `package-all.bat`（Windows）或 `package-all.sh`（Linux/Mac）：

### Windows (package-all.bat)

```batch
@echo off
echo 正在构建 Web 版本...
call npm run build
echo.
echo 构建完成！文件在 dist 目录中
echo.
echo 如需打包 Electron 版本，请运行：
echo npm run electron:build:win
pause
```

### Linux/Mac (package-all.sh)

```bash
#!/bin/bash
echo "正在构建 Web 版本..."
npm run build
echo ""
echo "构建完成！文件在 dist 目录中"
echo ""
echo "如需打包 Electron 版本，请运行："
echo "npm run electron:build:win"
```

---

## 📝 关于工作目录同步功能

**重要**：应用支持将数据自动同步保存到本地硬盘文件夹，这是推荐的数据存储方式！

### 功能说明

- 用户可以在左侧边栏底部点击"设置工作目录"
- 选择一个本地文件夹后，应用会在该文件夹中创建 `storyforge_backup.json`
- 所有故事数据会自动同步保存到该文件（每次修改后 2 秒自动保存）
- 数据真正保存在硬盘上，不依赖浏览器，可以跨设备同步

### 浏览器要求

- ✅ 支持：Chrome 桌面版、Edge 桌面版
- ❌ 不支持：Firefox、Safari、移动端浏览器
- ⚠️ 必须在独立窗口中打开（不能是 iframe 预览窗口）

### 用户提示

在分发时，建议提醒用户：
1. 首次使用建议设置工作目录，实现数据持久化
2. 如果无法使用，请检查浏览器类型和窗口模式
3. 首次选择文件夹时，浏览器会要求授权，需要点击"允许"

---

## 📝 使用说明模板

创建 `使用说明.txt`：

```
StoryForge AI - 使用说明
====================

一、首次使用
1. 打开应用
2. 点击右上角的钥匙图标（🔑）
3. 选择 API 提供商并输入您的 API Key
4. 点击"保存新配置"

支持的 API：
- Google Gemini（推荐）
- DeepSeek
- SiliconFlow
- OpenAI / 兼容 OpenAI 的 API

二、开始创作
1. 在左侧聊天窗口输入您的故事想法
2. 或使用右侧故事板进行结构化创作
3. AI 会帮助您完成从构思到正文的完整流程

三、数据存储
- 所有数据存储在本地浏览器中
- 可以导出备份（JSON 或 TXT 格式）

四、工作目录同步（强烈推荐）
- 在左侧边栏底部点击"设置工作目录"按钮
- 选择一个本地文件夹（建议创建专门的文件夹，如"我的故事库"）
- 应用会自动在该文件夹中创建 storyforge_backup.json 文件
- 之后所有故事数据会自动同步保存到该文件（每次修改后 2 秒自动保存）
- 优势：数据真正保存在硬盘上，不依赖浏览器，可以跨设备同步，即使清除浏览器数据也不会丢失
- 注意：需要 Chrome 或 Edge 桌面版浏览器，必须在独立窗口中打开

四、常见问题
Q: 如何获取 API Key？
A: 根据您选择的提供商：
   - Google Gemini: https://aistudio.google.com/apikey
   - DeepSeek: https://platform.deepseek.com/api_keys
   - OpenAI: https://platform.openai.com/api-keys

Q: 数据会丢失吗？
A: 
   - 如果只使用浏览器存储：清除浏览器数据会丢失，建议定期导出备份
   - 如果设置了工作目录：数据会同步保存到硬盘文件，即使清除浏览器数据也不会丢失
   - 强烈建议使用"工作目录"功能，实现真正的数据持久化

Q: 工作目录功能无法使用？
A: 
   - 确保使用 Chrome 或 Edge 桌面版浏览器
   - 确保在独立窗口中打开（不是 iframe 预览）
   - 首次选择文件夹时，浏览器会要求授权，请点击"允许"

Q: 可以离线使用吗？
A: 不可以，需要网络连接来调用 AI API。

技术支持：请查看项目 README.md
```

---

## ⚠️ 注意事项

1. **API Key 安全**：提醒用户不要分享自己的 API Key
2. **数据备份**：建议用户定期导出数据备份
3. **浏览器兼容性**：推荐使用 Chrome、Edge 或 Firefox 最新版本
4. **网络要求**：需要稳定的网络连接来调用 AI API

---

## 🎯 推荐方案

- **给技术用户**：提供构建后的 `dist` 文件夹 + 启动说明
- **给普通用户**：使用 Electron 打包成桌面应用
- **移动端用户**：使用 Capacitor 打包成安卓 APK

选择最适合您朋友使用场景的方案！

