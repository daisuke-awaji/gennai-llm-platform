# gennai-llm-platform

PoC: API Gateway (REST, Response Streaming) + EC2 (vLLM) で複数モデルの OpenAI 互換 LLM エンドポイントを構築する。
API Gateway のルートでモデルを切り替える。

## アーキテクチャ

```
Client / 源内
  │  HTTPS + API Key
  ▼
REST API Gateway (Regional, Response Streaming)
  │
  ├── /gpt-oss-20b/{proxy+}      → VPC Link → NLB :80   → EC2 g7e.4xlarge  (gpt-oss-20b)
  └── /llama-3.1-70b-ja/{proxy+} → VPC Link → NLB :8080 → EC2 g7e.12xlarge (Llama-3.1-70B-Japanese, TP=2)
```

## 使用モデル

| モデル | インスタンス | GPU | VRAM | 備考 |
|---|---|---|---|---|
| openai/gpt-oss-20b | g7e.4xlarge | 1× RTX PRO 6000 | 96 GB | 21B (MoE, Active ~3.6B), MXFP4 |
| cyberagent/Llama-3.1-70B-Japanese-Instruct-2407 | g7e.12xlarge | 2× RTX PRO 6000 | 192 GB | 70B, BF16, tensor-parallel-size=2, 日本語特化 |

## デプロイ

```bash
cd infra
npm install
npx cdk deploy
```

## テスト

```bash
# API Key を取得
API_KEY=$(aws apigateway get-api-key --api-key <API_KEY_ID> --include-value --query 'value' --output text)

# gpt-oss-20b (SSE Streaming)
curl -N https://<API_ID>.execute-api.<REGION>.amazonaws.com/v1/gpt-oss-20b/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${API_KEY}" \
  -d '{"model":"gpt-oss-20b","messages":[{"role":"user","content":"Hello, world!"}],"stream":true}'

# Llama-3.1-70B-Japanese (SSE Streaming)
curl -N https://<API_ID>.execute-api.<REGION>.amazonaws.com/v1/llama-3.1-70b-ja/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${API_KEY}" \
  -d '{"model":"llama-3.1-70b-ja","messages":[{"role":"user","content":"Hello, world!"}],"stream":true}'
```

## クリーンアップ

```bash
cd infra
npx cdk destroy
```
