#!/bin/bash

# 获取脚本所在目录，确保在任何地方运行都能找到文件
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo " ShengMo 启动脚本 (Termux 严厉版)"
echo "===================================================================="
echo ""

export PYTHONIOENCODING=utf-8

# ----------------------------------------------------------------
# 第一步：检查 Python 环境并安装依赖
# ----------------------------------------------------------------
echo "[1/3] 正在检查 Python 环境..."

if ! command -v python &> /dev/null; then
    echo ""
    echo "[FATAL] 未找到 Python 环境，请先在 Termux 中执行 pkg install python"
    exit 1
fi

python -c "import flask" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Python 依赖已就绪 (跳过检查)"
else
    echo "检测到 Python 依赖缺失，正在安装..."
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    if [ $? -ne 0 ]; then
        echo ""
        echo "[FATAL] Python 依赖安装失败。"
        exit 1
    fi
fi
echo ""

# ----------------------------------------------------------------
# 第二步：检查 Node.js 环境
# ----------------------------------------------------------------
echo "[2/3] 正在检查 Node.js 环境..."
if ! command -v npm &> /dev/null
then
    echo ""
    echo "[FATAL] 未找到 npm 命令。"
    echo "请先在 Termux 中执行 pkg install nodejs-lts"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "检测到首次运行，正在安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "[FATAL] 前端依赖 'npm install' 失败。"
        exit 1
    fi
    echo "前端依赖安装成功。"
else
    echo "前端依赖已就绪。"
fi
echo ""

# ----------------------------------------------------------------
# 第三步：启动服务
# ----------------------------------------------------------------
echo "[3/3] 一切就绪！正在启动服务..."
echo "按 Ctrl+C 可以停止服务。"
echo ""

npm start