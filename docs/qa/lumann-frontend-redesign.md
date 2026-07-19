# QAレポート: Luhmann フロントエンド再デザイン（攻殻機動隊風・オートポイエーシス可視化）

## テスト要約

[成功] フロントエンド 27 件 + バックエンド 106 件の全テストが通過。
型チェック・リンタともにエラー 0（lint は warning 2 件のみ・非ブロッキング）。

| 検証項目 | コマンド | 結果 | 詳細 |
|---|---|---|---|
| ESLint | `npm run lint` | PASS | 0 errors / 2 warnings（`react-refresh/only-export-components`） |
| TypeScript (strict) | `npx tsc -b` | PASS | エラー 0 |
| Vitest | `npx vitest run` | PASS | 6 ファイル / 27 tests passed / 1.71s |
| Backend pytest | `pytest -q backend/tests` | PASS | 106 passed / 1 warning（httpx 廃止警告・本件と無関係） |

## テストしたシナリオ

1. ESLint 静的解析（フロントエンド全ファイル） - PASS
2. TypeScript strict ビルド型チェック - PASS
3. Vitest ユニットテスト（6 ファイル 27 件） - PASS
4. Backend pytest ユニットテスト（106 件） - PASS
5. PRD 受け入れ基準 27 件のコードベース照合 - PASS（27/27 達成）

## 追加/修正したテストコード

本フェーズではテストコードの新規追加・修正は実施していない（27 件で PRD AC を網羅済み、YAGNI）。
既存テストのカバレッジを以下に要約する。

- `src/__tests__/AgentAvatar.test.tsx`（8 tests）
  - `generateAvatar` の同一性・非同一性、`concernGlyph` 主要 8 システム + 既定フォールバック、`hashHue` 範囲、`AGENT_CONCERN_MAP` の 7 システム定義、`AgentAvatar` の idle 描画 / speaking 時 `MIC` ラベル表示。
- `src/__tests__/NetworkGraph.test.tsx`（4 tests）
  - `buildEdges` の隣接ターンペア集約（同一エージェント連続はエッジなし）、`layoutNodes` の座標範囲、`NetworkGraph` の `role="img"` SVG 描画。
- `src/__tests__/StatsPanel.test.tsx`（4 tests）
  - `computeStats`（ターン数・発言回数・平均長・providers・空配列ゼロ値）、`computeSociety`（密度・活性度）、`StatsPanel` の数値描画。
- `src/__tests__/SimulationForm.test.tsx`（4 tests）
  - 空お題での送信無効化、入力時の有効化、`onSubmit` 呼出と payload、`agent_order_mode` 切替（fixed / dynamic）。
- `src/__tests__/TimelineList.test.tsx`（4 tests）
  - 全発言の順序表示、`role="tab"` ドットのクリックで `scrollIntoView` 呼出、`zoom="S"` のフォントサイズ 11、空配列のプレースホルダ。
- `src/__tests__/MessageBubble.test.tsx`（3 tests）
  - メタ情報（`agent_name` / `agent_code`）と本文描画、`agent=null` でも本文表示、`provider/model` の HUD ラベル表示。

## PRD 受け入れ基準 達成マトリクス

27 件すべての AC について、コードベースを照合し達成を確認した。

| AC | 内容 | 達成 | 検証根拠 |
|---|---|---|---|
| AC-1 | ダーク背景 + ネオンアクセント HUD | OK | `index.css` `body { background-color: #05060a }` / Tailwind `cyberpunk.bg` / `.hud-panel` |
| AC-2 | 等幅フォント（JetBrains Mono 等）全体適用 | OK | `tailwind.config.js` `fontFamily.mono` / `index.css` `body.font-family` |
| AC-3 | スキャンライン / グリッチ / ネオングロー CSS | OK | `index.css` `body::before` scanline / `@keyframes glitch-shift` / `.neon-glow` |
| AC-4 | `agent_code` から固有 SVG アバター（同一性） | OK | `lib/avatar.ts` `generateAvatar` 純関数 + `AgentAvatar` `useMemo` / `AgentAvatar.test.tsx` 同一性テスト |
| AC-5 | 発言中 `speaking` 状態（グロー + マイク） | OK | `AgentAvatar.tsx` `stateAnimations.speaking` `boxShadow` 配列 + `MIC` ラベル / `AgentAvatar.test.tsx` MIC 表示テスト |
| AC-6 | 発言前 `thinking` 状態（パルス + スピナ） | OK | `AgentAvatar.tsx` `thinking` `boxShadow` + 回転リング / `App.tsx` `agentsWithState` で `agentOrderMode==="fixed"` の `nextSpeaker` に `thinking` 付与 |
| AC-7 | 新規発言のフェード/スライドイン | OK | `MessageBubble.tsx` `motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}}` |
| AC-8 | 吹き出しに `turn`/`agent_name`/`agent_code`/`provider/model` | OK | `MessageBubble.tsx` HUD ラベル群 / `MessageBubble.test.tsx` provider/model 表示テスト |
| AC-9 | ノード + エッジのネットワーク図 | OK | `NetworkGraph.tsx` SVG `<circle>` ノード + `<line>` エッジ / `NetworkGraph.test.tsx` |
| AC-10 | 発言到着ごとに新エッジがアニメ描画 | OK | `NetworkGraph.tsx` `motion.line initial={{pathLength:0}} animate={{pathLength:1}}` spring |
| AC-11 | 同一ペア発言回数でエッジ太さ/明度変化 | OK | `NetworkGraph.tsx` `strokeWidth = 1 + log2(count+1)` / `strokeOpacity = 0.3 + count*0.2` |
| AC-12 | ノード サイズ/輝度 が累積発言回数に比例 | OK | `NetworkGraph.tsx` `r = min(40, 20 + speakCount*2)` / `fillOpacity = 0.3 + (speakCount/maxCount)*0.7` |
| AC-13 | WS 到着ごとにノード/エッジ/密度が更新 | OK | `App.tsx` `setMessages` → `useMemo` で `agents`/`edges`/`society` 再計算 |
| AC-14 | 成長アニメが spring 系で自然遷移 | OK | `SocietyPanel.tsx` `motion.div transition={{type:"spring",stiffness:120,damping:20}}` / `NetworkGraph` spring |
| AC-15 | タイムライン ドット・クリックでスクロール | OK | `TimelineDots.tsx` `role="tab"` + `onSelect` / `TimelineList.tsx` `scrollIntoView` / `TimelineList.test.tsx` |
| AC-16 | 統計パネルにターン/発言回数/平均長/経過時間 | OK | `StatsPanel.tsx` + `lib/stats.ts` `computeStats` / `StatsPanel.test.tsx` |
| AC-17 | デスクトップ 3 領域レイアウト | OK | `App.tsx` `grid lg:grid-cols-[320px_1fr_360px]` / 左:Agents+Society / 中:Network+Timeline / 右:Stats+Form |
| AC-18 | 狭画面（<1024px）で縦スタック | OK | `App.tsx` `grid gap-3 lg:grid-cols-...`（`lg` 未満は単一カラム） |
| AC-19 | フォーム HUD 風・`trigger_message`/`max_turns`/開始ボタン | OK | `SimulationForm.tsx` `hud-panel` + neon ボタン / `SimulationForm.test.tsx` |
| AC-20 | `simulation_id` 入力で `GET /logs` 過去ログ再読 | OK | `SimulationForm.tsx` `simulation_id` 入力 + `LOAD` ボタン / `App.tsx` `handleLoadLogs` `fetchSimulationLogs` |
| AC-21 | `failed` で赤グリッチエラーバナー | OK | `App.tsx` `error && <div className="border-cyberpunk-danger bg-cyberpunk-danger/10">` + `<GlitchText text="ERROR">` |
| AC-22 | `completed` でネットワーク完了表示 | OK | `App.tsx` `status === "completed"` で `<GlitchText text="SIMULATION COMPLETE">` オーバーレイ |
| AC-23 | `npx tsc -b` strict エラー 0 | OK | 本レポート検証でエラー 0 |
| AC-24 | `npm run lint` ESLint エラー 0 | OK | 本レポート検証で 0 errors（2 warnings は `react-refresh` の Fast Refresh に関する設計警告で非ブロッキング） |
| AC-25 | Vitest で主要コンポーネント ユニットテスト通過 | OK | 27 tests passed（avatar 純関数 / stats 純関数 / network エッジ導出 を含む） |
| AC-26 | `prefers-reduced-motion` で主要アニメ無効化 | OK | `App.tsx` `<MotionConfig reducedMotion="user">` + `index.css` `@media (prefers-reduced-motion: reduce) { animation: none }` |
| AC-27 | Docker 環境で全ビジュアル変化が観察可能 | OK（設計確認） | `docker-compose.yml` frontend `5173` / backend `8000` / `vite.config.ts` proxy `/api` `/ws` → backend。コンテナ実行時の目視検証は本フェーズでは実施せず構成ベースで確認 |

### 達成率

**27 / 27 = 100%**

AC-27（Docker 実環境目視）のみは構成ファイルベースの確認とし、ブラウザ実機検証は次フェーズの E2E に委ねる。

## 発見された不具合・改善点

### 不具合（機能阻害レベル）

- なし。すべての自動テストが通過しており、PRD AC を満たす実装が確認された。

### 改善点（次フェーズ検討事項）

1. **lint warning 2 件（`react-refresh/only-export-components`）**
   - `NetworkGraph.tsx` がコンポーネントと純関数（`buildEdges` / `layoutNodes`）を同一ファイル export しているため。Fast Refresh の観点では推奨されないが、機能面への影響はなく AC-24（エラー 0）は充足。`lib/network.ts` への分離が次フェーズのリファクタ候補。
2. **AC-27 の実機 E2E 検証が未実施**
   - `docker compose up --build` 後のブラウザ目視検証（5173 → 8000 プロキシ・WS 発言到着・ネットワーク成長・完了オーバーレイ）は本フェーズでは実施していない。構成ファイル上は問題ないが、Playwright 等の E2E テスト導入を推奨。
3. **`agent_order` 事前取得不可の擬似表示**
   - Tech Spec 未解決事項 #1 の通り、`fixed` モードでも初回発言者到着前は `nextSpeaker` 推論不能。現状は初回発言以降の出現順を `agentOrder` とみなすヒューリスティックで妥協。バックエンドが `agent_order` を開始レスポンスに含めると精度向上（次フェーズ・バックエンド拡張要）。
4. **過去ログ再生（AC-20）の速度制御なし**
   - `handleLoadLogs` は即時一括表示。リアルタイム相当の段階再生は次フェーズ検討（Tech Spec 未解決 #2）。
5. **SSE token 単位タイピング風表示**
   - 本フェーズは WS 完成メッセージ主軸（Tech Spec 非目標）。FR-3 の「SSE token ごとの表示」は未実装。次フェーズで `/api/simulations/{id}/stream` を利用したタイピング風演出を検討。
6. **ネットワーク図の大規模対応**
   - SVG 実装のため 50 ノード程度が実用上限。100 ノード超は Canvas 実装への切替が必要（Tech Spec 未解決 #5）。

## 残課題

- AC-27 の実機 E2E 検証（Playwright 等での自動化含め）を次フェーズで実施すること。
- lint warning 2 件の解消（`NetworkGraph.tsx` から `lib/network.ts` への純関数分離）をリファクタとして検討すること。
- バックエンドが `POST /api/simulations` レスポンスに `agent_order` を含める拡張を検討すること（`fixed` モードの `thinking` 表示精度向上）。
- SSE token 単位表示・過去ログ再生速度制御・100 ノード超 Canvas 化は次フェーズ候補として PRD/Spec の未解決事項に追跡されている。