# Tech Spec: 攻殻機動隊風アバター・動物アバター & オートポイエーシス作動状況のグラフィカル可視化

## コンテキスト
ユーザーより「攻殻機動隊の人間っぽいものや犬など動物のアバター」および「オートポイエーシスのグラフ可視化」の要求を受けました。これまでのリアリスティック人間アバターに加え、攻殻風サイボーグ・ロボット犬・思考戦車AI・サイバー動物の多様なアバターセットを追加し、オートポイエーシスの作動的閉鎖プロセスを多角的なグラフ・ゲージチャートでリアルタイム可視化します。

## 目標 / 非目標
- **目標**:
  1. `HumanAvatar.tsx` を拡張し、`cyborg_officer`, `cyber_dog`, `think_tank`, `cyber_owl`, `cyber_fox` のベクター描画を追加する。
  2. `humanPersonas.ts` に「攻殻サイバーパンク風」「アニマルAI風」テーマプリセットを追加する。
  3. `AutopoiesisGraphPanel.tsx` コンポーネントを構築し、SCC循環ループ、作動的閉鎖の3条件達成率ゲージ、およびターン推移グラフをレンダリングする。
  4. 全テスト（`vitest`, `pytest`, `tsc`, `eslint`, `mypy`, `ruff`）100%パス。

- **非目標**:
  - バックエンド計算アルゴリズムの破壊的変更（既存の強連結成分計算 `computeSociety` 演算モデルを活用する）。

## コンポーネント設計 (React & TypeScript)

1. `frontend/src/types.ts`:
   - `AvatarTheme = "cyberpunk" | "human" | "animal";`
   - `HumanPersona.avatarSvgType` に `"cyborg_officer" | "cyber_dog" | "think_tank" | "cyber_owl" | "cyber_fox"` を追加。
2. `frontend/src/data/humanPersonas.ts`:
   - `CYBERPUNK_PERSONAS` & `ANIMAL_PERSONAS` データセットを追加。
   - テーマ切替関数 `getHumanPersona(agentName, binaryCode, avatarTheme)` を構築。
3. `frontend/src/components/HumanAvatar.tsx`:
   - アバタータイプ別の高品質SVGレンダラー（Cyber Cyborg Major, Cyber Dog Hound, Tachikoma Tank, Cyber Owl, Cyber Fox）を実装。
4. `frontend/src/components/AutopoiesisGraphPanel.tsx`:
   - オートポイエーシス（作動的閉鎖）のリアルタイム視覚化コンポーネント：
     - **3条件達成率バー / ゲージ**: Node Participation, SCC Loop, Dual Code Activation.
     - **SCC 循環ループ・ビジュアルグラフ (Circulation Graph)**: 有向グラフの循環パスをアーク描画。
     - **自己再生産 活性度メーター**: 総合オートポイエーシス指数のライブメーター。
5. `frontend/src/App.tsx`:
   - アバターテーマ切り替えボタン（`サイバーパンク (攻殻風)` / `人間プロ` / `動物AI`）を追加。
   - メインパネルまたは分析エリアに `AutopoiesisGraphPanel` を統合。

## 検証戦略
- `verify.sh` による既存テストおよび新規コンポーネントテストの完全検証。
