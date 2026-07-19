# Tech Spec: Ghost in the Shell HUD UI Theme Redesign

## コンテキスト
フロントエンドの既存のサイバーパンク配色を、攻殻機動隊（Section 9）の電脳・HUDをモチーフとしたデザイン（タクティカルオレンジ、スチールダークブルー、サイバーシアン）に刷新する。

## 目標 / 非目標
- **目標**:
  - Tailwind 設定のテーマカラーおよび CSS 内のグローバル色の更新。
  - ヘッダー部の電脳ネット接続風ステータス・文言の追加。
  - `NetworkGraph` に対するレーダースイープグリッドおよびスピニングターゲットブラケットの追加。
- **非目標**:
  - 新たな API 連携、コンポーネント構造の変更、またはロジックの大幅な改修。

## アーキテクチャ上の決定
- テーマカラーの同期:
  - `tailwind.config.js` の `cyberpunk` 設定ブロック内の `bg`、`panel`、`neon`、`accent`、`text` を変更。
  - これにより既存コンポーネントの Tailwind クラス（例: `text-cyberpunk-accent`）はそのまま利用し、表示される色のみを自動的にグリーンの代わりにオレンジやシアンに変えることで整合性を維持する。
- ハードコード色の変更:
  - `NetworkGraph.tsx`、`TimelineDots.tsx`、および `index.css` に記述されているハードコードされた緑色（`#39FF14` / `#39ff14`）および旧シアン色（`#00E5FF`）を、それぞれ新色の `#ff9d00` (オレンジ) および `#00f0ff` (シアン) に置換。

## データモデル・インメモリ状態設計
- なし（ロジックの変更はないため不変）。

## API・WebSocketプロトコル設計
- なし（不変）。

## コンポーネント構成 (React)
- **`frontend/src/index.css`**: body グラデーションおよび `.hud-panel` 角括弧を更新。
- **`frontend/tailwind.config.js`**: `cyberpunk` テーマ定義を更新。
- **`frontend/src/App.tsx`**: ヘッダー構成を Section 9 仕様に更新。
- **`frontend/src/components/NetworkGraph.tsx`**: SVG 背景に同心円・レーダースイープアニメーション、および現在発言者（`currentSpeaker`）ノードにターゲットブラケット表示用の SVG 要素群を追加。
- **`frontend/src/components/TimelineDots.tsx`**: 現在選択中のドット影のアクティブ色をオレンジに更新。

## Docker / コンテナ構成
- なし（不変）。

## 未解決の課題
- 特になし。
