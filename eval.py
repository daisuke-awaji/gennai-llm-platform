#!/usr/bin/env python3
import json, subprocess, time, urllib.request, urllib.error, os

API_BASE = "https://8rfng424sk.execute-api.ap-northeast-1.amazonaws.com/v1"
API_KEY = subprocess.check_output(
    ["aws", "apigateway", "get-api-key", "--api-key", "yci8mf34t8",
     "--include-value", "--query", "value", "--output", "text",
     "--region", "ap-northeast-1"],
    text=True
).strip()

MODELS = [
    {"route": "gpt-oss-20b", "name": "gpt-oss-20b", "label": "gpt-oss-20b (g7e.4xlarge)"},
    {"route": "llama-3.3-70b", "name": "llama-3.1-70b-ja", "label": "llama-3.1-70b-ja (g7e.12xlarge)"},
]

TESTS = [
    {
        "id": "01_ja_knowledge", "category": "日本語知識",
        "prompt": "日本の三権分立について、それぞれの役割を簡潔に説明してください。",
        "max_tokens": 300,
    },
    {
        "id": "02_en_knowledge", "category": "英語知識",
        "prompt": "Explain the difference between TCP and UDP protocols in networking. Be concise.",
        "max_tokens": 300,
    },
    {
        "id": "03_reasoning", "category": "論理的推論",
        "prompt": "ある部屋に3つのスイッチがあります。それぞれが隣の部屋にある3つの電球のうち1つに対応しています。隣の部屋は見えません。部屋を1回だけ移動して、どのスイッチがどの電球に対応しているか確定するにはどうすればよいですか？",
        "max_tokens": 500,
    },
    {
        "id": "04_code", "category": "コード生成",
        "prompt": "Pythonで、与えられたリストから重複を除去しつつ元の順序を保持する関数を書いてください。型ヒント付きで、テストコードも含めてください。",
        "max_tokens": 500,
    },
    {
        "id": "05_creative", "category": "創作（日本語）",
        "prompt": "「AIと人間が共存する2050年の東京」をテーマに、100文字程度の短い物語を書いてください。",
        "max_tokens": 300,
    },
    {
        "id": "06_summarize", "category": "要約",
        "prompt": "以下の文章を3行で要約してください：\n量子コンピュータは、量子力学の原理を利用して情報を処理するコンピュータです。従来のコンピュータがビット（0か1）を基本単位として使うのに対し、量子コンピュータは量子ビット（キュービット）を使い、重ね合わせやエンタングルメントといった量子現象を活用します。これにより、特定の問題においては従来のコンピュータを大幅に上回る計算速度を実現できる可能性があります。暗号解読、新薬開発、材料科学、最適化問題など、多くの分野で革命的な変化をもたらすと期待されています。しかし、現在の量子コンピュータはまだ発展途上であり、エラー率の高さやキュービットの安定性など、多くの技術的課題が残っています。",
        "max_tokens": 200,
    },
    {
        "id": "07_math", "category": "数学",
        "prompt": "ある店で、定価1000円の商品を20%引きで販売し、さらにその価格から10%のポイント還元をしています。実質的な支払額はいくらですか？計算過程も示してください。",
        "max_tokens": 300,
    },
    {
        "id": "08_instruction", "category": "指示追従",
        "prompt": "以下の条件をすべて満たす文章を1つ書いてください：\n1. ちょうど3文で構成される\n2. 各文は「実は」で始まる\n3. 食べ物に関する内容である\n4. 最後の文に数字を含む",
        "max_tokens": 200,
    },
]


def call_model(route, model_name, prompt, max_tokens=256):
    body = json.dumps({
        "model": model_name,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(
        f"{API_BASE}/{route}/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
    )
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return {"content": f"ERROR: {e}", "latency_ms": 0, "prompt_tokens": 0, "completion_tokens": 0}
    latency = int((time.time() - start) * 1000)
    return {
        "content": data["choices"][0]["message"]["content"],
        "latency_ms": latency,
        "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
        "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
    }


results = []
for test in TESTS:
    print(f"\n=== {test['id']}: {test['category']} ===")
    for model in MODELS:
        r = call_model(model["route"], model["name"], test["prompt"], test["max_tokens"])
        r["model"] = model["label"]
        r["test_id"] = test["id"]
        r["category"] = test["category"]
        results.append(r)
        tps = r["completion_tokens"] / (r["latency_ms"] / 1000) if r["latency_ms"] > 0 else 0
        print(f"  [{model['label']}] {r['latency_ms']}ms, {r['completion_tokens']}tok, {tps:.1f}tok/s")

# Save raw results
with open("/tmp/ws/gennai-llm-platform/eval_results.json", "w") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# Build markdown report
report = []
report.append("# モデル評価レポート\n")
report.append(f"**評価日時**: {time.strftime('%Y-%m-%d %H:%M UTC')}\n")
report.append("| モデル | インスタンス | GPU | VRAM |")
report.append("|---|---|---|---|")
report.append("| gpt-oss-20b | g7e.4xlarge | 1× RTX PRO 6000 | 96 GB |")
report.append("| llama-3.1-70b-ja | g7e.12xlarge | 2× RTX PRO 6000 | 192 GB |")
report.append("")

# Latency/throughput summary table
report.append("## パフォーマンスサマリー\n")
report.append("| テスト | カテゴリ | gpt-oss-20b レイテンシ | gpt-oss-20b tok/s | llama-3.1-70b-ja レイテンシ | llama-3.1-70b-ja tok/s |")
report.append("|---|---|---|---|---|---|")

for test in TESTS:
    row_data = {}
    for r in results:
        if r["test_id"] == test["id"]:
            tps = r["completion_tokens"] / (r["latency_ms"] / 1000) if r["latency_ms"] > 0 else 0
            row_data[r["model"]] = (r["latency_ms"], f"{tps:.1f}")
    gpt = row_data.get("gpt-oss-20b (g7e.4xlarge)", (0, "0"))
    llama = row_data.get("llama-3.1-70b-ja (g7e.12xlarge)", (0, "0"))
    report.append(f"| {test['id']} | {test['category']} | {gpt[0]}ms | {gpt[1]} | {llama[0]}ms | {llama[1]} |")

report.append("")

# Per-test detailed comparison
for test in TESTS:
    report.append(f"---\n## {test['id']}: {test['category']}\n")
    report.append(f"**プロンプト**: {test['prompt'][:100]}{'...' if len(test['prompt'])>100 else ''}\n")
    for r in results:
        if r["test_id"] == test["id"]:
            tps = r["completion_tokens"] / (r["latency_ms"] / 1000) if r["latency_ms"] > 0 else 0
            report.append(f"### {r['model']}")
            report.append(f"- レイテンシ: {r['latency_ms']}ms | トークン: {r['completion_tokens']} | スループット: {tps:.1f} tok/s\n")
            report.append(f"```\n{r['content']}\n```\n")

md = "\n".join(report)
with open("/tmp/ws/gennai-llm-platform/eval_report.md", "w") as f:
    f.write(md)

print("\n✅ Report saved to eval_report.md")
