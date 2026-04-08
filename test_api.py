#!/usr/bin/env python3
"""gennai-llm-platform API テストスクリプト"""
import json
import time
import urllib.request
import subprocess
import sys

API_BASE = "https://8rfng424sk.execute-api.ap-northeast-1.amazonaws.com/v1"

MODELS = [
    {"route": "gpt-oss-20b", "name": "gpt-oss-20b"},
    {"route": "llama-3.1-70b-ja", "name": "llama-3.1-70b-ja"},
]


def get_api_key():
    return subprocess.check_output(
        ["aws", "apigateway", "get-api-key", "--api-key", "yci8mf34t8",
         "--include-value", "--query", "value", "--output", "text",
         "--region", "ap-northeast-1"],
        text=True,
    ).strip()


def call(api_key, route, model, prompt, max_tokens=100, stream=False):
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "stream": stream,
    }).encode()
    req = urllib.request.Request(
        f"{API_BASE}/{route}/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "x-api-key": api_key},
    )
    start = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read().decode()
    elapsed = time.time() - start

    if stream:
        lines = [l for l in data.split("\n") if l.startswith("data: ") and l != "data: [DONE]"]
        chunks = [json.loads(l[6:]) for l in lines]
        content = "".join(c["choices"][0]["delta"].get("content", "") or "" for c in chunks)
        reasoning = "".join(c["choices"][0]["delta"].get("reasoning", "") or "" for c in chunks)
        return {
            "content": content or None,
            "reasoning": reasoning or None,
            "text": content or reasoning or "(empty)",
            "elapsed": elapsed,
            "chunks": len(chunks),
        }
    else:
        parsed = json.loads(data)
        msg = parsed["choices"][0]["message"]
        content = msg.get("content")
        reasoning = msg.get("reasoning")
        tok = parsed.get("usage", {}).get("completion_tokens", 0)
        return {
            "content": content,
            "reasoning": reasoning,
            "text": content or reasoning or "(empty)",
            "elapsed": elapsed,
            "tokens": tok,
        }


def test_health(api_key):
    print("=" * 60)
    print("TEST: Health Check")
    print("=" * 60)
    req = urllib.request.Request(f"{API_BASE}/")
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    print(f"  Root: {data}")

    for m in MODELS:
        try:
            req = urllib.request.Request(
                f"{API_BASE}/{m['route']}/v1/models",
                headers={"x-api-key": api_key},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            print(f"  /{m['route']}: ✅ reachable ({len(data.get('data',[]))} model(s))")
        except urllib.error.HTTPError as e:
            print(f"  /{m['route']}: ❌ HTTP {e.code} (model may still be loading)")
        except Exception as e:
            print(f"  /{m['route']}: ❌ {e}")
    print()


def test_models_endpoint(api_key):
    print("=" * 60)
    print("TEST: /v1/models")
    print("=" * 60)
    for m in MODELS:
        try:
            req = urllib.request.Request(
                f"{API_BASE}/{m['route']}/v1/models",
                headers={"x-api-key": api_key},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            models = [d["id"] for d in data.get("data", [])]
            print(f"  /{m['route']}: {models}")
        except Exception as e:
            print(f"  /{m['route']}: ❌ {e}")
    print()


def test_chat(api_key):
    print("=" * 60)
    print("TEST: Chat Completions")
    print("=" * 60)
    prompt = "1+1は？数字だけ答えて。"
    for m in MODELS:
        try:
            r = call(api_key, m["route"], m["name"], prompt, max_tokens=256)
            src = "content" if r["content"] else "reasoning"
            print(f"  [{m['name']}] {r['text']!r}  ({r['elapsed']:.2f}s, {r['tokens']}tok, via {src})")
        except Exception as e:
            print(f"  [{m['name']}] ❌ {e}")
    print()


def test_stream(api_key):
    print("=" * 60)
    print("TEST: Streaming (SSE)")
    print("=" * 60)
    prompt = "「吾輩は猫である」の作者は？"
    for m in MODELS:
        try:
            r = call(api_key, m["route"], m["name"], prompt, max_tokens=256, stream=True)
            src = "content" if r["content"] else "reasoning"
            print(f"  [{m['name']}] {r['text'][:100]!r}  ({r['elapsed']:.2f}s, {r['chunks']} chunks, via {src})")
        except Exception as e:
            print(f"  [{m['name']}] ❌ {e}")
    print()


def test_japanese(api_key):
    print("=" * 60)
    print("TEST: Japanese Quality")
    print("=" * 60)
    prompt = "「五月雨を集めて早し最上川」この俳句の作者と季語を答えてください。"
    for m in MODELS:
        try:
            r = call(api_key, m["route"], m["name"], prompt, max_tokens=512)
            src = "content" if r["content"] else "reasoning"
            print(f"  [{m['name']}] ({r['elapsed']:.2f}s, via {src})")
            print(f"    {r['text'][:300]}")
        except Exception as e:
            print(f"  [{m['name']}] ❌ {e}")
    print()


def test_latency(api_key):
    print("=" * 60)
    print("TEST: Latency (3 runs)")
    print("=" * 60)
    prompt = "Hello"
    for m in MODELS:
        times = []
        for i in range(3):
            try:
                r = call(api_key, m["route"], m["name"], prompt, max_tokens=50)
                times.append(r["elapsed"])
            except Exception as e:
                times.append(-1)
        valid = [t for t in times if t > 0]
        avg = sum(valid) / len(valid) if valid else -1
        print(f"  [{m['name']}] {' / '.join(f'{t:.2f}s' for t in times)}  avg={avg:.2f}s")
    print()


if __name__ == "__main__":
    api_key = get_api_key()
    print(f"API Base: {API_BASE}")
    print(f"API Key:  {api_key[:8]}...{api_key[-4:]}")
    print()

    tests = [test_health, test_models_endpoint, test_chat, test_stream, test_japanese, test_latency]

    if len(sys.argv) > 1:
        name = sys.argv[1]
        matched = [t for t in tests if name in t.__name__]
        if matched:
            for t in matched:
                t(api_key)
        else:
            print(f"Unknown test: {name}")
            print(f"Available: {', '.join(t.__name__ for t in tests)}")
    else:
        for t in tests:
            try:
                t(api_key)
            except Exception as e:
                print(f"  ❌ Test failed: {e}\n")

    print("Done!")
