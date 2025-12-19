# GitHub 仓库信息

## 仓库地址

**GitHub 仓库**: https://github.com/luckpala/storyforge-ai

## 代码已成功推送 ✅

所有代码已成功推送到 GitHub，您的朋友可以通过以下方式下载：

### 方式一：直接下载 ZIP

访问：https://github.com/luckpala/storyforge-ai/archive/refs/heads/main.zip

### 方式二：使用 Git 克隆

```bash
git clone https://github.com/luckpala/storyforge-ai.git
cd storyforge-ai
npm install
```

### 方式三：使用 GitHub Desktop

1. 打开 GitHub Desktop
2. 点击 "File" -> "Clone Repository"
3. 搜索 `luckpala/storyforge-ai`
4. 选择本地路径并克隆

## 安全提示 ⚠️

**重要**：您的 Personal Access Token 已从远程 URL 中移除，这是为了安全考虑。

### 后续推送代码

如果需要推送更新，有两种方式：

#### 方式一：使用 Git Credential Manager（推荐）

首次推送时会提示输入凭据：
- **用户名**: `luckpala`
- **密码**: 输入您的 Personal Access Token（请从安全的地方获取，不要在此文档中保存）

Git 会记住这些凭据，后续推送无需再次输入。

#### 方式二：在 URL 中包含 Token（临时使用，不推荐）

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/luckpala/storyforge-ai.git
```

**注意**：这种方式会将 token 保存在 `.git/config` 中，建议推送后立即移除。**请勿将 token 提交到代码仓库中！**

## 已排除的敏感文件

以下文件**不会**被推送到 GitHub（已在 `.gitignore` 中排除）：

- ✅ `data/settings.json` - 包含您的 API 密钥
- ✅ `data/sessions.json` - 用户会话数据
- ✅ `data/writingSamples.json` - 用户自定义范文
- ✅ `我的故事库/` - 用户故事数据
- ✅ `node_modules/` - 依赖包
- ✅ `dist/` - 构建输出

## 示例配置文件

已创建 `data/settings.json.example` 作为配置模板，用户可以复制并填写自己的 API 密钥。

## 更新代码

以后每次更新代码后，使用以下命令推送：

```bash
git add .
git commit -m "描述您的更改"
git push
```

如果提示需要认证，输入您的 GitHub 用户名和 Personal Access Token。

