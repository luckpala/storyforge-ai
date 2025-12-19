@echo off
chcp 65001 >nul
echo ========================================
echo StoryForge AI - 启动脚本
echo ========================================
echo.

REM 检查是否已安装 http-server
where http-server >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 检测到未安装 http-server
    echo.
    echo 正在安装 http-server...
    call npm install -g http-server
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 安装失败！请确保已安装 Node.js
        echo    下载地址：https://nodejs.org/
        pause
        exit /b 1
    )
    echo.
    echo ✅ http-server 安装成功！
    echo.
)

REM 检查 dist 目录是否存在
if not exist "dist" (
    echo ❌ 错误：找不到 dist 目录
    echo.
    echo 请先运行构建命令：
    echo   npm run build
    echo.
    echo 或运行打包脚本：
    echo   package-all.bat
    echo.
    pause
    exit /b 1
)

REM 检查代理服务器状态
echo [检查] 正在检查代理服务器状态...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        set PROXY_PID=%%a
        goto :proxy_found2
    )
    :proxy_found2
    echo [状态] ✅ 代理服务器运行中 (进程ID: %PROXY_PID%)
    echo.
) else (
    echo [状态] ⚪ 代理服务器未运行
    echo [提示] 如果遇到CORS错误，请运行 "启动代理服务器.bat"
    echo.
)

echo 正在启动应用...
echo.
echo 📱 应用地址：http://localhost:3000
echo.
echo 💡 提示：
echo    - 在浏览器中打开上述地址即可使用
echo    - 按 Ctrl+C 可以停止服务器
echo.
echo ========================================
echo.

cd dist
start http://localhost:3000
http-server -p 3000

