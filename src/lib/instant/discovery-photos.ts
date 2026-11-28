import type { DiscoveryMenu, DiscoveryPhoto, DiscoveryShop } from './discovery';

// Illustrations are deliberately separate from menu/dietary evidence. Live data
// can provide its own photos. Unrecognised dishes never get an unrelated image.
const dishCells: Record<string, [number, number]> = {
  'にぎり寿司': [1, 0], '野菜巻き寿司': [1, 1], '豚骨ラーメン': [1, 2], 'ピリ辛の野菜ラーメン': [1, 3],
  '牛焼肉セット': [1, 4], '鶏の塩焼きとご飯': [1, 5], 'ロースかつ定食': [1, 6], 'ひれかつ定食': [1, 6],
  'チーズピザ': [1, 7], '中辛の野菜ピザ': [1, 8], 'トマトパスタ': [1, 9], 'クリームパスタ': [1, 10],
  '和風きのこパスタ': [1, 11], '中辛の麻婆豆腐とご飯': [1, 12], '野菜炒飯': [1, 13],
  '辛口グリーンカレー': [1, 14], '中辛のチキンカレー': [1, 15],
  '豆のカレー': [2, 0], 'ビーフバーガー': [2, 1], '野菜バーガー': [2, 2],
  '牛ステーキとライス': [2, 3], 'ピリ辛牛ステーキ': [2, 3], '中辛の牛肉ボウル': [2, 4],
  '豆と野菜のボウル': [2, 5], '野菜と豆のボウル': [2, 6], '大きな野菜ボウルとご飯': [2, 6],
  'サラダ': [2, 7], 'ハンドドリップコーヒー': [2, 8], '紅茶': [2, 9],
  '季節のケーキ': [2, 10], '焼き菓子': [2, 11], '野菜サンド': [2, 12],
  '豚焼肉セット': [2, 13], '辛口の鶏焼きセット': [2, 14], 'ピリ辛の野菜ご飯': [2, 15],
};

export function menuPhoto(menu: DiscoveryMenu): DiscoveryPhoto | undefined {
  if (menu.photo) return menu.photo;
  if (menu.evidence.source !== 'synthetic-fixture') return undefined;
  const cell = dishCells[menu.name];
  if (!cell) return undefined;
  const [sheet, index] = cell;
  return {
    src: `/img/discovery/food-reference-${sheet}.webp`, kind: 'food', origin: 'ai-reference',
    alt: `${menu.name}のイメージ（AI生成）`,
    crop: { columns: 4, rows: 4, column: index % 4, row: Math.floor(index / 4), aspectRatio: sheet === 1 ? 4 / 3 : 3 / 2 },
  };
}

export function interiorPhotos(shop: DiscoveryShop): DiscoveryPhoto[] {
  const registered = shop.photos?.filter(photo => photo.kind === 'interior');
  if (registered?.length) return registered;
  if (!shop.menus.length || !shop.menus.every(menu => menu.evidence.source === 'synthetic-fixture')) return [];
  const index = ['green', 'bright', 'classic', 'modern'].indexOf(shop.style);
  if (index < 0) return [];
  return [{
    src: `/img/discovery/${shop.acceptsDrinkOnly ? 'cafe' : 'restaurant'}-interiors.webp`,
    kind: 'interior', origin: 'ai-reference', alt: '店内のイメージ（AI生成）',
    crop: { columns: 2, rows: 2, column: index % 2, row: Math.floor(index / 2), aspectRatio: 3 / 2 },
  }];
}
