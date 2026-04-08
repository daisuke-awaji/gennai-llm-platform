# モデル評価レポート

**評価日時**: 2026-04-08 04:36 UTC

| モデル | インスタンス | GPU | VRAM |
|---|---|---|---|
| gpt-oss-20b | g7e.4xlarge | 1× RTX PRO 6000 | 96 GB |
| llama-3.1-70b-ja | g7e.12xlarge | 2× RTX PRO 6000 | 192 GB |

## パフォーマンスサマリー

| テスト | カテゴリ | gpt-oss-20b レイテンシ | gpt-oss-20b tok/s | llama-3.1-70b-ja レイテンシ | llama-3.1-70b-ja tok/s |
|---|---|---|---|---|---|
| 01_ja_knowledge | 日本語知識 | 1343ms | 223.4 | 13075ms | 19.8 |
| 02_en_knowledge | 英語知識 | 1046ms | 220.8 | 9252ms | 19.8 |
| 03_reasoning | 論理的推論 | 2264ms | 220.8 | 14703ms | 19.9 |
| 04_code | コード生成 | 2178ms | 229.6 | 20110ms | 19.8 |
| 05_creative | 創作（日本語） | 1335ms | 224.7 | 7869ms | 19.8 |
| 06_summarize | 要約 | 909ms | 220.0 | 10101ms | 19.8 |
| 07_math | 数学 | 1330ms | 225.6 | 8625ms | 19.8 |
| 08_instruction | 指示追従 | 914ms | 218.8 | 4829ms | 19.7 |

---
## 01_ja_knowledge: 日本語知識

**プロンプト**: 日本の三権分立について、それぞれの役割を簡潔に説明してください。

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 1343ms | トークン: 300 | スループット: 223.4 tok/s

```
**日本の三権分立（立法・行政・司法）の役割（簡潔）**

| 権力 | 主な役割 |
|------|----------|
| **立法（国会）** | 法律を制定・改正し、国の政策方針を決定。議員が国民の代表として意思決定を行う。 |
| **行政（内閣・各省庁）** | 立法で定められた法律を実施し、行政サービスを提供。政策の実行と国の運営を担う。 |
| **司法（裁判所）** | 法律の解釈・適用を行い、紛争を解決。権力の濫用を防ぎ、法の支配を守る。 |

**チェック・バランス**
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 13075ms | トークン: 259 | スループット: 19.8 tok/s

```
日本の三権分立は、国家権力を三つの機関に分立し、相互に抑制し合うことで権力の濫用を防ぐ制度です。三権分立のそれぞれの役割は以下の通りです。

1.  立法権（国会）：法律を作る権限を持ちます。国会は衆議院と参議院の二院制で構成され、法律の制定や改正を行います。
2.  行政権（内閣）：法律を執行する権限を持ちます。内閣は総理大臣と国務大臣で構成され、国の行政を担当します。
3.  司法権（最高裁判所）：法律の解釈や適用を担う権限を持ちます。最高裁判所は最高裁判所長官と最高裁判所判事で構成され、法律の違憲性や解釈を判断します。

これらの三権はそれぞれ独立し、相互に抑制し合うことで、権力のバランスを保ち、国民の権利と自由を守ります。
```

---
## 02_en_knowledge: 英語知識

**プロンプト**: Explain the difference between TCP and UDP protocols in networking. Be concise.

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 1046ms | トークン: 231 | スループット: 220.8 tok/s

```
**TCP (Transmission Control Protocol)**  
- Connection‑oriented: establishes a session before data transfer.  
- Reliable: guarantees delivery, ordering, and retransmission of lost packets.  
- Flow and congestion control to avoid network overload.  
- Higher overhead (handshake, acknowledgments, sequencing).  
- Used where accuracy matters: web, email, file transfer, SSH, etc.

**UDP (User Datagram Protocol)**  
- Connectionless: sends packets (“datagrams”) without prior handshake.  
- Unreliable: no guarantee of delivery, ordering, or duplicate suppression.  
- Minimal overhead: no acknowledgments, no flow control.  
- Faster and lower latency.  
- Used where speed or real‑time is critical: VoIP, streaming, gaming, DNS, etc.
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 9252ms | トークン: 183 | スループット: 19.8 tok/s

```
Here's a concise explanation:

**TCP (Transmission Control Protocol)**

* Connection-oriented: Establishes a dedicated connection before data transfer
* Reliable: Ensures data is delivered in the correct order, with error-checking and retransmission of lost packets
* Ordered: Guarantees data is delivered in the same order it was sent
* Slower: Due to overhead of establishing and maintaining connections

**UDP (User Datagram Protocol)**

* Connectionless: No dedicated connection is established before data transfer
* Best-effort: Does not guarantee delivery, order, or error-free transmission
* Faster: Less overhead, making it suitable for real-time applications like video streaming and online gaming

In summary, TCP prioritizes reliability and order, while UDP prioritizes speed and efficiency. Choose TCP for applications requiring guaranteed delivery, like file transfers, and UDP for applications requiring low latency, like video streaming.
```

---
## 03_reasoning: 論理的推論

**プロンプト**: ある部屋に3つのスイッチがあります。それぞれが隣の部屋にある3つの電球のうち1つに対応しています。隣の部屋は見えません。部屋を1回だけ移動して、どのスイッチがどの電球に対応しているか確定するにはどうす...

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 2264ms | トークン: 500 | スループット: 220.8 tok/s

```
**解法（1回だけ部屋を移動する方法）**

1. **スイッチAを入れたまま**  
   - まずスイッチA（1番目）を入れ、数分（たとえば5〜10分）そのままにしておく。  
   - その間に対応する電球は点灯し、熱がこもる。

2. **スイッチAを切り、スイッチBを入れる**  
   - スイッチAを切り、すぐにスイッチB（2番目）を入れる。  
   - ここでスイッチBに対応する電球は点灯し、熱はほとんど残らない。

3. **隣の部屋へ移動**  
   - 以上の操作を終えたら、隣の部屋へ一度だけ移動する。

4. **電球の状態を確認**  
   - **点灯している電球** → スイッチB（2番目）に対応。  
   - **消えているが熱い（触ってみて暖かい）電球** → スイッチA（1番目）に対応。  
   - **消えているが冷たい電球** → スイッチC（3番目）に対応。

---

### なぜこの方法が機能するか
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 14703ms | トークン: 292 | スループット: 19.9 tok/s

```
この問題は、情報を最小限に抑えながら、最大限の情報を得る方法を考える必要があります。ここでは、次の手順を実行します。

1. スイッチ1をオンにします。
2. そのまま5分待ちます。
3. スイッチ1をオフにし、スイッチ2をオンにします。
4. 隣の部屋に移動し、電球を確認します。

ここで、電球の状態を観察します。

- 熱くて点灯している電球：スイッチ2に対応します。
- 熱くて消灯している電球：スイッチ1に対応します。
- 冷たくて点灯している電球：スイッチ3に対応します。
- 冷たくて消灯している電球：スイッチのオン/オフを繰り返すことで対応を確認しますが、上記の方法ではスイッチ3に対応する電球は冷たくて消灯しているはずです。

この方法では、スイッチと電球の対応を1回の移動で確定できます。5分待つことで、電球が熱くなる時間を確保し、スイッチのオン/オフを最小限に抑えながら、必要な情報を得ることができます。
```

---
## 04_code: コード生成

**プロンプト**: Pythonで、与えられたリストから重複を除去しつつ元の順序を保持する関数を書いてください。型ヒント付きで、テストコードも含めてください。

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 2178ms | トークン: 500 | スループット: 229.6 tok/s

```
以下は、**リストから重複を除去しつつ元の順序を保持**する汎用関数です。  
型ヒント（`TypeVar`）を付けているので、任意のハ
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 20110ms | トークン: 399 | スループット: 19.8 tok/s

```
ここでは、Python で与えられたリストから重複を除去しつつ元の順序を保持する関数を書きます。型ヒントを含め、テストコードも提供します。

```python
from typing import List

def remove_duplicates(input_list: List) -> List:
    """
    与えられたリストから重複を除去しつつ元の順序を保持する。

    Args:
        input_list (List): 入力リスト

    Returns:
        List: 重複を除去したリスト
    """
    seen = set()  # すでに追加した要素を保持するセット
    result = []  # 結果リスト

    for item in input_list:
        if item not in seen:  # 要素がセットにない場合
            seen.add(item)  # セットに追加
            result.append(item)  # 結果リストに追加

    return result

# テストコード
test_list = [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9]
print(remove_duplicates(test_list))  # [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

この関数は、入力リストを順番に処理し、各要素がすでにセットに追加されていない場合にのみ結果リストに追加します。これにより、元の順序を保持しつつ重複を除去できます。型ヒントを使用することで、関数の入力と出力の型が明確になり、コードの読みやすさとメンテナンス性が向上します。テストコードでは、サンプルリストを使用して関数の動作を確認しています。
```

---
## 05_creative: 創作（日本語）

**プロンプト**: 「AIと人間が共存する2050年の東京」をテーマに、100文字程度の短い物語を書いてください。

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 1335ms | トークン: 300 | スループット: 224.7 tok/s

```
None
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 7869ms | トークン: 156 | スループット: 19.8 tok/s

```
ネオン輝く東京の街並みに、人工知能（AI）が溶け込んでいた。ロボットタクシーが走り、AIアシスタントが市民の生活を支える。ある日、老舗の和菓子屋に、AIパティシエが新たに加わった。伝統の技とAIの創造力が融合し、革新的な菓子が生まれた。店主の高齢女性は、AIと共に新しい伝統を築き始める。共存することで、東京の文化はさらに豊かになっていた。人々はAIと共に歩み、未来を創造していた。
```

---
## 06_summarize: 要約

**プロンプト**: 以下の文章を3行で要約してください：
量子コンピュータは、量子力学の原理を利用して情報を処理するコンピュータです。従来のコンピュータがビット（0か1）を基本単位として使うのに対し、量子コンピュータは量...

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 909ms | トークン: 200 | スループット: 220.0 tok/s

```
量子コンピュータは量子ビットを用いて重ね合わせやエンタングルメントを活用し、従来のビットベースのコンピュータよりも特定の問題で大幅に高速化できる可能性があります。暗号解読や新薬開発、材料科学、最適化問題など多岐にわたる分野で革命的な変化が期待されています。現在はエラー率の高さやキュービットの安定性といった技術的課題が残る発
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 10101ms | トークン: 200 | スループット: 19.8 tok/s

```
量子コンピュータは量子力学の原理を利用し、量子ビット（キュービット）を用いて情報を処理するコンピュータです。従来のコンピュータを大幅に上回る計算速度を実現できる可能性があり、暗号解読や新薬開発など多くの分野で革命的な変化をもたらすと期待されています。しかし、エラー率の高さやキュービットの安定性など、多くの技術的課題が残っています。量子コンピュータはまだ発展途上にあります。量子コンピュータは特定の問題においては従来のコンピュータを大幅に上回る計算速度を実現できる可能性があります。量子コンピュータは多くの分野で革命的な変化をもたらすと期待されています。量子コン
```

---
## 07_math: 数学

**プロンプト**: ある店で、定価1000円の商品を20%引きで販売し、さらにその価格から10%のポイント還元をしています。実質的な支払額はいくらですか？計算過程も示してください。

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 1330ms | トークン: 300 | スループット: 225.6 tok/s

```
**実質的な支払額**  
**720円**

---

### 計算過程

1. **定価**  
   \[

```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 8625ms | トークン: 171 | スループット: 19.8 tok/s

```
定価1000円の商品を20%引きで販売する場合、割引額は次のようになります。

1000円 x 20% = 1000円 x 0.2 = 200円

したがって、割引後の価格は次のようになります。

1000円 - 200円 = 800円

さらに、その価格から10%のポイント還元がある場合、還元されるポイントは次のようになります。

800円 x 10% = 800円 x 0.1 = 80円

実質的な支払額は、割引後の価格からポイント還元額を引いたものになります。

800円 - 80円 = 720円

したがって、実質的な支払額は720円になります。
```

---
## 08_instruction: 指示追従

**プロンプト**: 以下の条件をすべて満たす文章を1つ書いてください：
1. ちょうど3文で構成される
2. 各文は「実は」で始まる
3. 食べ物に関する内容である
4. 最後の文に数字を含む

### gpt-oss-20b (g7e.4xlarge)
- レイテンシ: 914ms | トークン: 200 | スループット: 218.8 tok/s

```
None
```

### llama-3.1-70b-ja (g7e.12xlarge)
- レイテンシ: 4829ms | トークン: 95 | スループット: 19.7 tok/s

```
実は、ラーメンは日本で最も人気のある食べ物の一つです。実は、ラーメンのスープは豚骨や鶏ガラなどを長時間煮込んで作ることが多く、手間と時間がかかります。実は、有名なラーメン店では、1日に500杯以上のラーメンを提供することもあるそうです。
```
