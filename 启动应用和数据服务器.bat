@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title StoryForge AI - 启动应用、数据服务器和代理

echo ========================================
echo   StoryForge AI - 启动所有服务
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
echo   端口清理完成
echo.

REM 检查数据服务器是否已在运行
echo [检查] 正在检查数据服务器状态...
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [状态] 数据服务器已在运行
    echo [地址] http://127.0.0.1:8765
    echo.
) else (
    echo [操作] 正在启动数据服务器（后台运行）...
    start "StoryForge数据服务器" /min cmd /c "cd /d %~dp0 && node data-server.js"
    timeout /t 4 /nobreak >nul
    
    REM 再次检查是否启动成功
    netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [状态] 数据服务器启动成功
        echo [地址] http://127.0.0.1:8765
        echo [提示] 如需手机访问，请运行 "配置防火墙_允许数据服务器.bat"（需要管理员权限）
        echo.
    ) else (
        echo [警告] 数据服务器可能启动失败，但将继续启动其他服务
        echo [提示] 如果遇到数据保存问题，请手动运行 "启动数据服务器.bat"
        echo.
    )
)

REM 检查代理服务器状态
echo [检查] 正在检查代理服务器状态...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PROXY_PID=%%a
        goto proxy_found
    )
    :proxy_found
    echo [状态] 代理服务器已在运行 (进程ID: !PROXY_PID!)
    echo [地址] http://localhost:3001
    echo.
) else (
    echo [状态] 代理服务器未运行
    echo [操作] 正在启动代理服务器（后台运行）...
    start "StoryForge代理服务器" /min cmd /c "cd /d %~dp0 && node proxy-server.js"
    timeout /t 4 /nobreak >nul
    
    REM 再次检查是否启动成功
    netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [状态] 代理服务器启动成功
        echo [地址] http://localhost:3001
        echo.
    ) else (
        echo [警告] 代理服务器可能启动失败，但将继续启动开发服务器
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
    echo 错误：无法启动开发服务器
    echo.
    pause
)
