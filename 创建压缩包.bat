@echo off
chcp 65001 >nul
echo ========================================
echo StoryForge AI - 创建压缩包
echo ========================================
echo.

cd /d "%~dp0"

if not exist "dist" (
    echo ❌ 错误：找不到 dist 目录
    echo.
    echo 请先运行构建命令：
    echo   npm run build
    echo.
    pause
    exit /b 1
)

echo [1/2] 正在检查 dist 目录内容...
dir /b dist
echo.

echo [2/2] 正在创建压缩包...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$date = Get-Date -Format 'yyyyMMdd-HHmmss'; $zipName = 'StoryForge-AI-分发版-' + $date + '.zip'; Compress-Archive -Path 'dist\*' -DestinationPath $zipName -Force; Write-Host '✅ 压缩包创建成功: ' $zipName"

if %errorlevel% neq 0 (
    echo.
    echo ❌ 压缩失败！
    echo.
    echo 请手动压缩 dist 文件夹：
    echo 1. 右键点击 dist 文件夹
    echo 2. 选择"发送到" -> "压缩(zipped)文件夹"
    echo 3. 重命名为 "StoryForge-AI-分发版.zip"
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ 打包完成！
echo.
echo 📦 压缩包位置：项目根目录
echo.
echo ========================================
pause

