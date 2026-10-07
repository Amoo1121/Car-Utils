#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。"
  exit 1
fi

docker compose --profile desktop stop
echo "Car Utils 已停止。SQLite 数据和 Docker volume 均已保留。"
