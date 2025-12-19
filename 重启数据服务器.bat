@echo off
chcp 65001 >nul
title 重启 StoryForge 数据服务器

echo ========================================
echo   重启 StoryForge 数据服务器
echo ========================================
echo.

REM 查找并结束占用 8765 端口的进程
echo 正在检查端口 8765...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    echo 发现进程 %%a 占用端口 8765，正在结束...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo.
echo 正在启动数据服务器...
echo.

node data-server.js

if errorlevel 1 (
    echo.
    echo ❌ 错误：无法启动数据服务器
    echo.
    echo 请检查：
    echo 1. 是否已安装 Node.js
    echo 2. 端口 8765 是否被占用
    echo.
    pause
)








































