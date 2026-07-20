# QAレポート: 社会システム自己組織化シミュレータ機能拡張の検証

## テスト要約
[成功]

## テストしたシナリオ
1. **一般エージェントのLLMタイムアウト/回復シナリオ (Backend)**
   - **内容**: 一般エージェントのLLM呼び出し（OpenAICompatibleClient/GeminiClient等）でタイムアウト例外（`httpx.TimeoutException`）が発生した場合の挙動を検証。
   - **結果**: シミュレーションプロセスが異常終了することなく作動的閉鎖を維持し、ログファイルにはノイズを示す既定のフォールバック文面（「`（環境からのノイズにより一時的に通信が途絶しています。システムは作動的閉鎖を維持しています）」`）が記録されることを確認。

2. **モデレータ（メタエージェント）の例外・タイムアウト回復シナリオ (Backend)**
   - **内容**: 次期発言者を決定するモデレータ（メタエージェント）の呼び出し時にタイムアウトが発生した場合の挙動を検証。
   - **結果**: 選択肢（候補リスト）から決定論的なフォールバックロジックを用いて自動的に次の発言者を決定し、シミュレーションが中断されることなく継続されることを確認。

3. **ターン記述スケジューラおよびサイクル境界の連続発言防止シナリオ (Backend)**
   - **内容**: `dynamic` モードにおける発言順序制御を検証。
   - **結果**: 各サイクル（すべての非メタエージェントが1回ずつ発言する期間）において全員が一回ずつ発言すること、およびサイクル境界（サイクル $N$ の最後の話者とサイクル $N+1$ の最初の話者）で同一エージェントが連続して発言しないように制御されていることを確認。

4. **強連結成分 (SCC) による作動的閉鎖判定シナリオ (Frontend)**
   - **内容**: エージェントネットワークのトポロジーにおけるSCC（到達可能性）チェックを検証。
   - **結果**: 
     - 単一のSCC（すべてのノードが相互に到達可能）が存在する場合は `isOperationalClosure` が `true` となる。
     - 分断された複数のサイクル（ディスジョイントサイクル）が存在する場合や、閉じていない直線経路（一方向パス）の場合は `false` となることを確認。

5. **バイナリコード活性化およびスラッシュ欠落時の自動フォールバックシナリオ (Frontend)**
   - **内容**: エージェントの発言から肯定極・否定極の双方が現れたかの判定、およびスラッシュのない不完全なバイナリコードが渡された場合を検証。
   - **結果**: 
     - 肯定極・否定極の出現数がそれぞれ1回以上の場合のみ活性化とみなす。
     - 「支払」のようにスラッシュ `/` が含まれない場合は、デフォルトで「支払」と「非支払」として自動分割・フォールバックしてクラッシュを防ぐことを確認。

6. **GPUアクセラレーションによる CSS Wave アニメーション (Frontend)**
   - **内容**: `AgentAvatar` 発言時のオーディオウェーブ描画におけるアニメーション手法の検証。
   - **結果**: JavaScriptの再レンダリングループではなく、GPUで直接処理される CSS `@keyframes` アニメーション（`transform: scaleY` と `will-change: transform`）を用いており、レンダリング負荷が生じない設計であることを確認。

## 追加/修正したテストコード

### 1. バックエンド用テストコード (`backend/tests/test_phase4_enhancements.py`) の抜粋と解説
```python
@pytest.mark.asyncio
async def test_general_agent_timeout_resilience(tmp_path: Path) -> None:
    # 1. エージェント仕様の設定 (AgentAはタイムアウトし、AgentBは正常応答する)
    specs = [
        AgentSpec(name="AgentA", binary_code="A/NotA", concern="A", system_prompt="SystemA", provider="openai", model="m"),
        AgentSpec(name="AgentB", binary_code="B/NotB", concern="B", system_prompt="SystemB", provider="openai", model="m"),
    ]
    failing_client = FailingClient(failure_type="timeout")
    dummy_client = DummyLLMClient(responses=["ResponseB"])
    clients = {"AgentA": failing_client, "AgentB": dummy_client}

    config = SimulationConfig(
        trigger_message="Trigger",
        max_turns=4,
        agent_order=["AgentA", "AgentB"],
        agent_order_mode="fixed",
    )
    logger = SimulationLogger(logs_dir=tmp_path)

    try:
        await run_simulation(config, specs, clients, logger)
    finally:
        await failing_client.aclose()
        await dummy_client.aclose()
        await logger.aclose()

    # ログ出力ファイルの読み込みと検証
    text = logger.path.read_text(encoding="utf-8")
    messages = [Message.model_validate_json(line) for line in text.splitlines() if line.strip()]
    assert len(messages) == 4

    # 偶数番目のターン (0, 2) は AgentA -> フォールバックの定型句が出力されているか
    assert messages[0].agent_name == "AgentA"
    assert "環境からのノイズにより" in messages[0].message
    assert messages[0].provider == "fallback"

    # 奇数番目のターン (1, 3) は AgentB -> ダミーレスポンスが正常に取得されているか
    assert messages[1].agent_name == "AgentB"
    assert messages[1].message == "ResponseB"
    assert messages[1].provider == "dummy"
```
**解説**: `FailingClient` を用いて、意図的に `httpx.TimeoutException` をスローさせ、システムがクラッシュせずに処理を続行し、対応するメッセージプロバイダが `fallback` としてマークされ、ログに回復用定型メッセージが正しく挿入されることを確認しています。

---

### 2. フロントエンド用テストコード (`frontend/src/__tests__/stats_operational_closure.test.ts`) の抜粋と解説
```typescript
it("should return false if disjoint cycles are present (strictly single SCC check)", () => {
  const agents: Record<string, AgentNode> = {
    A: { ...defaultAgentProps, name: "A", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
    B: { ...defaultAgentProps, name: "B", binaryCode: "支払/非支払", concern: "Money", speakCount: 1 },
    C: { ...defaultAgentProps, name: "C", binaryCode: "真/偽", concern: "Truth", speakCount: 1 },
    D: { ...defaultAgentProps, name: "D", binaryCode: "真/偽", concern: "Truth", speakCount: 1 },
  };

  // 分断された2つのサイクル: A <-> B と C <-> D
  const edges = [
    { from: "A", to: "B", count: 1 },
    { from: "B", to: "A", count: 1 },
    { from: "C", to: "D", count: 1 },
    { from: "D", to: "C", count: 1 },
  ];

  const messages: Message[] = [
    { timestamp: "t", turn: 0, agent_name: "A", agent_code: "支払/非支払", message: "支払 非支払", provider: "p", model: "m" },
    { timestamp: "t", turn: 1, agent_name: "B", agent_code: "支払/非支払", message: "支払 非支払", provider: "p", model: "m" },
    { timestamp: "t", turn: 2, agent_name: "C", agent_code: "真/偽", message: "真 偽", provider: "p", model: "m" },
    { timestamp: "t", turn: 3, agent_name: "D", agent_code: "真/偽", message: "真 偽", provider: "p", model: "m" },
  ];

  const s = computeSociety(agents, edges, 4, messages);
  expect(s.isOperationalClosure).toBe(false);
});
```
**解説**: トポロジー上の到達可能チェックを検証しています。分断された独立したループ（`A<->B` と `C<->D`）が存在する場合、個別の連結度はあってもシステム全体として一つの Strongly Connected Component (SCC) を形成していないため、システム作動的閉鎖の判定（`isOperationalClosure`）が正しく `false` を返すことを確認しています。

## 発見された不具合・改善点
- **インポート順の警告 (I001) の修正**: `tests/test_phase4_enhancements.py` において、`app` のインポートと `tests` 関連モジュールとの間に空行がないために Ruff リンターによる `I001` エラーが発生していましたが、`ruff check . --fix` を実行して自動フォーマット修正を適用し、ゼロエラー状態を達成しました。
- **改善点**: P2指摘事項にある通り、将来的にエージェント数が数万件規模に拡大する場合に備え、現在 $O(V^2 + VE)$ である強連結成分のDFS検出アルゴリズムを、将来的にTarjan法やKosaraju法 ($O(V + E)$) にリファクタリングすることを将来のロードマップとして推奨します。
