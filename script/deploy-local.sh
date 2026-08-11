#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"
forge script script/Deploy.s.sol --rpc-url "${RPC_URL:-http://127.0.0.1:8545}" --broadcast -vv
echo "Wrote deployments/local.json"
