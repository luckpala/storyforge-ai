@echo off
chcp 65001 >nul
title StoryForge AI - 打包 Electron 应用

echo ========================================
echo   StoryForge AI - 打包 Electron 应用
echo ========================================
echo.
echo 这将构建并打包桌面应用
echo 打包完成后，安装包在 release 目录中
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

echo [操作] 正在构建并打包应用...
echo 这可能需要几分钟时间...
echo.

npm run electron:build:win

if errorlevel 1 (
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
    echo 安装包位置：release 目录
    echo.
    echo 您可以：
    echo 1. 运行安装包安装应用
    echo 2. 将安装包分发给其他用户
    echo.
    pause
)








































