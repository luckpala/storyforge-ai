@echo off
chcp 65001 >nul
title StoryForge 数据服务器

echo ========================================
echo   StoryForge 数据服务器
echo ========================================
echo.
echo 此服务器用于在本地保存和共享数据
echo 支持跨浏览器数据同步
echo.
echo 数据目录: %~dp0data
echo.
echo [提示] 如需手机访问，请运行 "配置防火墙_允许数据服务器.bat"
echo        需要管理员权限
echo.
echo ========================================
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

