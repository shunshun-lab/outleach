#!/bin/bash
# 個人情報の誤コミットを検知する

# stdinからJSONを受け取る（Claude Codeがtool_inputを渡す）
INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('path',''))" 2>/dev/null)

if [ -z "$FILE" ]; then
  exit 0
fi

# .envファイルや data/ 配下への書き込みを警告
if echo "$FILE" | grep -qE '\.env|/data/|secrets'; then
  echo "⚠️  WARNING: 個人情報・シークレットを含む可能性のあるファイルへの書き込みです: $FILE"
  echo "   .gitignore に含まれていることを確認してください。"
fi

# console.log に個人情報っぽいキーワードが含まれていないかチェック
if [ -f "$FILE" ]; then
  if grep -n "console.log" "$FILE" | grep -qiE "email|phone|address|name|token"; then
    echo "⚠️  WARNING: console.log に個人情報が含まれている可能性があります: $FILE"
    grep -n "console.log" "$FILE" | grep -iE "email|phone|address|name|token"
  fi
fi
