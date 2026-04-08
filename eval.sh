#!/bin/bash
set -euo pipefail

API_BASE="https://8rfng424sk.execute-api.ap-northeast-1.amazonaws.com/v1"
API_KEY=$(aws apigateway get-api-key --api-key yci8mf34t8 --include-value --query 'value' --output text --region ap-northeast-1)
OUTDIR="/tmp/ws/gennai-llm-platform/eval_results"
mkdir -p "$OUTDIR"

call_model() {
  local route="$1"
  local model_name="$2"
  local test_name="$3"
  local prompt="$4"
  local max_tokens="${5:-256}"
  local sys_prompt="${6:-You are a helpful assistant.}"

  local start_ms=$(date +%s%3N)
  local response
  response=$(curl -s --max-time 120 \
    "${API_BASE}/${route}/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -H "x-api-key: ${API_KEY}" \
    -d "$(jq -n \
      --arg model "$model_name" \
      --arg sys "$sys_prompt" \
      --arg user "$prompt" \
      --argjson max_tokens "$max_tokens" \
      '{model:$model,messages:[{role:"system",content:$sys},{role:"user",content:$user}],max_tokens:$max_tokens,temperature:0.3}'
    )" 2>&1)
  local end_ms=$(date +%s%3N)
  local latency=$(( end_ms - start_ms ))

  local content=$(echo "$response" | jq -r '.choices[0].message.content // "ERROR"' 2>/dev/null || echo "PARSE_ERROR")
  local prompt_tokens=$(echo "$response" | jq -r '.usage.prompt_tokens // 0' 2>/dev/null)
  local completion_tokens=$(echo "$response" | jq -r '.usage.completion_tokens // 0' 2>/dev/null)

  local outfile="${OUTDIR}/${test_name}_${model_name//\//_}.json"
  jq -n \
    --arg model "$model_name" \
    --arg test "$test_name" \
    --arg content "$content" \
    --argjson latency "$latency" \
    --argjson prompt_tokens "$prompt_tokens" \
    --argjson completion_tokens "$completion_tokens" \
    '{model:$model,test:$test,content:$content,latency_ms:$latency,prompt_tokens:$prompt_tokens,completion_tokens:$completion_tokens}' > "$outfile"

  echo "  [$model_name] $test_name: ${latency}ms, ${completion_tokens} tokens"
}

echo "=========================================="
echo " Multi-Model Evaluation"
echo "=========================================="

# --- Test 1: Japanese Knowledge ---
echo ""
echo "=== Test 1: Japanese Knowledge ==="
PROMPT_1="日本の三権分立について、それぞれの役割を簡潔に説明してください。"
call_model "gpt-oss-20b" "gpt-oss-20b" "01_ja_knowledge" "$PROMPT_1" 300
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "01_ja_knowledge" "$PROMPT_1" 300

# --- Test 2: English Knowledge ---
echo ""
echo "=== Test 2: English Knowledge ==="
PROMPT_2="Explain the difference between TCP and UDP protocols in networking. Be concise."
call_model "gpt-oss-20b" "gpt-oss-20b" "02_en_knowledge" "$PROMPT_2" 300
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "02_en_knowledge" "$PROMPT_2" 300

# --- Test 3: Logical Reasoning ---
echo ""
echo "=== Test 3: Logical Reasoning ==="
PROMPT_3="ある部屋に3つのスイッチがあります。それぞれが隣の部屋にある3つの電球のうち1つに対応しています。隣の部屋は見えません。部屋を1回だけ移動して、どのスイッチがどの電球に対応しているか確定するにはどうすればよいですか？"
call_model "gpt-oss-20b" "gpt-oss-20b" "03_reasoning" "$PROMPT_3" 500
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "03_reasoning" "$PROMPT_3" 500

# --- Test 4: Code Generation ---
echo ""
echo "=== Test 4: Code Generation ==="
PROMPT_4="Pythonで、与えられたリストから重複を除去しつつ元の順序を保持する関数を書いてください。型ヒント付きで、テストコードも含めてください。"
call_model "gpt-oss-20b" "gpt-oss-20b" "04_code" "$PROMPT_4" 500
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "04_code" "$PROMPT_4" 500

# --- Test 5: Creative Writing ---
echo ""
echo "=== Test 5: Creative Writing (Japanese) ==="
PROMPT_5="「AIと人間が共存する2050年の東京」をテーマに、100文字程度の短い物語を書いてください。"
call_model "gpt-oss-20b" "gpt-oss-20b" "05_creative" "$PROMPT_5" 300
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "05_creative" "$PROMPT_5" 300

# --- Test 6: Summarization ---
echo ""
echo "=== Test 6: Summarization ==="
PROMPT_6="以下の文章を3行で要約してください：
量子コンピュータは、量子力学の原理を利用して情報を処理するコンピュータです。従来のコンピュータがビット（0か1）を基本単位として使うのに対し、量子コンピュータは量子ビット（キュービット）を使い、重ね合わせやエンタングルメントといった量子現象を活用します。これにより、特定の問題においては従来のコンピュータを大幅に上回る計算速度を実現できる可能性があります。暗号解読、新薬開発、材料科学、最適化問題など、多くの分野で革命的な変化をもたらすと期待されています。しかし、現在の量子コンピュータはまだ発展途上であり、エラー率の高さやキュービットの安定性など、多くの技術的課題が残っています。"
call_model "gpt-oss-20b" "gpt-oss-20b" "06_summarize" "$PROMPT_6" 200
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "06_summarize" "$PROMPT_6" 200

# --- Test 7: Math ---
echo ""
echo "=== Test 7: Math ==="
PROMPT_7="ある店で、定価1000円の商品を20%引きで販売し、さらにその価格から10%のポイント還元をしています。実質的な支払額はいくらですか？計算過程も示してください。"
call_model "gpt-oss-20b" "gpt-oss-20b" "07_math" "$PROMPT_7" 300
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "07_math" "$PROMPT_7" 300

# --- Test 8: Instruction Following ---
echo ""
echo "=== Test 8: Instruction Following ==="
PROMPT_8="以下の条件をすべて満たす文章を1つ書いてください：
1. ちょうど3文で構成される
2. 各文は「実は」で始まる
3. 食べ物に関する内容である
4. 最後の文に数字を含む"
call_model "gpt-oss-20b" "gpt-oss-20b" "08_instruction" "$PROMPT_8" 200
call_model "llama-3.3-70b" "llama-3.1-70b-ja" "08_instruction" "$PROMPT_8" 200

echo ""
echo "=========================================="
echo " Evaluation Complete!"
echo "=========================================="
echo ""

# Generate summary
echo "=== Latency Summary ==="
for f in "$OUTDIR"/*.json; do
  echo "$(jq -r '[.model, .test, (.latency_ms|tostring)+"ms", (.completion_tokens|tostring)+"tok"] | join(" | ")' "$f")"
done | sort -t'|' -k2
