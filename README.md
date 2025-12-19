<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# StoryForge AI - 本地部署指南

这是一个基于 React + Vite 的 AI 故事创作应用。

在 AI Studio 中查看应用: https://ai.studio/apps/drive/10i6C_dovT6Z6FApg_XwOCLtrBJ_lnYQF

## 本地部署步骤

### 前置要求

- **Node.js** (版本 18 或更高)
  - 下载地址: https://nodejs.org/
  - 安装后可通过 `node --version` 验证安装

### 部署步骤

#### 1. 安装项目依赖

在项目根目录下打开终端/命令行，运行：

```bash
npm install
```

这将安装所有必需的依赖包（React、Vite、Google Gemini API 等）。

#### 2. 配置 API 密钥

1. 复制环境变量示例文件：
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env.local
   
   # Windows CMD
   copy .env.example .env.local
   
   # Linux/Mac
   cp .env.example .env.local
   ```

2. 编辑 `.env.local` 文件，将 `YOUR_API_KEY_HERE` 替换为您的 Gemini API 密钥
   - 获取 API 密钥: https://aistudio.google.com/apikey
   - 如果没有 API 密钥，请先注册 Google AI Studio 账号并创建密钥

#### 3. 启动开发服务器

运行以下命令启动开发服务器：

```bash
npm run dev
```

服务器启动后，您会看到类似以下输出：
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

#### 4. 访问应用

在浏览器中打开 `http://localhost:3000` 即可使用应用。

### 其他命令

- **构建生产版本**:
  ```bash
  npm run build
  ```
  构建完成后，文件将输出到 `dist` 目录

- **预览生产构建**:
  ```bash
  npm run build
  npm run preview
  ```
  用于在本地预览生产构建的结果

### 常见问题

1. **端口被占用**: 如果 3000 端口已被使用，Vite 会自动尝试其他端口
2. **API 密钥错误**: 确保 `.env.local` 文件中的 `GEMINI_API_KEY` 设置正确
3. **依赖安装失败**: 尝试删除 `node_modules` 文件夹和 `package-lock.json`，然后重新运行 `npm install`

---

## Run Locally (English)

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
   - Copy `.env.example` to `.env.local`
   - Replace `YOUR_API_KEY_HERE` with your actual API key
   - Get your API key: https://aistudio.google.com/apikey
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser
