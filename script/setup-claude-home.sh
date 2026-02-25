#!/usr/bin/env bash
# Replit 起動時に ~/.claude をワークスペース内に置き、Claude Code のプラグイン等を永続化する。
# ワークスペースは Replit により保存されるため、~/.claude をその中へシンボリックリンクする。

set -e
WORKSPACE="${WORKSPACE:-/home/runner/workspace}"
CLAUDE_USER_DIR="$WORKSPACE/.claude-user"
HOME_CLAUDE="$HOME/.claude"

mkdir -p "$CLAUDE_USER_DIR"

if [ -L "$HOME_CLAUDE" ]; then
  # 既に .claude-user へのリンクなら何もしない
  if [ "$(readlink -f "$HOME_CLAUDE")" = "$(readlink -f "$CLAUDE_USER_DIR")" ]; then
    exit 0
  fi
  rm -f "$HOME_CLAUDE"
elif [ -d "$HOME_CLAUDE" ]; then
  # 既存の ~/.claude の中身を .claude-user に移してからリンクに差し替え
  if [ ! -d "$CLAUDE_USER_DIR/plugins" ] && [ -d "$HOME_CLAUDE/plugins" ]; then
    cp -a "$HOME_CLAUDE/plugins" "$CLAUDE_USER_DIR/" 2>/dev/null || true
  fi
  rm -rf "$HOME_CLAUDE"
fi

ln -sfn "$CLAUDE_USER_DIR" "$HOME_CLAUDE"
