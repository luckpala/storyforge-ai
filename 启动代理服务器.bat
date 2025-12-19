@echo off
chcp 65001 >nul
title StoryForge AI - CORS代理服务器

echo ========================================
echo   StoryForge AI - CORS代理服务器
echo ========================================
echo.

REM 检查代理服务器是否已在运行
echo [检查] 正在检查代理服务器状态...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PID=%%a
        goto :found
    )
    :found
    echo [状态] ✅ 代理服务器已在运行 (进程ID: %PID%)
    echo [提示] 如果这是新窗口，请关闭旧窗口或使用任务管理器结束进程 %PID%
    echo.
    echo 是否要启动新的代理服务器实例？(Y/N)
    choice /c YN /n /m ""
    if errorlevel 2 exit /b 0
    if errorlevel 1 (
        echo.
        echo [操作] 正在启动新的代理服务器实例...
        echo [提示] 如果端口被占用，将自动尝试其他端口 (3002-3010)
        echo.
    )
) else (
    echo [状态] ⚪ 代理服务器未运行
    echo [操作] 正在启动代理服务器...
    echo.
)

echo ========================================
echo.
echo 此代理服务器用于解决浏览器CORS限制问题
echo 请保持此窗口运行，不要关闭
echo.
echo 代理服务器地址: http://localhost:3001
echo (如果端口被占用，将自动使用 3002-3010)
echo.
echo ========================================
echo.

node proxy-server.js

if errorlevel 1 (
    echo.
    echo ❌ 错误：无法启动代理服务器
    echo.
    echo 请检查：
    echo 1. 是否已安装 Node.js
    echo 2. 是否在项目根目录运行此脚本
    echo 3. 端口 3001-3010 是否都被占用
    echo.
    pause
)

