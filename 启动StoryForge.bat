@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title StoryForge AI - 开发服务器
echo ========================================
echo    StoryForge AI 开发服务器启动中...
echo ========================================
echo.

cd /d "D:\storyforge-ai"

if not exist "package.json" (
    echo 错误: 找不到项目文件！
    echo 请确保项目路径正确: D:\storyforge-ai
    pause
    exit /b 1
)

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
echo   端口清理完成
echo.

REM 检查代理服务器状态
echo [检查] 正在检查代理服务器状态...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PROXY_PID=%%a
        goto :proxy_found3
    )
    :proxy_found3
    echo [状态] ✅ 代理服务器运行中 (进程ID: %PROXY_PID%)
    echo.
) else (
    echo [状态] ⚪ 代理服务器未运行
    echo [提示] 如果遇到CORS错误，请运行 "启动代理服务器.bat"
    echo.
)

echo 正在启动开发服务器...
echo 服务器启动后，请在浏览器中访问: http://localhost:3000/
echo.
echo 按 Ctrl+C 可以停止服务器
echo ========================================
echo.

npm run dev

pause

