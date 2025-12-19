# StoryForge AI - Electron 桌面应用使用说明

## 📦 安装依赖

首先需要安装 Electron 相关依赖。在项目根目录打开命令行，运行：

```bash
npm install
```

这会自动安装所有依赖，包括：
- `electron` - Electron 运行时
- `electron-builder` - 打包工具
- `concurrently` - 并发运行多个命令
- `cross-env` - 跨平台环境变量
- `wait-on` - 等待服务启动

## 🚀 开发模式

运行以下命令启动 Electron 开发模式：

```bash
npm run electron:dev
```

或者直接运行批处理文件：

```bash
启动Electron开发版.bat
```

这会：
1. 启动 Vite 开发服务器（http://localhost:3000）
2. 启动 Electron 窗口
3. **数据服务器自动集成在 Electron 主进程中**，无需单独启动

## 📦 打包应用

### Windows

```bash
npm run electron:build:win
```

或运行批处理文件：

```bash
打包Electron应用.bat
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

### 1. 集成数据服务器
- 数据服务器自动在 Electron 主进程中运行
- 无需手动启动 `data-server.js`
- 数据自动保存在系统标准位置

### 2. 数据存储位置
- **Windows**: `C:\Users\<用户名>\AppData\Roaming\StoryForge AI\data\`
- **Mac**: `~/Library/Application Support/StoryForge AI/data/`
- **Linux**: `~/.config/StoryForge AI/data/`

### 3. 专业体验
- 独立的桌面应用窗口
- 系统托盘支持（可配置）
- 自动更新支持（需要额外配置）

## 🔧 配置说明

### 主进程文件
- `electron/main.js` - Electron 主进程，包含数据服务器集成

### 预加载脚本
- `electron/preload.js` - 安全的 API 桥接

### 打包配置
- `package.json` 中的 `build` 字段包含所有打包配置

## ⚠️ 注意事项

1. **首次打包**：需要下载 Electron 二进制文件，可能需要几分钟
2. **应用大小**：打包后的应用约 100-150MB（包含 Electron 运行时）
3. **图标**：可以自定义应用图标（放在 `build/` 目录中）
   - Windows: `build/icon.ico`
   - Mac: `build/icon.icns`
   - Linux: `build/icon.png`

## 🆚 与 Web 版本的区别

| 特性 | Web 版本 | Electron 版本 |
|------|---------|--------------|
| 启动方式 | 浏览器访问 | 双击应用图标 |
| 数据服务器 | 需要单独启动 | 自动集成 |
| 数据存储 | 项目目录 `data/` | 系统应用数据目录 |
| 跨浏览器 | 需要数据服务器 | 自动支持 |
| 离线使用 | 需要本地服务器 | 完全离线 |

## 🐛 常见问题

### Q: 打包失败怎么办？
A: 检查：
1. 是否已运行 `npm install`
2. 是否有足够的磁盘空间（至少 500MB）
3. 查看错误日志，通常是依赖问题

### Q: 应用启动后显示空白页面？
A: 检查：
1. 开发模式：确保 Vite 服务器在运行（http://localhost:3000）
2. 生产模式：确保已运行 `npm run build` 构建前端

### Q: 数据保存在哪里？
A: 数据保存在系统应用数据目录，可以通过以下方式查看：
- Windows: `%APPDATA%\StoryForge AI\data\`
- Mac: `~/Library/Application Support/StoryForge AI/data/`
- Linux: `~/.config/StoryForge AI/data/`

## 📝 下一步

1. 安装依赖：`npm install`
2. 测试开发模式：`npm run electron:dev`
3. 如果正常，打包应用：`npm run electron:build:win`








































