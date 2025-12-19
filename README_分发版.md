# StoryForge AI - 分发版使用说明

## 🚀 快速开始

### 方式一：使用启动脚本（推荐）

1. 双击运行 `启动应用.bat`
2. 等待浏览器自动打开
3. 如果浏览器没有自动打开，手动访问：http://localhost:3000

### 方式二：手动启动

1. 确保已安装 Node.js（https://nodejs.org/）
2. 打开命令行，进入此文件夹
3. 安装 http-server（只需一次）：
   ```bash
   npm install -g http-server
   ```
4. 启动应用：
   ```bash
   cd dist
   http-server -p 3000
   ```
5. 在浏览器中打开：http://localhost:3000

## 🔑 配置 API Key

**重要**：首次使用需要配置您的 API Key

1. 打开应用后，点击右上角的钥匙图标（🔑）
2. 选择 API 提供商：
   - **Google Gemini**（推荐新手）
   - **DeepSeek**（性价比高）
   - **SiliconFlow**（国内可用）
   - **OpenAI**（需要代理）
3. 输入您的 API Key
4. 点击"保存新配置"

### 如何获取 API Key？

- **Google Gemini**: https://aistudio.google.com/apikey
- **DeepSeek**: https://platform.deepseek.com/api_keys
- **SiliconFlow**: https://cloud.siliconflow.cn/account/ak
- **OpenAI**: https://platform.openai.com/api-keys

## 📖 使用指南

### 基本功能

1. **聊天创作**：在左侧聊天窗口输入想法，AI 会帮助您创作
2. **故事板**：在右侧故事板中管理故事结构、角色、世界观等
3. **自动保存**：所有数据自动保存到浏览器本地存储

### 高级功能

- **工作目录同步**（强烈推荐）：
  - 在左侧边栏底部点击"设置工作目录"
  - 选择一个本地文件夹，应用会自动在该文件夹中创建 `storyforge_backup.json`
  - 所有故事数据会自动同步保存到该文件（每次修改后 2 秒自动保存）
  - 数据真正保存在硬盘上，不依赖浏览器，可以跨设备同步
  - ⚠️ 需要 Chrome/Edge 桌面版浏览器，必须在独立窗口中打开
- **导出功能**：可以导出故事为 JSON 或 TXT 格式
- **多会话管理**：可以创建多个故事项目

## 💾 数据安全

- ✅ 所有数据存储在您的本地浏览器中
- ✅ **工作目录同步**：可以设置本地文件夹，自动同步保存到硬盘文件，实现真正的数据持久化
- ✅ API Key 不会上传到任何服务器
- ✅ 可以随时导出备份（JSON 或 TXT 格式）

## ❓ 常见问题

**Q: 需要网络吗？**
A: 是的，需要网络连接来调用 AI API。

**Q: 数据会丢失吗？**
A: 
- 如果只使用浏览器存储：清除浏览器数据会丢失，建议定期导出备份
- 如果设置了工作目录：数据会同步保存到硬盘文件，即使清除浏览器数据也不会丢失
- **强烈建议使用"工作目录"功能，实现真正的数据持久化**

**Q: 工作目录功能无法使用？**
A: 
- 确保使用 Chrome 或 Edge 桌面版浏览器（不支持 Firefox/Safari）
- 确保在独立窗口中打开（不是 iframe 预览窗口）
- 首次选择文件夹时，浏览器会要求授权，请点击"允许"

**Q: 可以离线使用吗？**
A: 不可以，需要网络连接来调用 AI API。

**Q: 支持哪些浏览器？**
A: 推荐 Chrome、Edge 或 Firefox 最新版本。

## 📞 技术支持

如有问题，请查看：
- `使用说明.txt` - 详细使用说明
- `PACKAGING_GUIDE.md` - 打包和部署指南

---

**祝您创作愉快！** ✨

