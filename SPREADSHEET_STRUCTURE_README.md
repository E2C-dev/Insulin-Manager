# スプレッドシート形式のデータ構造

## 📊 スプレッドシート構造

画像のスプレッドシートに基づいた新しいデータ構造を実装しました。

### 列構成

| 日付 | 朝 | | | 昼 | | 夕 | | 眠前 | | |
|------|---|---|---|---|---|---|---|------|---|---|
| | **投与量** | 食前 | 食後1h | **投与量** | 食後1h | **投与量** | 食後1h | **投与量** | 睡眠時 | 夜間 |

### データ型

#### 投与タイミング（青背景）
```typescript
type InsulinTimeSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Bedtime';
```

#### 測定タイミング（白背景）
```typescript
type MeasurementTimeSlot = 
  | 'BreakfastBefore'  // 朝食前
  | 'BreakfastAfter1h' // 朝食後1h
  | 'LunchAfter1h'     // 昼食後1h
  | 'DinnerAfter1h'    // 夕食後1h
  | 'BeforeSleep'      // 睡眠時
  | 'Night';           // 夜間
```

## 🗄️ データベース

### insulin_entries（インスリン投与記録）
- id: UUID
- userId: UUID
- date: DATE
- timeSlot: TEXT (Breakfast, Lunch, Dinner, Bedtime)
- units: DECIMAL (投与量)
- note: TEXT
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP

### glucose_entries（血糖値測定記録）
- id: UUID
- userId: UUID
- date: DATE
- timeSlot: TEXT (BreakfastBefore, BreakfastAfter1h, etc.)
- glucoseLevel: INTEGER (mg/dL)
- note: TEXT
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP

## 🔌 API エンドポイント

### インスリン投与記録
- `GET /api/insulin-entries` - 一覧取得
- `POST /api/insulin-entries` - 作成
- `PUT /api/insulin-entries/:id` - 更新
- `DELETE /api/insulin-entries/:id` - 削除

### 血糖値測定記録
- `GET /api/glucose-entries` - 一覧取得
- `POST /api/glucose-entries` - 作成
- `PUT /api/glucose-entries/:id` - 更新
- `DELETE /api/glucose-entries/:id` - 削除

## 📝 使用例

### インスリン投与記録の作成
```json
POST /api/insulin-entries
{
  "date": "2025-01-15",
  "timeSlot": "Breakfast",
  "units": "43",
  "note": ""
}
```

### 血糖値測定記録の作成
```json
POST /api/glucose-entries
{
  "date": "2025-01-15",
  "timeSlot": "BreakfastBefore",
  "glucoseLevel": 80,
  "note": ""
}
```

## 🔄 移行状況

### ✅ 完了
- [x] データベーススキーマ作成
- [x] ストレージ層実装
- [x] API エンドポイント実装
- [x] 型定義更新

### 🚧 作業中
- [ ] フロントエンドページの更新
  - [ ] Dashboard（ダッシュボード）
  - [ ] Entry（入力ページ）
  - [ ] Logbook（記録ノート）
  - [ ] Settings（設定）

## 📊 1日の記録表示イメージ

```
日付: 2025/01/15 (Thu)

朝      昼      夕      眠前
43      36      37      13    ← 投与量（青背景）
80 190  160     150     80    ← 血糖値（白背景）
↑  ↑    ↑       ↑       ↑ ↑
食前 1h  1h      1h     睡眠 夜間
```

## 次のステップ

1. 新しいダッシュボードページの作成
2. スプレッドシート形式の入力フォーム作成
3. 既存ページの段階的な移行
