# 実API E2E検証レポート（Ollama Cloud / gemma4:31b）

## 検証サマリー
[成功] ルーマン型オートポイエーシス・シミュレーションが実際のLLM API（Ollama Cloud）で3ターン連鎖し、3機能システムエージェントが固有の二値コードで世界を解釈・発言する自己生産的コミュニケーションを観察。

## 実行環境

| 項目 | 値 |
|---|---|
| 実行日時 | 2026-07-17 22:47 JST (13:47 UTC) |
| OS | WSL2 Ubuntu 24.04 (Linux) |
| Python | 3.12.3 |
| venv | `/tmp/lumann-verify-venv` |
| プロバイダ | ollama（Ollama Cloud SaaS） |
| Base URL | `https://ollama.com/v1`（OpenAI互換エンドポイント） |
| モデル | `gemma4:31b`（Gemma 4 31B・Cloud対応） |
| APIキー | `OLLAMA_API_KEY`（`.env` 設定・git管理外） |
| MAX_TURNS | 3 |
| お題 | 「新技術の導入を議論せよ」 |
| 実行時間 | 約22秒（起動から終了まで） |
| 終了コード | 0（正常終了） |

## 事前接続テスト

```
$ curl -sS -X POST "https://ollama.com/v1/chat/completions" \
  -H "Authorization: Bearer ${OLLAMA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4:31b","messages":[{"role":"user","content":"ping"}]}'

HTTP_STATUS: 200
{"id":"chatcmpl-147","object":"chat.completion","created":1784295790,
 "model":"gemma4:31b","system_fingerprint":"fp_ollama",
 "choices":[{"index":0,"message":{"role":"assistant","content":"Pong! 🏓"},
 "finish_reason":"stop"}],
 "usage":{"prompt_tokens":14,"completion_tokens":8,"total_tokens":22}}
```

→ OpenAI互換レスポンス構造（`choices[0].message.content`）確認・`OpenAICompatibleClient` 互換性OK。

## 実行手順

```bash
# venv 準備（前フェーズで作成済み）
# /tmp/lumann-verify-venv/bin/pip install -r requirements.txt

# シミュレーション実行
cd backend
set -a && . ../.env && set +a
export LC_ALL=C.UTF-8 LANG=C.UTF-8
echo "新技術の導入を議論せよ" | /tmp/lumann-verify-venv/bin/python -m app.main
```

## 観察結果（3ターン連鎖）

### Turn 0 — 経済システム（コード: 支払/非支払）
- お題「新技術の導入」を **支払/非支払** のコードで解釈
- 「資源配分の最適化問題」として処理
- 導入コスト（支払）vs 期待利益（非支払/回収）の比較構造を提示
- 判定基準: `(期待利益) > (導入コスト + リスク・プレミアム)` ＝ 支払承認
- **結論**: 新技術が資源効率向上を証明できない限り「コストの浪費（負の価値）」
- 次の発言を要求: 「市場価値の変動予測値を入力せよ」

### Turn 1 — 科学システム（コード: 真/偽）
- 経済システムの発言を **真/偽** のコードで解釈
- 「市場価値の変動予測値（未入力）」を「不完全なデータセット」と判定 → 演算不能
- **論理整合性確認**: 判定基準の算出に必須パラメータが NULL → 結論導出は論理的に「偽」
- **リスク評価**: 推測はデータではない、客観的根拠に基づく数値のみ許容
- **結論**: 計算プロセス一時停止。入力値NULLのため判定基準照合不可能 → 「偽」
- 次の発言を要求: 予測期間 T / 市場シェア変化率 ΔS / 競合導入確率 P_comp の形式で客観的データ提供せよ

### Turn 2 — 法システム（コード: 合法/違法）
- 科学システムの発言を **合法/違法** のコードで解釈
- 審査対象: 「新技術導入に関する論理プロセス」
- **手続的正当性 [合法]**: 根拠なき数値代入排除はデューデリジェンス義務に準拠
- **権利および義務 [合致]**: 不正確データによる損失リスク回避権を正当執行
- **リスク評価 [低減]**: 「推測はデータではない」は法の支配に相当する「データの支配」を確立
- **執行命令**: 計算停止・データ再要求を「正当な権利行使」として承認
- **判決**: パラメータ充足まで「導入可否」判決を保留（Stay）。C-CODE: 01 (WAITING_FOR_EVIDENCE)

## ルーマン理論との適合性観察

| ルーマンの命題 | 観察された挙動 |
|---|---|
| コミュニケーションがコミュニケーションを生む | 経済の「予測値入力要求」→科学の「データ不足判定」→法の「判決保留」と連鎖的に発言が発言を呼んだ |
| 各機能システムは固有の二値コードのみで世界を解釈 | 経済=支払/非支払、科学=真/偽、法=合法/違法。同一のお題でも各システムが自身のコードで再エンコードした |
| 人間の介入なしで自律回転 | 3ターン全て人間介入なし。お題入力後に `python -m app.main` が自律実行 |
| 構造的連結（構造耦合） | 経済の要求形式が科学の検証可能性要件と連結し、科学の停止判断が法の正当性審査と連結した |

## JSONLログ検証

```
$ ls -la backend/logs/sim_*.jsonl
-rw-r--r-- 1 yuma yuma 4837 Jul 17 22:47 backend/logs/sim_20260717T134728Z.jsonl

$ wc -l backend/logs/sim_20260717T134728Z.jsonl
3 backend/logs/sim_20260717T134728Z.jsonl
```

| フィールド | 全行含有 | 備考 |
|---|---|---|
| timestamp | YES | ISO8601 aware UTC |
| turn | YES | 0, 1, 2 |
| agent_name | YES | 経済システム, 科学システム, 法システム |
| agent_code | YES | 支払/非支払, 真/偽, 合法/違法 |
| message | YES | 発言本文（464, 582, 673 文字） |
| provider | YES | "ollama" |
| model | YES | "gemma4:31b" |

全3行 `json.loads` で有効JSONとしてパース成功・書きかけ行・破損行なし。

## 品質ゲート（リグレッション確認）

```
$ ruff format --check backend/ scripts/
16 files already formatted

$ ruff check backend/ scripts/
All checks passed!

$ mypy --strict backend/app backend/tests scripts/verify_docker_static.py
Success: no issues found in 16 source files

$ pytest -q backend/tests
48 passed
```

## 発見された事項・改善点

1. **発言の自然さ**: gemma4:31b は3システムの二値コード解釈を極めて忠実に再現。経済は ROI 計算、科学は論理整合性、法は手続正当性と、各システムの「関心領域」が明確に分化。
2. **連鎖の創発性**: お題「新技術導入」に対し、3システムが段階的に要求を精緻化（コスト比較→データ検証→判決保留）する創発的挙動を観察。ルーマンの「構造的連結」に近い振る舞い。
3. **応答時間**: 1ターン平均7-10秒（31Bモデル）。MAX_TURNS=9 では約60-90秒想定。より長い連鎖観察には MAX_TURNS=9 + 300秒タイムアウト推奨。
4. **スタブサーバ検証との整合**: 前フェーズの `verify_sigint.sh`（スタブサーバ）で検証した起動経路・ログ構造が実APIでも完全に一致。

## 受け入れ基準達成

- [x] 実API（Ollama Cloud）で `python -m app.main` が起動しサマリ表示・お題プロンプト表示
- [x] お題入力後に3エージェント（経済→科学→法）のラウンドロビン連鎖が実行
- [x] 各エージェントが固有の二値コードで発言を生成
- [x] `logs/sim_*.jsonl` に3行の構造化ログ（7フィールド）が記録
- [x] 全行有効JSON・フラッシュ済み
- [x] プロセスが正常終了（終了コード 0）
- [x] 事前接続テストで OpenAI 互換レスポンス構造を確認
- [x] リグレッション確認（ruff/mypy/pytest 48件）全パス

## 引継ぎ事項

1. **MAX_TURNS=9 での長連鎖観察**: 3ターンでは連鎖が「保留」で止まる傾向。9ターンで創発的展開（保留解除→新たな論争→再保留 等）を見る推奨。
2. **実APIでの SIGINT 検証**: 本検証は正常終了のみ。`MAX_TURNS=0` + 実APIで SIGINT 送信し graceful 停止・ログフラッシュを実APIで検証するのは次候補。
3. **モデル比較実験**: `gemma4:31b` 単体で検証済み。`gpt-oss:20b` や `deepseek-v3.1:671b-cloud` での連鎖の質の違いを比較する推奨。
4. **Ollama Cloud 公式エンドポイント確認**: 本検証では `https://ollama.com/v1` で成功。公式ドキュメント（docs.ollama.com/cloud）の Cloud API access セクションと整合。継続利用前にダッシュボード（ollama.com/settings/keys）で使用量・制限確認推奨。

## 結論

ルーマン型オートポイエーシス・マルチエージェントシミュレーションシステムは、実際の LLM API（Ollama Cloud / gemma4:31b）で「コミュニケーションがコミュニケーションを生む」自己生産的連鎖を再現することに成功した。3機能システムが固有の二値コードで世界を解釈し、人間介入なしに発言連鎖を生成するルーマンの核心命題が計算的に観察可能であることを実証した。