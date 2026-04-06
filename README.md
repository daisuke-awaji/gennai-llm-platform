# gennai-llm-platform

PoC: API Gateway (REST, Response Streaming) + EC2 (vLLM) で OpenAI 互換 LLM エンドポイントを構築する。

## アーキテクチャ

```
Client / 源内
  │  HTTPS + API Key
  ▼
REST API Gateway (Regional, Response Streaming)
  │  HTTP_PROXY via VPC Link
  ▼
NLB (Internal)
  │
  ▼
EC2 g5.xlarge (Private Subnet)
  vLLM serve openai/gpt-oss-20b
```

## 使用モデル

- **openai/gpt-oss-20b**: 21B パラメータ (MoE, Active ~3.6B), MXFP4 量子化, VRAM ~16 GB
- vLLM でネイティブサポート、OpenAI 互換 API を提供

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

# Chat Completions (SSE Streaming)
curl -N https://<API_ID>.execute-api.<REGION>.amazonaws.com/v1/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${API_KEY}" \
  -d '{"model":"gpt-oss-20b","messages":[{"role":"user","content":"Hello, world!"}],"stream":true}'
```

## クリーンアップ

```bash
cd infra
npx cdk destroy
```
