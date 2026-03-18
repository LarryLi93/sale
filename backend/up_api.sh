#!/bin/bash

# 查找并杀死占用端口的进程
PORT=8012

# 检查lsof命令是否存在
if ! command -v lsof &> /dev/null; then
    echo "错误：lsof 命令未找到，请先安装 lsof"
    echo "Ubuntu/Debian: sudo apt-get install lsof"
    echo "CentOS/RHEL: sudo yum install lsof"
    exit 1
fi

# 查找占用端口的PID
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
    echo "端口 $PORT 当前没有被任何进程占用"
    echo -e "\n正在启动新API服务"
    nohup python product_search_api.py > product_search_api.log 2>&1 &
    exit 0
fi

echo "找到占用端口 $PORT 的进程:"
lsof -i:$PORT

echo -e "\n正在终止进程(PID): $PID"
kill -9 $PID

echo -e "\n正在启动新API服务"
nohup python product_search_api.py > product_search_api.log 2>&1 &





