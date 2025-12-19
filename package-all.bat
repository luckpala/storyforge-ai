@echo off
chcp 65001 >nul
echo ========================================
echo StoryForge AI - 打包脚本
echo ========================================
echo.

echo [1/2] 正在构建生产版本...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ 构建失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo ✅ 构建完成！
echo.
echo 📦 构建文件位置：dist 目录
echo.
echo ========================================
echo 下一步操作：
echo ========================================
echo.
echo 方案1：直接分发 dist 文件夹
echo   - 将 dist 文件夹压缩成 zip
echo   - 包含"使用说明.txt"
echo   - 用户需要安装 Node.js 和 http-server
echo.
echo 方案2：打包成 Electron 桌面应用（推荐）
echo   运行以下命令：
echo   npm install --save-dev electron electron-builder
echo   npm run electron:build:win
echo.
echo 方案3：打包成安卓 APK
echo   运行以下命令：
echo   npm install @capacitor/core @capacitor/cli @capacitor/android
echo   npx cap init
echo   npx cap add android
echo   npx cap sync
echo   npx cap open android
echo.
echo ========================================
pause

