@echo off
chcp 65001 >nul
title StoryForge AI - 打包独立桌面应用

echo ========================================
echo   StoryForge AI - 打包独立桌面应用
echo ========================================
echo.
echo 这将创建一个完全独立的桌面应用
echo ✓ 无需运行任何服务器
echo ✓ 无需启动开发服务器
echo ✓ 无需启动代理服务器
echo ✓ 数据服务器已集成在应用中
echo ✓ 双击安装后即可使用
echo.
echo ========================================
echo.

REM 检查是否已安装 Electron
npm list electron >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 检测到未安装 Electron 依赖
    echo [操作] 正在安装 Electron 相关依赖...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 安装失败！
        pause
        exit /b 1
    )
    echo.
)

echo [步骤 1/2] 正在构建 Web 应用（生产版本）...
echo.
npm run build

if %errorlevel% neq 0 (
    echo.
    echo ❌ 构建失败！
    pause
    exit /b 1
)

echo.
echo [步骤 2/2] 正在打包 Electron 桌面应用...
echo 这可能需要几分钟时间（首次打包需要下载 Electron 二进制文件）...
echo.

npm run electron:build:win

if %errorlevel% neq 0 (
    echo.
    echo ❌ 打包失败！
    echo.
    pause
) else (
    echo.
    echo ========================================
    echo ✅ 打包完成！
    echo ========================================
    echo.
    echo 📦 安装包位置：release 目录
    echo.
    echo ✨ 特性：
    echo   ✓ 完全独立，无需运行任何服务器
    echo   ✓ 数据自动保存在系统目录
    echo   ✓ 双击安装后即可使用
    echo   ✓ 可以分发给其他用户
    echo.
    echo 📝 使用方法：
    echo   1. 在 release 目录找到安装包
    echo   2. 双击安装包进行安装
    echo   3. 安装完成后，从开始菜单或桌面快捷方式启动
    echo   4. 首次使用需要配置 API Key
    echo.
    pause
)
