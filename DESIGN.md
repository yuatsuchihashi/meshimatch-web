# MeshiMatch DESIGN v2 — 「Tino言語」ドラフト

_状態: **正式版**(2026-07-12 Kai承認「モックOK大正解」)。D1(トークン+共通コンポーネント)→D2(画面再スキン)で実装。機能変更なし。_

参照: Anastasia Golovko for Tino (dribbble 25595082 / 25578724)。
重心移動: 「かわいい寄り」→「**静かで上質、ときどき遊ぶ**」。

## 1. 色 — アクセント1色主義

```yaml
canvas:        "#F7F2EA"   # 温かいエクリュ(全画面の地。現行クリームより彩度を落とす)
canvas-deep:   "#EFE7DB"   # セクションの地・沈み込み面
greige:        "#E3D9CE"   # ヒーロー写真の背景帯・空状態イラスト地
surface:       "#FFFFFF"   # カード・チップの地
surface-soft:  "#FBF8F2"   # カード内のサブ面

ink:           "#221B16"   # 見出し・本文の墨(真っ黒禁止は維持。espressoをさらに深く)
muted:         "#8A7D72"   # 補足テキスト(暖グレー)
faint:         "#B5AA9E"   # 三次テキスト・プレースホルダ

accent:        "#F05A28"   # オレンジ。用途は「選択状態・主CTA・アクティブnav・ライブ状態ドット」のみ
accent-press:  "#D64A1E"

# 支援パステル(状態表示のみ。面積は小さく)
tint-sage:     "#E7EFD9"   # 営業中・ポジティブ (文字は #4F6B35)
tint-honey:    "#F8EEDA"   # 要確認・注意 (文字は #8A6A2F)
tint-blush:    "#FBE7DD"   # PR・アクセントの淡面 (文字は accent)

border:        "#EAE0D3"
shadow:        "0 2px 4px rgba(34,27,22,0.04), 0 12px 32px rgba(34,27,22,0.07)"
```

原則:
- **オレンジの全面塗りは廃止**(現行のオレンジヘッダー等)。地はエクリュ、情報は白カード、強調は墨。
- 真っ黒・純グレー・ネイビー禁止(v1から継承)。

## 2. タイプ

```yaml
family-quiet: "Zen Kaku Gothic New"   # 基本すべて。見出しも本文もこれ
family-play:  "Zen Maru Gothic"       # 「遊ぶ瞬間」専用: 回し打ちタイマー・チケットのスタンプ・完了演出
display: { size: 28px, weight: 800, line-height: 1.3, letter-spacing: -0.01em }
title:   { size: 20px, weight: 700, line-height: 1.35 }
body:    { size: 15px, weight: 400, line-height: 1.7 }
caption: { size: 12.5px, weight: 500 }
chip:    { size: 12px, weight: 700 }
```

- 大きく自信のある見出し × 小さなピルの対比。余白は現行の1.5倍を目安。

## 3. 形

```yaml
radius-pill:   999px    # チップ・ボタン・入力
radius-card:   24px     # 標準カード
radius-photo:  28px     # 写真カード
radius-input:  18px
icon-button:   { size: 44px, shape: circle, bg: surface, border: border }  # 戻る・通知・メニューは全て白い円
```

- **全部丸い**: 角のある要素を作らない。

## 4. コンポーネント文法

- **チップ(メタ情報の唯一の器)**: `[アイコン][短語]` のピル。理由バッジ・営業中/要確認・ゾーン・ジャンル・予算はすべてこれに統一。
  - default: surface地 + border、ink文字
  - selected: **accent塗り + 白文字**(選択状態はオレンジの専有)
  - state: tint-sage/honey/blush 地(営業中・要確認・PR)
- **ボタン**: 主CTA = accentピル(1画面1つまで)。副 = ink塗りピル or 白ピル+border。アイコンボタンは白円。
- **写真カード(お店)**: 写真フルブリード(radius-photo)+ 下部にグラデ無しの白パネル or 写真上のオーバーレイチップ。推薦者バッジ・営業中チップは写真の上に重ねる(travel参照の Select destination 文法)。
- **チケット**: 航空券半券を参照した本格半券。左に accent の縦タブ(MESHIMATCH)、ミシン目(破線+両端ノッチ)、`ADMIT / DATE / PLACE` の等幅ラベル行、下部に擬似バーコード。スタンプだけ family-play で遊ぶ。
- **タイマーリング(回し打ち)**: 円形カウントダウン(fitness の Set Timer 参照)。リングは accent、残り2秒で脈動。中央に大きな残秒。
- **ナビ**: 構成不変。アクティブのみ accent、非アクティブは faint のラインアイコン。

## 5. ホームの状態依存レイアウト(UX再構成・合意済み)

- **進行中ご飯会あり**: チケット(半券カード)を最上部に昇格。モード2枚(今すぐ/予定を組む)はその下にコンパクトなピル型2連ボタンに縮小。
- **進行中なし**: 「🍜 今すぐ」「📅 予定を組む」の大きな2枚カードがヒーロー。
- 別タブは作らない。過去のご飯会はグループ側アーカイブ(現行どおり)。

## 6. 移行の原則(Dストリーム)

- D1: 本トークン+共通コンポーネント(チップ/ボタン/カード/バッジ/ナビ)を実装し、既存クラスを差し替え可能にする
- D2: 画面単位の再スキン(ホーム状態依存化を含む)。**機能・データフローは一切変更しない**
- R4a/R4b(即時モード)は最初からこの言語で新規実装
