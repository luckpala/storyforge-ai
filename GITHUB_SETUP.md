# GitHub 仓库设置指南

## 重要提示

GitHub 已经**不再支持密码认证**，需要使用 **Personal Access Token (PAT)** 或 **SSH 密钥**。

## 方法一：使用 Personal Access Token (推荐)

### 1. 创建 Personal Access Token

1. 访问 GitHub: https://github.com/settings/tokens
2. 点击 "Generate new token" -> "Generate new token (classic)"
3. 设置：
   - **Note**: `StoryForge-AI-Push` (或任意名称)
   - **Expiration**: 选择过期时间（建议 90 天或更长）
   - **Scopes**: 勾选 `repo` (完整仓库权限)
4. 点击 "Generate token"
5. **重要**: 复制生成的 token（只显示一次，请妥善保存）

### 2. 创建 GitHub 仓库

1. 访问: https://github.com/new
2. 填写：
   - **Repository name**: `storyforge-ai` (或您喜欢的名称)
   - **Description**: `AI story creation application - 基于 React + Vite 的 AI 故事创作应用`
   - **Visibility**: Public (公开) 或 Private (私有)
   - **不要**勾选 "Initialize this repository with a README"（我们已经有了）
3. 点击 "Create repository"

### 3. 添加远程仓库并推送

在项目目录下执行以下命令（将 `YOUR_TOKEN` 替换为您的 token，`YOUR_USERNAME` 替换为您的 GitHub 用户名）：

```powershell
# 添加远程仓库
git remote add origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/storyforge-ai.git

# 或者使用您的用户名（推送时会提示输入 token）
git remote add origin https://github.com/YOUR_USERNAME/storyforge-ai.git

# 推送代码
git branch -M main
git push -u origin main
```

**使用 token 推送时**，用户名填写您的 GitHub 用户名，密码填写 token。

## 方法二：使用 SSH 密钥（更安全）

### 1. 生成 SSH 密钥

```powershell
ssh-keygen -t ed25519 -C "1368994625@qq.com"
```

按提示操作（可以直接回车使用默认路径和空密码）。

### 2. 添加 SSH 密钥到 GitHub

1. 复制公钥内容：
   ```powershell
   cat ~/.ssh/id_ed25519.pub
   ```
   或 Windows:
   ```powershell
   type $env:USERPROFILE\.ssh\id_ed25519.pub
   ```

2. 访问: https://github.com/settings/keys
3. 点击 "New SSH key"
4. 填写：
   - **Title**: `StoryForge-AI` (或任意名称)
   - **Key**: 粘贴刚才复制的公钥内容
5. 点击 "Add SSH key"

### 3. 添加远程仓库并推送

```powershell
# 添加远程仓库（使用 SSH URL）
git remote add origin git@github.com:YOUR_USERNAME/storyforge-ai.git

# 推送代码
git branch -M main
git push -u origin main
```

## 验证

推送成功后，访问您的 GitHub 仓库页面，应该能看到所有代码文件。

## 注意事项

1. ✅ **已排除敏感文件**：
   - `data/settings.json` (包含 API 密钥)
   - `data/sessions.json` (用户数据)
   - `data/writingSamples.json` (用户自定义范文)
   - `我的故事库/` (用户故事数据)
   - `node_modules/` (依赖包)
   - `dist/` (构建输出)

2. ✅ **已创建示例文件**：
   - `data/settings.json.example` (API 配置示例)

3. ⚠️ **如果之前已经提交过敏感文件**，需要从历史记录中移除（使用 `git filter-branch` 或 `git filter-repo`）

## 后续更新

以后每次更新代码后，使用以下命令推送：

```powershell
git add .
git commit -m "描述您的更改"
git push
```

