@echo off
chcp 65001 >nul
title StoryForge AI - 启动应用、数据服务器和代理

echo ========================================
echo   StoryForge AI - 启动所有服务
echo ========================================
echo.

echo [操作] 正在启动数据服务器（后台运行）...
start "StoryForge数据服务器" /min cmd /c "cd /d %~dp0 && node data-server.js"
timeout /t 4 /nobreak >nul

echo [操作] 正在启动代理服务器（后台运行）...
start "StoryForge代理服务器" /min cmd /c "cd /d %~dp0 && node proxy-server.js"
timeout /t 4 /nobreak >nul

echo ========================================
echo.
echo [操作] 正在启动开发服务器...
echo [地址] http://localhost:3000
echo.
echo ========================================
echo.

npm run dev

if errorlevel 1 (
    echo.
    echo 错误：无法启动开发服务器
    echo.
    pause
)








































