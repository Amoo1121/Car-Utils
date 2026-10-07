#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

read_env_value() {
  local key="$1"
  local fallback="$2"
  local value=""

  if [[ -f .env ]]; then
    value="$(sed -n "s/^${key}=//p" .env | head -n 1)"
    value="${value//[[:space:]]/}"
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
  fi

  print -r -- "${value:-$fallback}"
}

wait_for_docker() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  echo "Docker Desktop 尚未运行，正在启动..."
  open -a Docker

  local attempt
  for attempt in {1..60}; do
    if docker info >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done

  echo "等待 Docker Desktop 超时，请确认 Docker Desktop 可以正常启动。"
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。请先安装并启动 Docker Desktop。"
  exit 1
fi

echo "正在启动 Car Utils 后台服务..."
wait_for_docker
docker compose --profile desktop up -d --build --wait

APP_PORT="$(read_env_value CAR_UTILS_APP_PORT 4173)"
APP_URL="http://localhost:${APP_PORT}/"

echo "Car Utils 已在后台运行：${APP_URL}"
echo "现在可以关闭这个 Terminal 窗口。"
open "$APP_URL"
