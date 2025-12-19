@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title StoryForge AI - C盘垃圾清理工具

echo ========================================
echo   C盘垃圾清理工具
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
echo [1/7] 清理 Windows 临时文件...
if exist "%TEMP%\*" (
    del /f /s /q "%TEMP%\*" >nul 2>&1
    echo   ✓ 已清理用户临时文件
) else (
    echo   - 用户临时文件目录为空
)

if exist "C:\Windows\Temp\*" (
    del /f /s /q "C:\Windows\Temp\*" >nul 2>&1
    echo   ✓ 已清理系统临时文件
) else (
    echo   - 系统临时文件目录为空
)

REM 2. 清理用户临时文件
echo [2/7] 清理用户临时文件...
if exist "%USERPROFILE%\AppData\Local\Temp\*" (
    del /f /s /q "%USERPROFILE%\AppData\Local\Temp\*" >nul 2>&1
    echo   ✓ 已清理用户本地临时文件
) else (
    echo   - 用户本地临时文件目录为空
)

REM 3. 清理 npm 缓存
echo [3/7] 清理 npm 缓存...
if exist "%APPDATA%\npm-cache" (
    rd /s /q "%APPDATA%\npm-cache" >nul 2>&1
    echo   ✓ 已清理 npm 缓存
) else (
    echo   - npm 缓存目录不存在
)

REM 使用 npm 命令清理缓存（如果 npm 可用）
where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo   正在使用 npm 清理缓存...
    call npm cache clean --force >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ✓ npm 缓存已清理
    )
)

REM 4. 清理回收站
echo [4/7] 清理回收站...
rd /s /q "C:\$Recycle.Bin" >nul 2>&1
echo   ✓ 回收站已清空

REM 5. 清理系统日志文件
echo [5/7] 清理系统日志文件...
if exist "C:\Windows\Logs\*" (
    del /f /s /q "C:\Windows\Logs\*" >nul 2>&1
    echo   ✓ 已清理系统日志文件
) else (
    echo   - 系统日志文件目录为空
)

REM 6. 清理预读取文件
echo [6/7] 清理预读取文件...
if exist "C:\Windows\Prefetch\*" (
    del /f /q "C:\Windows\Prefetch\*" >nul 2>&1
    echo   ✓ 已清理预读取文件
) else (
    echo   - 预读取文件目录为空
)

REM 7. 清理 Windows 更新缓存
echo [7/7] 清理 Windows 更新缓存...
if exist "C:\Windows\SoftwareDistribution\Download\*" (
    del /f /s /q "C:\Windows\SoftwareDistribution\Download\*" >nul 2>&1
    echo   ✓ 已清理 Windows 更新缓存
) else (
    echo   - Windows 更新缓存目录为空
)

REM 清理 Windows 更新临时文件
if exist "C:\Windows\Temp\*.tmp" (
    del /f /q "C:\Windows\Temp\*.tmp" >nul 2>&1
)

REM 清理浏览器缓存（可选，谨慎使用）
echo.
echo [可选] 是否清理浏览器缓存？
echo   注意：清理后需要重新登录网站
set /p CLEAN_BROWSER="清理浏览器缓存？(Y/N，默认N): "
if /i "!CLEAN_BROWSER!"=="Y" (
    echo   正在清理浏览器缓存...
    
    REM Chrome 缓存
    if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache\*" (
        rd /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" >nul 2>&1
        echo     ✓ Chrome 缓存已清理
    )
    
    REM Edge 缓存
    if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache\*" (
        rd /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" >nul 2>&1
        echo     ✓ Edge 缓存已清理
    )
    
    REM Firefox 缓存
    if exist "%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*\cache2\*" (
        for /d %%d in ("%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*\cache2") do (
            rd /s /q "%%d" >nul 2>&1
        )
        echo     ✓ Firefox 缓存已清理
    )
) else (
    echo   - 跳过浏览器缓存清理
)

REM 使用 Windows 磁盘清理工具（需要管理员权限）
echo.
echo [高级] 是否运行 Windows 磁盘清理工具？
echo   注意：需要管理员权限，可能需要较长时间
set /p RUN_CLEANUP="运行磁盘清理工具？(Y/N，默认N): "
if /i "!RUN_CLEANUP!"=="Y" (
    echo   正在启动磁盘清理工具...
    start /wait cleanmgr /d C: /sagerun:1 >nul 2>&1
    echo   ✓ 磁盘清理工具已完成
) else (
    echo   - 跳过磁盘清理工具
)

REM 显示清理后的磁盘空间
echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.

REM 尝试获取清理后的磁盘空间（可能需要管理员权限）
for /f "tokens=3" %%a in ('dir C:\ ^| find "可用字节"') do set AFTER=%%a
if defined AFTER (
    echo [清理后] C盘可用空间: %AFTER%
    echo.
    echo 已释放空间，建议重启计算机以确保所有文件已完全删除
) else (
    echo 无法获取磁盘空间信息（可能需要管理员权限）
    echo 建议手动检查 C 盘可用空间
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
echo.
pause








































