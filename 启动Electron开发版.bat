@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title StoryForge AI - Electron 开发模式

echo ========================================
echo   StoryForge AI - Electron 开发模式
echo ========================================
echo.

REM 自动清理端口占用
echo [预处理] 正在清理可能占用的端口...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   发现端口 3000 被占用，正在清理...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

for /L %%p in (3001,1,3010) do (
    netstat -ano | findstr ":%%p" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   发现端口 %%p 被占用，正在清理...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p" ^| findstr "LISTENING"') do (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)
echo   端口清理完成
echo.

echo 这将启动 Electron 桌面应用（开发模式）
echo 数据服务器会自动集成在应用中
echo.
echo ========================================
echo.

npm run electron:dev

if errorlevel 1 (
    echo.
    echo ❌ 错误：无法启动 Electron
    echo.
    echo 请检查：
    echo 1. 是否已安装所有依赖（运行 npm install）
    echo 2. 是否已安装 Electron 相关依赖
    echo.
    pause
)

