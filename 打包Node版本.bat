@echo off
chcp 65001 >nul
title StoryForge AI - 打包 Node 版本（分发版）

echo ========================================
echo   StoryForge AI - 打包 Node 版本
echo ========================================
echo.
echo 这将创建一个 Node 版本的分发包
echo ✓ 包含所有源代码
echo ✓ 排除用户数据（API设置、故事库）
echo ✓ 用户需要安装 Node.js 才能运行
echo.
echo ========================================
echo.

REM 检查是否已安装依赖
if not exist "node_modules\" (
    echo [提示] 检测到未安装依赖
    echo [操作] 正在安装依赖...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ 安装失败！
        pause
        exit /b 1
    )
    echo.
)

echo [步骤 1/2] 构建 Web 应用（生产版本）...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ 构建失败！
    pause
    exit /b 1
)
echo ✅ Web 应用构建完成
echo.

echo [步骤 2/2] 创建分发目录...
set DIST_DIR=StoryForge-AI-Node版本-%date:~0,4%%date:~5,2%%date:~8,2%

if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
mkdir "%DIST_DIR%"

echo [操作] 复制必要文件...
xcopy /E /I /Y "dist" "%DIST_DIR%\dist"
xcopy /E /I /Y "electron" "%DIST_DIR%\electron"
xcopy /E /I /Y "components" "%DIST_DIR%\components"
xcopy /E /I /Y "services" "%DIST_DIR%\services"
copy /Y "package.json" "%DIST_DIR%\"
copy /Y "package-lock.json" "%DIST_DIR%\"
copy /Y "tsconfig.json" "%DIST_DIR%\"
copy /Y "vite.config.ts" "%DIST_DIR%\"
copy /Y "postcss.config.js" "%DIST_DIR%\"
copy /Y "index.html" "%DIST_DIR%\"
copy /Y "index.tsx" "%DIST_DIR%\"
copy /Y "index.css" "%DIST_DIR%\"
copy /Y "App.tsx" "%DIST_DIR%\"
copy /Y "types.ts" "%DIST_DIR%\"
copy /Y "defaultContent.ts" "%DIST_DIR%\"
copy /Y "data-server.js" "%DIST_DIR%\"
copy /Y "electron-dev.js" "%DIST_DIR%\"
copy /Y "proxy-server.js" "%DIST_DIR%\"
copy /Y "启动应用.bat" "%DIST_DIR%\"
copy /Y "启动应用和数据服务器.bat" "%DIST_DIR%\"
copy /Y "启动数据服务器.bat" "%DIST_DIR%\"
copy /Y "使用说明.txt" "%DIST_DIR%\"

echo [操作] 创建空的 data 目录（用于用户数据）...
mkdir "%DIST_DIR%\data"
echo {} > "%DIST_DIR%\data\sessions.json"
echo {} > "%DIST_DIR%\data\settings.json"
echo [] > "%DIST_DIR%\data\quickPrompts.json"
echo [] > "%DIST_DIR%\data\writingSamples.json"
echo false > "%DIST_DIR%\data\writingSamplesEnabled.json"

echo [操作] 创建 README 文件...
(
echo StoryForge AI - Node 版本
echo ====================
echo.
echo 使用说明：
echo.
echo 1. 安装 Node.js（如果还没有安装）
echo    下载地址：https://nodejs.org/
echo.
echo 2. 安装依赖：
echo    npm install
echo.
echo 3. 启动应用：
echo    方式1：双击"启动应用.bat"
echo    方式2：运行 npm run dev
echo.
echo 4. 配置 API Key：
echo    启动后，点击右上角的钥匙图标配置 API Key
echo.
echo 数据存储：
echo - 所有数据保存在 data/ 目录
echo - 包括：API设置、故事库、快捷提示词等
echo.
echo 注意：
echo - 此版本不包含任何用户数据
echo - 需要重新配置 API Key
echo - 需要重新导入或创建故事
) > "%DIST_DIR%\README.txt"

echo.
echo ========================================
echo ✅ 打包完成！
echo ========================================
echo.
echo 📦 分发目录：%DIST_DIR%
echo.
echo 📝 下一步：
echo   1. 可以将整个目录压缩为 ZIP 文件
echo   2. 分发给其他用户
echo   3. 用户需要安装 Node.js 才能运行
echo.
pause




















