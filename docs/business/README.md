# インスリア ビジネス運用ハブ

> エージェントチームとの協働・ディスカッション・意思決定を一元管理するディレクトリ

---

## このディレクトリの目的

インスリアのプロダクト開発・マーケティング・戦略に関する議論と実行管理を、エージェントチームが円滑に行えるよう整備したナレッジ・ワーキングスペースです。

---

## ディレクトリ構成

```
docs/business/
├── README.md               ← 今ここ（全体ナビゲーション）
│
├── brand/                  ← ブランド・アイデンティティ
│   └── insuria_brand.md    # ブランドガイドライン、トーン＆マナー
│
├── marketing/              ← マーケティング戦略・運用
│   ├── README.md           # マーケティング全体概要
│   ├── sns/                # SNS運用
│   │   ├── instagram.md    # Instagram戦略・投稿ガイド
│   │   └── twitter.md      # Twitter/X戦略・運用ガイド
│   ├── seo/                # SEO戦略
│   │   └── keywords.md     # キーワード一覧・優先度
│   └── content/            # コンテンツ企画
│       └── calendar.md     # コンテンツカレンダー
│
├── landing_page/           ← LPの設計・開発・改善
│   ├── README.md           # LP戦略・KPI
│   ├── structure/          # LP構成設計
│   │   └── current.md      # 現在のLP構成・セクション定義
│   └── copy/               # コピーライティング
│       └── draft.md        # コピー草案・バリエーション
│
├── roadmap/                ← 今後の展開・フェーズ計画
│   ├── README.md           # ロードマップ全体概要
│   ├── phase1_2026Q1.md    # Phase 1（3〜5月）
│   ├── phase2_2026Q2.md    # Phase 2（6〜8月）
│   ├── phase3_2026Q3.md    # Phase 3（9〜11月）
│   └── phase4_2026Q4.md    # Phase 4（12月〜2月）
│
└── discussions/            ← ディスカッション・意思決定ログ
    ├── README.md           # ディスカッションの進め方・ルール
    ├── templates/
    │   └── discussion_template.md  # ディスカッション記録テンプレート
    └── 2026-02/            # 月別ディスカッション
        └── （新しいトピックをここに追加）
```

---

## 既存の戦略ドキュメントとの関係

`docs/strategy/` には確定済みの戦略文書があります。こちらは**リファレンス（参照元）**として活用してください。

| ファイル | 内容 | リンク |
|---------|------|--------|
| 01_vision_mission.md | ミッション・ビジョン・バリュー | [→](../strategy/01_vision_mission.md) |
| 02_financial_model.md | 財務モデル・収益予測 | [→](../strategy/02_financial_model.md) |
| 03_gtm_strategy.md | Go-to-Market戦略 | [→](../strategy/03_gtm_strategy.md) |
| 04_development_roadmap.md | 開発ロードマップ（詳細版） | [→](../strategy/04_development_roadmap.md) |

---

## エージェントチームへのガイド

### タスクを受けたら最初にここを確認

1. **新機能・改善提案** → `roadmap/` の該当フェーズを確認
2. **マーケティング施策** → `marketing/README.md` から開始
3. **LP改善** → `landing_page/README.md` → `structure/current.md`
4. **ブランドに関わる作業** → `brand/insuria_brand.md` でトーンを確認
5. **意思決定・議論が必要** → `discussions/` に新しいファイルを作成

### ファイル更新ルール

- **既存ファイルを更新** する場合は、変更前に `---` で区切り、更新日・更新者（エージェント名）を記載
- **新しいディスカッション** は `discussions/YYYY-MM/TOPIC.md` に作成
- **決定事項** は各ドキュメントの「決定済み事項」セクションに転記

---

## クイックリファレンス

| 知りたいこと | 見るべきファイル |
|------------|----------------|
| インスリアのブランドトーン | [brand/insuria_brand.md](brand/insuria_brand.md) |
| 今月のSNS投稿テーマ | [marketing/content/calendar.md](marketing/content/calendar.md) |
| LPの現在の構成 | [landing_page/structure/current.md](landing_page/structure/current.md) |
| 今フォーカスすべきフェーズ | [roadmap/README.md](roadmap/README.md) |
| 進行中のディスカッション | [discussions/README.md](discussions/README.md) |

---

*最終更新: 2026-02-25*
