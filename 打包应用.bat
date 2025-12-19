@echo off
chcp 65001 >nul
title StoryForge AI - 打包应用（排除用户数据）

echo ========================================
echo   StoryForge AI - 打包应用
echo ========================================
echo.
echo 这将打包两个版本：
echo 1. EXE 安装版（Windows 安装程序）
echo 2. Node 版本（需要 Node.js 运行）
echo.
echo ⚠️  注意：打包时会排除所有用户数据
echo    - data/ 目录（API设置、故事库）
echo    - 我的故事库/ 目录
echo    - 所有 .json 和 .txt 文件
echo.
echo ========================================
echo.

REM 检查是否已安装依赖
if not exist "node_modules\" (
    echo [提示] 检测到未安装依赖
    echo [操作] 正在安装依赖...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ 安装失败！
        pause
        exit /b 1
    )
    echo.
)

echo [步骤 1/3] 清理旧的构建文件...
if exist "dist\" rmdir /s /q "dist"
if exist "release\" rmdir /s /q "release"
echo ✅ 清理完成
echo.

echo [步骤 2/3] 构建 Web 应用（生产版本）...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ 构建失败！
    pause
    exit /b 1
)
echo ✅ Web 应用构建完成
echo.

echo [步骤 3/3] 打包 Electron 桌面应用（EXE 安装版）...
echo 这可能需要几分钟时间...
echo.
call npm run electron:build:win
if errorlevel 1 (
    echo.
    echo ❌ 打包失败！
    pause
    exit /b 1
)
echo ✅ Electron 应用打包完成
echo.

echo ========================================
echo ✅ 打包完成！
echo ========================================
echo.
echo 📦 打包结果：
echo.
echo 1. EXE 安装版：
echo    - 位置：release\ 目录
echo    - 文件：StoryForge AI Setup *.exe
echo    - 说明：双击安装后即可使用
echo.
echo 2. Node 版本（当前使用的版本）：
echo    - 位置：项目根目录
echo    - 启动：npm run dev 或 启动应用.bat
echo    - 说明：需要 Node.js 环境
echo.
echo ⚠️  重要提示：
echo    - 打包时已排除所有用户数据
echo    - 用户需要重新配置 API Key
echo    - 用户需要重新导入故事数据
echo.
echo 📝 分发说明：
echo    - EXE 安装版：可以直接分发给其他用户
echo    - Node 版本：需要用户安装 Node.js
echo.
pause




















