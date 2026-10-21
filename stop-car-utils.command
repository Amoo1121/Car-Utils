#!/bin/zsh
# 停止 Car Utils 后台服务。数据保留在 ~/Library/Application Support/Car Utils。

set -euo pipefail
cd "${0:A:h}"
node --no-warnings scripts/car-utils.mjs stop
