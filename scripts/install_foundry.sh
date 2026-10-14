#!/usr/bin/env bash
set -euo pipefail

# Installa Foundry (forge & cast) in modo idempotente.
# Uso: ./scripts/install_foundry.sh

if command -v forge >/dev/null 2>&1; then
  echo "Foundry gia' installato:"
  forge --version || true
  exit 0
fi

curl -L https://foundry.paradigm.xyz | bash

if [ -f "$HOME/.bashrc" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.bashrc"
fi
if [ -f "$HOME/.profile" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.profile"
fi
if [ -f "$HOME/.zshrc" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.zshrc"
fi

export PATH="$HOME/.foundry/bin:$PATH"
foundryup

export PATH="$HOME/.foundry/bin:$PATH"
echo "Foundry installato:"
forge --version
