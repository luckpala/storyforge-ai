@echo off
chcp 65001 >nul
title StoryForge AI - 启动应用和代理服务器

echo ========================================
echo   StoryForge AI - 启动应用和代理
echo ========================================
echo.

REM 检查代理服务器状态
echo [检查] 正在检查代理服务器状态...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PROXY_PID=%%a
        goto :proxy_found
    )
    :proxy_found
    echo [状态] ✅ 代理服务器已在运行 (进程ID: %PROXY_PID%)
    echo [地址] http://localhost:3001
    echo.
) else (
    echo [状态] ⚪ 代理服务器未运行
    echo [操作] 正在启动代理服务器（后台运行）...
    start "StoryForge代理服务器" /min cmd /c "cd /d %~dp0 && node proxy-server.js"
    timeout /t 2 /nobreak >nul
    
    REM 再次检查是否启动成功
    netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [状态] ✅ 代理服务器启动成功
        echo [地址] http://localhost:3001
        echo.
    ) else (
        echo [警告] ⚠️  代理服务器可能启动失败，但将继续启动开发服务器
        echo [提示] 如果遇到CORS错误，请手动运行 "启动代理服务器.bat"
        echo.
    )
)

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
    echo ❌ 错误：无法启动开发服务器
    echo.
    pause
)

