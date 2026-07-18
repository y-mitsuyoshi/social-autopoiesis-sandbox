# モデル比較実験

本ドキュメントは `scripts/compare_models.py` による複数モデル同一お題比較実験の手順・出力フォーマット・考察欄を整理する。実 API 実行はユーザー環境で実施する。

## 実行コマンド

```bash
python scripts/compare_models.py \
  --models <model1> <model2> <model3> \
  --trigger "<お題>" \
  --max-turns <N> \
  [--agents-config <yaml>] \
  [--provider ollama|openai|gemini] \
  [--api-key <key>] \
  [--base-url <url>] \
  [--output docs/experiments/model-comparison.md]
```

### 例

```bash
python scripts/compare_models.py \
  --models gemma4:31b gpt-oss:20b llama3.1:8b \
  --trigger "現代社会における経済と法の対話" \
  --max-turns 9 \
  --agents-config config/presets/agents-3.yaml
```

## 引数

| 引数 | 必須 | 説明 |
| --- | --- | --- |
| `--models` | ✔ | 比較対象モデル名のリスト（スペース区切り） |
| `--trigger` | ✔ | お題メッセージ |
| `--max-turns` | | 最大ターン数（デフォルト 3） |
| `--agents-config` | | エージェント構成YAML（省略時はハードコードフォールバック） |
| `--provider` | | LLMプロバイダ（デフォルト `ollama`） |
| `--api-key` | | APIキー（省略時は `.env` から） |
| `--base-url` | | ベースURL（省略時は `.env` から） |
| `--output` | | 出力Markdownパス（デフォルト `docs/experiments/model-comparison.md`） |

## 出力

スクリプトは `run_simulation` を in-process で各モデルについて実行し、以下の簡易統計を Markdown 表で `--output` に上書き出力する:

| 指標 | 説明 |
| --- | --- |
| ターン数 | 実際に生成された発言数 |
| 平均発言長 | 各発言の文字数の平均 |
| 平均ターン時間 | 1ターンあたりの実時間（秒） |
| TTR (type-token ratio) | 語彙多様性: 種類数 / 総トークン数（スペース区切り） |

## 比較表フォーマット

```markdown
| モデル | ターン数 | 平均発言長 | 平均ターン時間(s) | TTR (type-token ratio) |
| --- | ---: | ---: | ---: | ---: |
| gemma4:31b | 9 | 120.4 | 1.234 | 0.678 |
| gpt-oss:20b | 9 | 98.2 | 0.987 | 0.543 |
```

## 考察欄

> スクリプトは比較表の後に `## 考察` セクションを空欄で出力する。実行後に以下を記入する。

- 実行日時:
- お題:
- エージェント構成:
- モデルごとの所見:
- コード別（`支払/非支払` / `真/偽` / `合法/違法`）の特徴的差異:
- 語彙多様性（TTR）の解釈:
- 総合所見:

## 注意事項

- 全エージェントが同一モデルで実行される（エージェントごとのモデル差し替えは次フェーズ候補）
- `--output` は毎回上書きされる。履歴保全が必要な場合はタイムスタンプ付きファイル名を指定すること
- 実 API 実行時は `.env` に有効な資格情報を設定すること