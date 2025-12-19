# StoryForge AI - Electron 桌面应用

## 📦 安装 Electron 依赖

```bash
npm install
```

这会自动安装所有依赖，包括 Electron。

## 🚀 开发模式

同时启动 Vite 开发服务器和 Electron：

```bash
npm run electron:dev
```

## 📦 打包应用

### Windows

```bash
npm run electron:build:win
```

打包完成后，安装包在 `release` 目录中。

### Mac

```bash
npm run electron:build:mac
```

### Linux

```bash
npm run electron:build:linux
```

## ✨ 特性

1. **集成数据服务器**：数据服务器自动在 Electron 主进程中运行，无需单独启动
2. **数据持久化**：数据保存在应用数据目录（`%APPDATA%/StoryForge AI/data`）
3. **跨平台**：支持 Windows、Mac、Linux
4. **自动更新**：可以配置自动更新功能（需要额外配置）

## 📁 数据存储位置

- **Windows**: `C:\Users\<用户名>\AppData\Roaming\StoryForge AI\data\`
- **Mac**: `~/Library/Application Support/StoryForge AI/data/`
- **Linux**: `~/.config/StoryForge AI/data/`

## 🔧 配置说明

- 主进程文件：`electron/main.js`
- 预加载脚本：`electron/preload.js`
- 打包配置：`package.json` 中的 `build` 字段

## 📝 注意事项

1. 首次打包需要下载 Electron 二进制文件，可能需要一些时间
2. 打包后的应用大小约 100-150MB（包含 Electron 运行时）
3. 可以自定义应用图标（放在 `build/` 目录中）








































