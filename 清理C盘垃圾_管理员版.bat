@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title StoryForge AI - C盘垃圾清理工具（管理员版）

REM 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo   需要管理员权限
    echo ========================================
    echo.
    echo 正在请求管理员权限...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================
echo   C盘垃圾清理工具（管理员版）
echo ========================================
echo.
echo 此脚本将清理以下内容：
echo   1. Windows 临时文件
echo   2. 用户临时文件
echo   3. npm 缓存
echo   4. 回收站
echo   5. 系统日志文件
echo   6. 预读取文件
echo   7. Windows 更新缓存
echo   8. 系统错误报告
echo   9. 旧 Windows 安装文件
echo.
echo ⚠️  注意：此操作不可逆，请确保已保存重要文件
echo.
pause

echo.
echo ========================================
echo 开始清理...
echo ========================================
echo.

REM 记录清理前的磁盘空间
for /f "tokens=3" %%a in ('dir C:\ ^| find "可用字节"') do set BEFORE=%%a
echo [清理前] C盘可用空间: %BEFORE%
echo.

REM 1. 清理 Windows 临时文件
echo [1/9] 清理 Windows 临时文件...
if exist "%TEMP%\*" (
    del /f /s /q "%TEMP%\*" >nul 2>&1
    echo   ✓ 已清理用户临时文件
)

if exist "C:\Windows\Temp\*" (
    del /f /s /q "C:\Windows\Temp\*" >nul 2>&1
    echo   ✓ 已清理系统临时文件
)

REM 2. 清理用户临时文件
echo [2/9] 清理用户临时文件...
if exist "%USERPROFILE%\AppData\Local\Temp\*" (
    del /f /s /q "%USERPROFILE%\AppData\Local\Temp\*" >nul 2>&1
    echo   ✓ 已清理用户本地临时文件
)

REM 3. 清理 npm 缓存
echo [3/9] 清理 npm 缓存...
if exist "%APPDATA%\npm-cache" (
    rd /s /q "%APPDATA%\npm-cache" >nul 2>&1
    echo   ✓ 已清理 npm 缓存
)

where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo   正在使用 npm 清理缓存...
    call npm cache clean --force >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ✓ npm 缓存已清理
    )
)

REM 4. 清理回收站
echo [4/9] 清理回收站...
rd /s /q "C:\$Recycle.Bin" >nul 2>&1
echo   ✓ 回收站已清空

REM 5. 清理系统日志文件
echo [5/9] 清理系统日志文件...
if exist "C:\Windows\Logs\*" (
    del /f /s /q "C:\Windows\Logs\*" >nul 2>&1
    echo   ✓ 已清理系统日志文件
)

REM 6. 清理预读取文件
echo [6/9] 清理预读取文件...
if exist "C:\Windows\Prefetch\*" (
    del /f /q "C:\Windows\Prefetch\*" >nul 2>&1
    echo   ✓ 已清理预读取文件
)

REM 7. 清理 Windows 更新缓存
echo [7/9] 清理 Windows 更新缓存...
REM 停止 Windows Update 服务
net stop wuauserv >nul 2>&1
net stop cryptSvc >nul 2>&1
net stop bits >nul 2>&1
net stop msiserver >nul 2>&1

if exist "C:\Windows\SoftwareDistribution\Download\*" (
    del /f /s /q "C:\Windows\SoftwareDistribution\Download\*" >nul 2>&1
    echo   ✓ 已清理 Windows 更新下载缓存
)

REM 重新启动服务
net start wuauserv >nul 2>&1
net start cryptSvc >nul 2>&1
net start bits >nul 2>&1
net start msiserver >nul 2>&1

REM 8. 清理系统错误报告
echo [8/9] 清理系统错误报告...
if exist "C:\ProgramData\Microsoft\Windows\WER\ReportQueue\*" (
    del /f /s /q "C:\ProgramData\Microsoft\Windows\WER\ReportQueue\*" >nul 2>&1
    echo   ✓ 已清理系统错误报告
)

if exist "%LOCALAPPDATA%\Microsoft\Windows\WER\ReportQueue\*" (
    del /f /s /q "%LOCALAPPDATA%\Microsoft\Windows\WER\ReportQueue\*" >nul 2>&1
    echo   ✓ 已清理用户错误报告
)

REM 9. 清理旧 Windows 安装文件（Windows.old）
echo [9/9] 检查旧 Windows 安装文件...
if exist "C:\Windows.old" (
    echo   发现 Windows.old 文件夹（旧系统文件）
    echo   此文件夹可能占用大量空间，但删除后无法回退到旧系统
    set /p DELETE_OLD="是否删除 Windows.old？(Y/N，默认N): "
    if /i "!DELETE_OLD!"=="Y" (
        echo   正在删除 Windows.old（这可能需要很长时间）...
        rd /s /q "C:\Windows.old" >nul 2>&1
        echo   ✓ Windows.old 已删除
    ) else (
        echo   - 保留 Windows.old 文件夹
    )
) else (
    echo   - 未发现 Windows.old 文件夹
)

REM 清理浏览器缓存（可选）
echo.
echo [可选] 是否清理浏览器缓存？
set /p CLEAN_BROWSER="清理浏览器缓存？(Y/N，默认N): "
if /i "!CLEAN_BROWSER!"=="Y" (
    echo   正在清理浏览器缓存...
    
    if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache\*" (
        rd /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" >nul 2>&1
        echo     ✓ Chrome 缓存已清理
    )
    
    if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache\*" (
        rd /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" >nul 2>&1
        echo     ✓ Edge 缓存已清理
    )
)

REM 使用 Windows 磁盘清理工具
echo.
echo [高级] 运行 Windows 磁盘清理工具...
echo   正在启动磁盘清理工具（自动模式）...
cleanmgr /d C: /sagerun:1 >nul 2>&1
echo   ✓ 磁盘清理工具已完成

REM 显示清理后的磁盘空间
echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.

for /f "tokens=3" %%a in ('dir C:\ ^| find "可用字节"') do set AFTER=%%a
if defined AFTER (
    echo [清理后] C盘可用空间: %AFTER%
) else (
    echo 已清理完成，建议手动检查 C 盘可用空间
)

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 提示：
echo   - 如果空间仍然不足，可以：
echo     1. 卸载不需要的程序
echo     2. 移动大文件到其他磁盘
echo     3. 使用 Windows 自带的"存储感知"功能
echo     4. 检查并删除重复文件
echo.
pause








































