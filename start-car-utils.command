#!/bin/zsh
# 双击打开 Car Utils。首次运行会自动安装为后台服务并创建 ~/Applications/Car Utils.app，
# 之后可以直接从 Launchpad / Spotlight 打开「Car Utils」，不再需要这个文件。

set -euo pipefail
cd "${0:A:h}"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 22 或更高版本：https://nodejs.org/"
  read -k1 "?按任意键关闭…"
  exit 1
fi

if [[ -f "$HOME/Library/LaunchAgents/com.carutils.server.plist" ]]; then
  node --no-warnings scripts/car-utils.mjs launch
else
  echo "首次启动：正在安装 Car Utils（约 1 分钟）…"
  npm run setup
fi

echo "\nCar Utils 已在后台运行，可以关闭这个窗口。"
