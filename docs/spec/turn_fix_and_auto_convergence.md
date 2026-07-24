# Tech Spec: TURN 1起算・ターンピッタリ終了・自動収束モード・ちかちか完全撤廃

## 建築・技術仕様

### 1. UIの点滅（ちかちか）完全除去
- `HumanAvatar.tsx`:
  - `state === "speaking"` の `blur-sm` や点滅エフェクトを撤廃し、`shadow-[0_0_12px_rgba(251,191,36,0.5)]` や `border-amber-400` の静的エレガントリングに変更。
  - `state === "thinking"` も静的な枠線・バッジに統一。
- `RoundtableStage.tsx`, `App.tsx`, `AutopoiesisGraphPanel.tsx`:
  - `animate-pulse`, `animate-ping`, `animate-bounce` クラスをすべて除去。静的で目に優しいアクセントカラーへ変更。

### 2. TURN 1 起算化 (1-Indexed Turn Display)
- `TimelineList.tsx`, `MessageBubble.tsx`, `RoundtableStage.tsx`, `NetworkGraph.tsx`, `RealtimeCyberMetrics.tsx`, `App.tsx`:
  - 表示上 `Turn ${msg.turn + 1}` となるように一貫して統一。

### 3. MAX TURNS 精密カウント・終了処理 (`simulation.py` & `App.tsx`)
- `simulation.py`:
  - `while True:` ループ内での `turn` の加算タイミングと `config.max_turns` のチェックを再レビュー。
  - `turn >= config.max_turns` になった瞬間に即時ブレイクしてメッセージを生成しない。
  - `spoken_in_cycle` およびエージェント巡回の端数計算を見直し、指定ターン数（例: 15）でちょうど15個のメッセージが記録されて終了するように保証。

### 4. 無制限 / 自動収束モード (Auto-Convergence Mode)
- `max_turns == 0` の場合:
  - 5ターン以上経過後、対話の合意傾向（またはメタ・モデレーターの発言「議論は十分に収束しました」等のフラグ）をバックエンドで判定。
  - 収束したと判定された時点で「議論が収束しました」ログを生成し、シミュレーションを正常完了。
- フロントエンド `AgentEditor.tsx` に「♾️ 自動収束モード (ターン制限なし)」トグル/プリセットを追加。

### 5. 終了後の理解しやすい解説プレゼンテーション
- シミュレーション完了時に表示される完了通知バナーおよび `LuhmannTeacherPanel` で、今回の対話がどのようにまとまったか、人間味のある理解しやすいまとめを表示。
