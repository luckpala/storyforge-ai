@echo off
chcp 65001 >nul
title 配置防火墙 - 允许数据服务器

echo ========================================
echo   配置 Windows 防火墙
echo   允许端口 8765 (数据服务器)
echo ========================================
echo.
echo 此操作需要管理员权限
echo.
echo 正在检查管理员权限...

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ❌ 错误：需要管理员权限
    echo.
    echo 请右键点击此文件，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo ✅ 已获得管理员权限
echo.

REM 检查是否已存在规则
netsh advfirewall firewall show rule name="StoryForge 数据服务器" >nul 2>&1
if %errorLevel% equ 0 (
    echo 发现已存在的防火墙规则，正在删除...
    netsh advfirewall firewall delete rule name="StoryForge 数据服务器" >nul 2>&1
)

echo.
echo 正在添加防火墙规则...
echo.

REM 添加入站规则，允许 TCP 端口 8765
netsh advfirewall firewall add rule name="StoryForge 数据服务器" dir=in action=allow protocol=TCP localport=8765

if %errorLevel% equ 0 (
    echo.
    echo ✅ 防火墙规则已成功添加！
    echo.
    echo 规则详情：
    echo   - 名称: StoryForge 数据服务器
    echo   - 协议: TCP
    echo   - 端口: 8765
    echo   - 方向: 入站
    echo   - 操作: 允许
    echo.
    echo 现在手机应该可以访问数据服务器了
    echo.
) else (
    echo.
    echo ❌ 错误：无法添加防火墙规则
    echo.
)

pause








































