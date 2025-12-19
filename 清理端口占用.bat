@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title StoryForge AI - 清理端口占用

echo ========================================
echo   清理端口占用工具
echo ========================================
echo.
echo 此脚本将清理以下端口的占用：
echo   - 3000 (Vite 开发服务器)
echo   - 3001-3010 (代理服务器)
echo   - 8765 (数据服务器)
echo.
echo ⚠️  注意：这将关闭占用这些端口的 Node.js 进程
echo.
pause

echo.
echo ========================================
echo 开始清理...
echo ========================================
echo.

REM 清理 3000 端口
echo [1] 检查端口 3000...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   发现端口 3000 被占用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        set PID=%%a
        echo   正在关闭进程 ID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✓ 端口 3000 已释放
        ) else (
            echo   ⚠️  无法关闭进程（可能需要管理员权限）
        )
    )
) else (
    echo   ✓ 端口 3000 未被占用
)

REM 清理 3001-3010 端口（代理服务器）
echo.
echo [2] 检查端口 3001-3010（代理服务器）...
set FOUND=0
for /L %%p in (3001,1,3010) do (
    netstat -ano | findstr ":%%p" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        set FOUND=1
        echo   发现端口 %%p 被占用
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p" ^| findstr "LISTENING"') do (
            set PID=%%a
            echo   正在关闭进程 ID: !PID!
            taskkill /F /PID !PID! >nul 2>&1
            if !errorlevel! equ 0 (
                echo   ✓ 端口 %%p 已释放
            )
        )
    )
)
if !FOUND! equ 0 (
    echo   ✓ 端口 3001-3010 未被占用
)

REM 清理 8765 端口（数据服务器）
echo.
echo [3] 检查端口 8765（数据服务器）...
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   发现端口 8765 被占用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
        set PID=%%a
        echo   正在关闭进程 ID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✓ 端口 8765 已释放
        ) else (
            echo   ⚠️  无法关闭进程（可能需要管理员权限）
        )
    )
) else (
    echo   ✓ 端口 8765 未被占用
)

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 提示：
echo   - 如果某些进程无法关闭，请以管理员权限运行此脚本
echo   - 清理后可以重新启动应用
echo.
pause








































