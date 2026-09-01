@echo off
chcp 65001 >nul
title 11选5 杀号分析终端

REM 设置便携版 Node.js 路径（根据实际位置修改）
set "PATH=D:\聚宝盆;%PATH%"

REM 检查 node 是否可用
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 找不到 Node.js，请确认 D:\聚宝盆\node.exe 存在
    echo 如果路径不同，请编辑本文件修改 PATH 设置
    pause
    exit /b 1
)

echo ============================================
echo   11选5 杀号分析终端 - 一键启动
echo ============================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查是否安装过依赖
if not exist "node_modules" (
    echo [首次运行] 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [启动] 前端 + 后端开发服务器...
echo [访问] http://localhost:5173/
echo.

REM 打开浏览器（延迟几秒）
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173/"

REM 启动服务
call npm run dev
