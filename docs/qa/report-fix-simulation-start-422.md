# QAレポート: Fix Simulation Start 422 Error

## テスト要約
[成功] (成功)

## テストしたシナリオ
1. **ログ出力先ディレクトリ権限の修正**: コンテナ内での `chmod/chown` 反映後、正常に `201 Created` を受け取りバックグラウンド実行が開始されることを `curl` リクエストで確認。 - 成功
2. **フロントエンド プリセット連携機能**: プリセットプルダウン切り替え時に、期待通り `agent_order_mode` が同期されることをUI操作テストで確認。 - 成功
3. **フロントエンド API エラー詳細パース**: 不正なリクエストが送られた場合に、422 に含まれる FastAPI のエラー詳細（`detail`）が抽出されUIにエラー表示されることを確認。 - 成功
4. **自動テストの検証**: `verify.sh` により、バックエンド pytest (105 passed, 1 skipped) およびフロントエンド Vitest (28 passed) のテスト実行がすべて正常完了することを確認。 - 成功

## 追加/修正したテストコード
- `frontend/src/__tests__/SimulationForm.test.tsx` に追加・修正したテスト:
```typescript
test("agent_order_mode を dynamic に切り替えられる", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const dynamic = screen.getByLabelText("dynamic");
  fireEvent.click(dynamic);
  const button = screen.getByRole("button", { name: /START/ });
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
    agent_order_mode: "dynamic",
    agents_config: "config/presets/agents-3-dynamic.yaml",
  });
});

test("プリセットを選択すると agent_order_mode が自動同期される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });

  // 3 Agents + Moderator (Dynamic) プリセットを選択
  const select = screen.getByLabelText(/エージェント構成プリセット/);
  fireEvent.change(select, { target: { value: "config/presets/agents-3-dynamic.yaml" } });

  const button = screen.getByRole("button", { name: /START/ });
  fireEvent.click(button);

  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
    agent_order_mode: "dynamic",
    agents_config: "config/presets/agents-3-dynamic.yaml",
  });
});
```

## 発見された不具合・改善点
- 以前は API エラー時に 422 コードのみの表示となっていたが、今回の修正によりレスポンスの JSON から `detail` フィールドを抽出し、より分かりやすい詳細メッセージを画面に出力できるように改善された。
