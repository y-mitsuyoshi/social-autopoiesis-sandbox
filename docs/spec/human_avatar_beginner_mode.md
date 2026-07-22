# Tech Spec: ルーマンの社会システム理論・初心者向け解説 & リアル人間アバター対話UI/UX

## コンテキスト
ルーマンの社会システム理論は「コミュニケーションの作動的閉鎖」「二元コード」「構造的結合」など抽象度の高い概念に基づきます。一般ユーザーがシミュレーション画面を見た時に「誰が何を目的として発言し、なぜシステムが自律的に動いているのか」を一目で理解できるよう、フロントエンドのUI/UXを機能拡張します。

## 目標 / 非目標
- **目標**:
  1. 初心者モード（ELI5 Mode）を導入し、理論用語の日常語翻訳・1行要約・リアルタイムガイド（ルマン先生）を実装する。
  2. リアリスティックな人間アバター定義（役職・ポートレート・表情・カラー）および円卓対話ステージ（Roundtable Stage）を実装する。
  3. 発言時のリップシンク/音声波形アニメーション、思考インジケーター、アバター詳細モーダルを構築する。
  4. 全テスト（`pytest`, `vitest`, `tsc`, `eslint`, `ruff`, `mypy`）の100%グリーン維持。
- **非目標**:
  - バックエンドのシミュレーション計算エンジンのロジック変更（既存API仕様および二元コード評価アルゴリズムはそのまま維持する）。

## アーキテクチャ上の決定
- **人間ペルソナデータの標準化**:
  `frontend/src/data/humanPersonas.ts` にエージェント名・二元コードに応じたリアリスティック人間プロファイル（氏名、肩書、アバター背景、日常語コード解説、バイオ）を定義。
- **ELI5翻訳エンジンの純粋関数化**:
  `frontend/src/lib/eli5Translator.ts` を作成し、難解なテキストを1行の日常対話文に変換するルールベース翻訳ロジックをカプセル化。コンポーネント間で再利用。
- **円卓討論ステージ (RoundtableStage)**:
  `frontend/src/components/RoundtableStage.tsx` を新規作成。エージェントを視覚的にテーブルに配置し、アクティブ発言者のハイライト、波形エフェクト、吹出しトークをレンダリング。

## データモデル・インメモリ状態設計
- `types.ts`:
  ```typescript
  export interface HumanPersona {
    id: string;
    realName: string;
    roleTitle: string;
    avatarColor: string;
    avatarGradient: string;
    plainCodeExplanation: string;
    positiveMeaning: string;
    negativeMeaning: string;
    bio: string;
    avatarSvgType?: "lawyer" | "executive" | "scientist" | "politician" | "journalist" | "sociologist";
  }

  export type NetworkViewMode = "network" | "society" | "roundtable" | "timeline";
  ```
- `App.tsx` 状態拡張:
  - `eli5Mode: boolean` (default: `true` — 初心者に優しいデフォルト体験)
  - `selectedAvatarForModal: AgentNode | null`
  - `showLuhmannGuide: boolean`

## API・WebSocketプロトコル設計
- 既存の WebSocket / SSE データ構造を変更せず、フロントエンド側でリアルタイム受信した `Message` をリアルタイムで ELI5 要約化およびアバターアニメーションステートに変換。

## コンポーネント構成 (React)
- `frontend/src/data/humanPersonas.ts`: 人間アバターペルソナデータ
- `frontend/src/lib/eli5Translator.ts`: 専門用語・メッセージの日常語翻訳
- `frontend/src/components/HumanAvatar.tsx`: リアル人間風アバターコンポーネント
- `frontend/src/components/RoundtableStage.tsx`: 円卓討論対話ステージ
- `frontend/src/components/LuhmannTeacherPanel.tsx`: ルマン先生のやさしいライブ解説
- `frontend/src/components/AvatarDetailModal.tsx`: 人間アバター詳細カードモーダル
- `frontend/src/components/MessageBubble.tsx`: ELI5 要約バッジ対応
- `frontend/src/components/EducationalPanel.tsx`: ELI5 用語翻訳対応
- `frontend/src/App.tsx`: モード切り替え & ビュー統合

## Docker / コンテナ構成
- 既存の `docker-compose.yml` を利用。`./.shared-agents/harness/verify.sh` で Docker / ローカル両環境の動作確認を行う。

## 未解決の課題
- なし。既存テストスイートのモック構造と整合性を保ちながらUIを拡張。
