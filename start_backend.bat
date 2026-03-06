@echo off
@chcp 65001 >nul
setlocal enabledelayedexpansion
title ShengMo 一键启动

echo ====================================================================
echo  绳墨 (ShengMo) 极速启动脚本 - 严厉版
echo ====================================================================
echo.

set PYTHONIOENCODING=utf-8
set PYTHON_CMD=

REM ----------------------------------------------------------------
REM 第一步：检测 Python 环境
REM ----------------------------------------------------------------
python --version >nul 2>&1
if !errorlevel! equ 0 (
    set PYTHON_CMD=python
    goto :CheckMarker
)
py --version >nul 2>&1
if !errorlevel! equ 0 (
    set PYTHON_CMD=py
    goto :CheckMarker
)

echo [FATAL] 未找到 Python，请先安装 Python！
pause
exit /b 1

:CheckMarker
REM --- 检查 Python 锁文件 ---
if exist "installed.lock" (
    echo [1/3] Python 环境已就绪 (跳过检查)
    goto :CheckNode
)

echo [1/3] 首次运行，正在安装依赖库...
!PYTHON_CMD! -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

if !errorlevel! neq 0 (
    echo [FATAL] Python 依赖安装失败。
    pause
    exit /b 1
) else (
    echo done > installed.lock
    echo Python 依赖安装完成。
)
echo.

:CheckNode
REM ----------------------------------------------------------------
REM 第二步：检测 Node.js 环境
REM ----------------------------------------------------------------
if exist "node_modules" (
    echo [2/3] 前端环境已就绪 (跳过检查)
    goto :StartApp
)

echo [2/3] 正在安装前端依赖...
call npm install
if !errorlevel! neq 0 (
    echo [FATAL] 前端依赖安装失败。
    pause
    exit /b 1
)
echo.

:StartApp
REM ----------------------------------------------------------------
REM 第三步：启动服务
REM ----------------------------------------------------------------
echo [3/3] 一切就绪！正在启动服务...
echo.

call npm start