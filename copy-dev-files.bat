@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "sourceDir=D:\storyforge-ai"
set "targetDir=D:\storyforge-ai-dev"

echo ========================================
echo   StoryForge AI - 复制开发文件
echo ========================================
echo.

REM 删除目标目录（如果存在）
if exist "%targetDir%" (
    echo [清理] 删除现有目标目录...
    rmdir /s /q "%targetDir%"
)

REM 创建目标目录结构
echo [创建] 创建新目录结构...
mkdir "%targetDir%"
mkdir "%targetDir%\components"
mkdir "%targetDir%\services"
mkdir "%targetDir%\electron"
mkdir "%targetDir%\data"
echo.

REM 1. 复制源代码文件
echo [复制] 源代码文件...
copy /Y "%sourceDir%\App.tsx" "%targetDir%\" >nul
copy /Y "%sourceDir%\index.tsx" "%targetDir%\" >nul
copy /Y "%sourceDir%\index.html" "%targetDir%\" >nul
copy /Y "%sourceDir%\index.css" "%targetDir%\" >nul
copy /Y "%sourceDir%\types.ts" "%targetDir%\" >nul
copy /Y "%sourceDir%\defaultContent.ts" "%targetDir%\" >nul
echo   ✓ 源代码文件已复制
echo.

REM 2. 复制目录
echo [复制] 组件目录...
xcopy /E /I /Y "%sourceDir%\components\*" "%targetDir%\components\" >nul
echo   ✓ components/ 已复制

echo [复制] 服务目录...
xcopy /E /I /Y "%sourceDir%\services\*" "%targetDir%\services\" >nul
echo   ✓ services/ 已复制

echo [复制] Electron目录...
xcopy /E /I /Y "%sourceDir%\electron\*" "%targetDir%\electron\" >nul
echo   ✓ electron/ 已复制

echo [复制] 数据目录（示例数据）...
xcopy /E /I /Y "%sourceDir%\data\*" "%targetDir%\data\" >nul
echo   ✓ data/ 已复制
echo.

REM 3. 复制配置文件
echo [复制] 配置文件...
copy /Y "%sourceDir%\package.json" "%targetDir%\" >nul
copy /Y "%sourceDir%\package-lock.json" "%targetDir%\" >nul
copy /Y "%sourceDir%\tsconfig.json" "%targetDir%\" >nul
copy /Y "%sourceDir%\vite.config.ts" "%targetDir%\" >nul
copy /Y "%sourceDir%\postcss.config.js" "%targetDir%\" >nul
echo   ✓ 配置文件已复制
echo.

REM 4. 复制开发服务器文件
echo [复制] 开发服务器文件...
copy /Y "%sourceDir%\data-server.js" "%targetDir%\" >nul
copy /Y "%sourceDir%\proxy-server.js" "%targetDir%\" >nul
copy /Y "%sourceDir%\electron-dev.js" "%targetDir%\" >nul
echo   ✓ 服务器文件已复制
echo.

REM 5. 复制必要的文档
echo [复制] 开发文档...
if exist "%sourceDir%\README.md" copy /Y "%sourceDir%\README.md" "%targetDir%\" >nul
if exist "%sourceDir%\FunctionCalling格式保证机制说明.md" copy /Y "%sourceDir%\FunctionCalling格式保证机制说明.md" "%targetDir%\" >nul
if exist "%sourceDir%\工具调用机制说明.md" copy /Y "%sourceDir%\工具调用机制说明.md" "%targetDir%\" >nul
echo   ✓ 文档已复制
echo.

REM 6. 复制 .gitignore（如果存在）
echo [复制] Git配置文件...
if exist "%sourceDir%\.gitignore" copy /Y "%sourceDir%\.gitignore" "%targetDir%\" >nul
echo   ✓ Git配置文件已复制
echo.

REM 7. 创建简单的启动脚本
echo [创建] 开发启动脚本...
(
echo @echo off
echo chcp 65001 ^>nul
echo title StoryForge AI - 开发服务器
echo.
echo echo ========================================
echo echo   StoryForge AI - 开发服务器
echo echo ========================================
echo echo.
echo echo 正在启动开发服务器...
echo echo 服务器地址: http://localhost:3000
echo echo.
echo echo 按 Ctrl+C 可以停止服务器
echo echo ========================================
echo echo.
echo.
echo npm run dev
echo.
echo pause
) > "%targetDir%\启动开发服务器.bat"
echo   ✓ 启动开发服务器.bat 已创建
echo.

REM 8. 创建 README 说明文件
echo [创建] 开发目录说明文件...
(
echo # StoryForge AI - 开发目录
echo.
echo 这是项目的开发版本，仅包含开发必需的文件。
echo.
echo ## 📁 目录结构
echo.
echo - `components/` - React 组件
echo - `services/` - 服务层代码
echo - `electron/` - Electron 桌面应用代码
echo - `data/` - 示例数据和配置
echo - `*.tsx`, `*.ts` - TypeScript 源代码文件
echo.
echo ## 🚀 快速开始
echo.
echo 1. 安装依赖：
echo    ```bash
echo    npm install
echo    ```
echo.
echo 2. 启动开发服务器：
echo    ```bash
echo    npm run dev
echo    ```
echo    或运行批处理文件：
echo    ```bash
echo    启动开发服务器.bat
echo    ```
echo.
echo 3. 在浏览器中访问: http://localhost:3000
echo.
echo ## 📝 说明
echo.
echo 此目录仅包含开发必需的文件，已排除：
echo - 打包和分发相关文件（dist/, release/, 分发版目录）
echo - 用户数据（我的故事库/）
echo - 临时文件和调试脚本
echo - 打包相关文档和批处理文件
echo.
echo ## 🔧 开发命令
echo.
echo - `npm run dev` - 启动开发服务器
echo - `npm run build` - 构建生产版本
echo - `npm run electron:dev` - 启动 Electron 开发模式
) > "%targetDir%\README_开发目录.md"
echo   ✓ README_开发目录.md 已创建
echo.

echo ========================================
echo   ✅ 复制完成！
echo ========================================
echo.
echo 目标目录: %targetDir%
echo.
echo 下一步：
echo 1. 进入新目录: cd %targetDir%
echo 2. 安装依赖: npm install
echo 3. 启动开发服务器: npm run dev
echo.
pause















