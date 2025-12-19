# StoryForge AI - 安卓使用指南

## 📱 方案一：直接在浏览器中使用（最简单）

这是最简单的方法，无需安装任何应用。

### 步骤：

1. **确保手机和电脑在同一局域网（WiFi）**

2. **在电脑上启动应用**
   - 运行 `启动应用.bat` 或 `npm run dev`
   - 查看终端输出的网络地址，例如：`http://192.168.1.100:3000`

3. **在手机浏览器中打开**
   - 打开 Chrome 或 Edge 浏览器
   - 输入电脑的 IP 地址和端口，例如：`http://192.168.1.100:3000`
   - 即可在手机上使用

### 获取电脑 IP 地址的方法：

**Windows:**
```bash
ipconfig
```
查找 "IPv4 地址"，例如：`192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
# 或
ip addr
```

### 优点：
- ✅ 无需安装，直接使用
- ✅ 数据同步（使用同一服务器）
- ✅ 适合临时使用

### 缺点：
- ❌ 需要电脑一直运行
- ❌ 需要同一局域网
- ❌ 工作目录功能不可用（移动浏览器不支持）

---

## 📱 方案二：打包成 APK 安装包（推荐）

将应用打包成独立的安卓应用，可以安装到手机/平板上。

### 前置要求：

1. **安装 Node.js**（https://nodejs.org/）
2. **安装 Android Studio**（https://developer.android.com/studio）
   - 需要下载 Android SDK
   - 需要配置环境变量

### 详细步骤：

#### 步骤1：安装 Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

#### 步骤2：初始化 Capacitor

```bash
npx cap init
```

初始化时会询问：
- **App name**: `StoryForge AI`
- **App ID**: `com.storyforge.ai`
- **Web dir**: `dist`

#### 步骤3：构建 Web 应用

```bash
npm run build
```

#### 步骤4：添加安卓平台

```bash
npx cap add android
npx cap sync
```

#### 步骤5：配置安卓应用

编辑 `android/app/src/main/AndroidManifest.xml`，确保有网络权限：

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <application ...>
        ...
    </application>
</manifest>
```

#### 步骤6：在 Android Studio 中打开

```bash
npx cap open android
```

这会自动打开 Android Studio。

#### 步骤7：构建 APK

在 Android Studio 中：

1. **等待 Gradle 同步完成**

2. **构建调试版 APK（用于测试）**：
   - 点击菜单 `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - 等待构建完成
   - APK 文件位置：`android/app/build/outputs/apk/debug/app-debug.apk`

3. **构建发布版 APK（用于分发）**：
   - 点击菜单 `Build` → `Generate Signed Bundle / APK`
   - 选择 `APK`
   - 首次需要创建密钥：
     - 点击 `Create new...`
     - 填写密钥信息（记住密码！）
     - 选择密钥文件保存位置
   - 选择 `release` 构建类型
   - 点击 `Finish`
   - APK 文件位置：`android/app/build/outputs/apk/release/app-release.apk`

#### 步骤8：安装到设备

**方法1：通过 USB 连接**
- 用 USB 连接手机到电脑
- 在手机上启用"USB 调试"（开发者选项）
- 在 Android Studio 中点击运行按钮（绿色播放图标）

**方法2：传输 APK 文件**
- 将 APK 文件传输到手机（通过 USB、网盘、邮件等）
- 在手机上打开文件管理器
- 点击 APK 文件安装
- 如果提示"禁止安装未知来源应用"，需要在设置中允许

### 优点：
- ✅ 独立应用，无需电脑
- ✅ 可以分发安装包
- ✅ 体验接近原生应用

### 缺点：
- ❌ 需要 Android Studio（较大，约 1GB+）
- ❌ 构建过程较复杂
- ❌ 工作目录功能仍不可用（移动端限制）

---

## 📱 方案三：PWA（渐进式 Web 应用）

将应用添加到手机主屏幕，像原生应用一样使用。

### 步骤：

1. **在手机浏览器中打开应用**（使用方案一或部署到服务器）

2. **添加到主屏幕**：
   - **Chrome/Edge**: 点击菜单（三个点）→ "添加到主屏幕"
   - **Safari**: 点击分享按钮 → "添加到主屏幕"

3. **从主屏幕打开**，就像原生应用一样

### 优点：
- ✅ 无需安装 APK
- ✅ 可以离线缓存（部分功能）
- ✅ 体验接近原生应用

### 缺点：
- ❌ 仍需要网络访问（首次加载）
- ❌ 工作目录功能不可用

---

## ⚠️ 移动端功能限制

### 不可用的功能：

1. **工作目录同步**
   - File System Access API 不支持移动浏览器
   - 数据只能存储在浏览器本地存储中
   - 建议定期使用导出功能备份

### 可用的功能：

- ✅ 所有创作功能（聊天、故事板、AI 生成等）
- ✅ API Key 配置
- ✅ 数据导出（JSON/TXT）
- ✅ 多会话管理
- ✅ 写作范文功能

---

## 🔧 移动端优化建议

### 1. 响应式设计

应用已经支持响应式设计，在手机上会自动调整布局：
- 侧边栏变为抽屉式菜单
- 聊天窗口和故事板可以切换显示
- 触摸操作优化

### 2. 键盘适配

- 输入框会自动调整，避免被键盘遮挡
- 可以使用手机输入法的语音输入

### 3. 网络要求

- 需要稳定的网络连接来调用 AI API
- 建议使用 WiFi 或 4G/5G 网络

---

## 📋 快速参考

### 最简单的方法（推荐新手）：
1. 电脑运行应用
2. 手机浏览器访问电脑 IP 地址
3. 添加到主屏幕（可选）

### 最专业的方法（推荐分发）：
1. 使用 Capacitor 打包成 APK
2. 安装到手机/平板
3. 像原生应用一样使用

---

## ❓ 常见问题

**Q: 为什么工作目录功能在手机上不能用？**
A: 这是浏览器安全限制。File System Access API 只在桌面版 Chrome/Edge 中支持，移动浏览器不支持直接访问文件系统。

**Q: 手机上的数据会丢失吗？**
A: 数据存储在浏览器本地存储中。如果清除浏览器数据会丢失，建议定期使用导出功能备份。

**Q: 可以离线使用吗？**
A: 不可以，需要网络连接来调用 AI API。但界面可以缓存，离线时可以看到之前的内容。

**Q: APK 文件很大吗？**
A: 通常 10-20 MB 左右，取决于包含的资源。

---

## 🎯 推荐方案

- **个人使用/测试**：方案一（浏览器访问）
- **正式分发**：方案二（打包 APK）
- **便捷使用**：方案三（PWA 添加到主屏幕）

选择最适合您需求的方案！

