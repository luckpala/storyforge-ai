# StoryForge AI 本地部署完整指南

## 📋 前置要求

在开始之前，请确保您的电脑已安装：

- **Node.js** (版本 18 或更高)
  - 下载地址: https://nodejs.org/
  - 验证安装: 打开命令行，运行 `node --version` 和 `npm --version`

## 🚀 快速部署步骤

### 步骤 1: 安装依赖

打开终端/命令行，进入项目目录，运行：

```bash
npm install
```

**预期输出**: 会看到依赖包安装进度，完成后显示类似 "added XXX packages" 的信息

### 步骤 2: 配置 API 密钥

1. **创建环境变量文件**:
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env.local
   
   # Windows CMD
   copy .env.example .env.local
   ```

2. **编辑 `.env.local` 文件**:
   - 用文本编辑器（如记事本、VS Code）打开 `.env.local`
   - 将 `YOUR_API_KEY_HERE` 替换为您的实际 Gemini API 密钥
   - 保存文件

3. **获取 API 密钥** (如果还没有):
   - 访问: https://aistudio.google.com/apikey
   - 登录 Google 账号
   - 点击 "Create API Key" 创建新密钥
   - 复制密钥并粘贴到 `.env.local` 文件中

### 步骤 3: 启动应用

运行开发服务器：

```bash
npm run dev
```

**预期输出**:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

### 步骤 4: 访问应用

在浏览器中打开: **http://localhost:3000**

## 📦 生产环境部署

如果需要构建生产版本：

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

构建后的文件在 `dist` 目录中，可以部署到任何静态文件服务器。

## ❓ 常见问题排查

### 问题 1: `npm install` 失败

**解决方案**:
- 检查网络连接
- 尝试清除缓存: `npm cache clean --force`
- 删除 `node_modules` 和 `package-lock.json`，重新运行 `npm install`

### 问题 2: 端口 3000 被占用

**解决方案**:
- Vite 会自动尝试其他端口（如 3001, 3002 等）
- 查看终端输出中的实际端口号
- 或修改 `vite.config.ts` 中的端口配置

### 问题 3: API 调用失败

**解决方案**:
- 检查 `.env.local` 文件是否存在且包含正确的 `GEMINI_API_KEY`
- 确保 API 密钥有效且未过期
- 检查网络连接，确保可以访问 Google API

### 问题 4: 页面显示空白或错误

**解决方案**:
- 打开浏览器开发者工具（F12）查看控制台错误
- 检查终端中的错误信息
- 确保所有依赖都已正确安装

## 🔧 开发命令参考

| 命令 | 说明 |
|------|------|
| `npm install` | 安装项目依赖 |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |

## 📝 注意事项

1. **环境变量文件**: `.env.local` 文件包含敏感信息，已配置在 `.gitignore` 中，不会被提交到版本控制
2. **API 密钥安全**: 不要将 API 密钥分享给他人或提交到公共代码仓库
3. **端口配置**: 默认端口为 3000，可在 `vite.config.ts` 中修改

## 🎉 完成！

如果一切正常，您现在应该可以在浏览器中看到 StoryForge AI 应用了！

如有其他问题，请查看项目 README.md 或检查终端错误信息。

