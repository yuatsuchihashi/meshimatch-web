import { AREA_CENTERS } from '../areas';
import { meetingCities, type MeetingCityId } from '../meeting-areas';

export interface DiscoveryCoordinates {
  lat: number;
  lng: number;
}
export interface DiscoveryArea {
  label: string;
  center: DiscoveryCoordinates;
  currency: string;
  priceAnchor: number;
}
export interface DiscoveryGenre {
  id: string;
  label: string;
  family: string;
  types: string[];
}
export interface DiscoveryPhoto {
  src: string;
  alt: string;
  kind: 'food' | 'interior';
  origin: 'ai-reference' | 'venue' | 'user';
  crop?: { columns: number; rows: number; column: number; row: number; aspectRatio: number };
}
export interface DiscoveryMenu {
  photo?: DiscoveryPhoto;
  id?: string;
  name: string;
  genreId: string | null;
  price: number;
  heat: number | null;
  portion: string | null;
  kind: string;
  category?: string;
  dietary: Record<string, boolean | null>;
  evidence: { status: string; source: string; checkedAt: string };
}
export interface DiscoveryShop {
  photos?: DiscoveryPhoto[];
  id: string;
  areaId: string;
  name: string;
  coordinates: DiscoveryCoordinates;
  currency: string;
  primaryType: string;
  types: string[];
  genreIds: string[];
  rating: number;
  reviewCount: number;
  acceptsDrinkOnly: boolean;
  noise: string;
  estimatedWaitMinutes?: number | null;
  style: string;
  menus: DiscoveryMenu[];
  atmosphereTags?: string[];
  seatCharge?: number;
  drinkRequired?: boolean;
}
export interface DiscoveryConfig {
  areaId: string;
  radius: number;
  mode: string;
  partySize: number;
}
export interface DiscoveryAnswer {
  need: string;
  genres: string[];
  priorities: string[];
  order: string[];
  noise: string;
  style: string;
  diet: string[];
  heat: string;
  budget: string;
  cafe?: CafePreferences;
  restaurant?: RestaurantPreferences;
}
export interface DiscoveryCandidate {
  shop: DiscoveryShop;
  choices: DiscoveryMenu[][];
  score: number;
  personScores?: (number | null)[];
  orders?: CafeOrder[][];
}

// Google Places types are reference identifiers. This demo makes no API requests.
export const genres: DiscoveryGenre[] = [
  { id: 'sushi', label: '寿司', family: '和食', types: ['sushi_restaurant'] },
  { id: 'ramen', label: 'ラーメン', family: '和食', types: ['ramen_restaurant'] },
  { id: 'yakiniku', label: '焼肉', family: '肉料理', types: ['yakiniku_restaurant'] },
  { id: 'yakitori', label: '焼き鳥', family: '肉料理', types: ['yakitori_restaurant'] },
  { id: 'tonkatsu', label: 'とんかつ', family: '肉料理', types: ['tonkatsu_restaurant'] },
  { id: 'pizza', label: 'ピザ', family: '洋食', types: ['pizza_restaurant'] },
  { id: 'pasta', label: 'パスタ', family: '洋食', types: [] },
  { id: 'chinese', label: '中華', family: 'アジア料理', types: ['chinese_restaurant'] },
  { id: 'thai', label: 'タイ料理', family: 'アジア料理', types: ['thai_restaurant'] },
  { id: 'indian', label: 'インド料理', family: 'アジア料理', types: ['indian_restaurant'] },
  { id: 'burger', label: 'ハンバーガー', family: '洋食', types: ['hamburger_restaurant'] },
  { id: 'steak', label: 'ステーキ', family: '肉料理', types: ['steak_house'] },
  { id: 'mexican', label: 'メキシコ料理', family: '各国料理', types: ['mexican_restaurant'] },
  { id: 'salad', label: 'サラダ・野菜料理', family: '野菜料理', types: ['salad_shop'] }
];
export const areas: Record<string, DiscoveryArea> = {
  shinjuku: { label: '新宿駅周辺', center: { lat: 35.6909, lng: 139.7003 }, currency: 'JPY', priceAnchor: 1500 },
  buenosaires: { label: 'ブエノスアイレス中心部', center: { lat: -34.6037, lng: -58.3816 }, currency: 'ARS', priceAnchor: 15000 },
  // Approximate prototype search anchors only. These do not provide journey
  // times, verified meeting points, live venue locations or transit routing.
  shibuya: { label: '渋谷駅周辺', center: AREA_CENTERS['渋谷'], currency: 'JPY', priceAnchor: 1500 },
  ikebukuro: { label: '池袋駅周辺', center: AREA_CENTERS['池袋'], currency: 'JPY', priceAnchor: 1500 },
  ginza: { label: '銀座駅周辺', center: AREA_CENTERS['銀座'], currency: 'JPY', priceAnchor: 1500 },
  roppongi: { label: '六本木駅周辺', center: AREA_CENTERS['六本木'], currency: 'JPY', priceAnchor: 1500 },
  ebisu: { label: '恵比寿駅周辺', center: AREA_CENTERS['恵比寿'], currency: 'JPY', priceAnchor: 1500 },
  omotesando: { label: '表参道駅周辺', center: AREA_CENTERS['表参道'], currency: 'JPY', priceAnchor: 1500 },
  shimokitazawa: { label: '下北沢駅周辺', center: AREA_CENTERS['下北沢'], currency: 'JPY', priceAnchor: 1500 },
  kichijoji: { label: '吉祥寺駅周辺', center: AREA_CENTERS['吉祥寺'], currency: 'JPY', priceAnchor: 1500 },
  ueno: { label: '上野駅周辺', center: AREA_CENTERS['上野'], currency: 'JPY', priceAnchor: 1500 },
  palermo: { label: 'パレルモ周辺', center: { lat: -34.5885, lng: -58.4307 }, currency: 'ARS', priceAnchor: 15000 },
  recoleta: { label: 'レコレータ周辺', center: { lat: -34.5893, lng: -58.3931 }, currency: 'ARS', priceAnchor: 15000 },
  'puerto-madero': { label: 'プエルトマデロ周辺', center: { lat: -34.6112, lng: -58.3631 }, currency: 'ARS', priceAnchor: 15000 },
  'san-telmo': { label: 'サンテルモ周辺', center: { lat: -34.6211, lng: -58.3736 }, currency: 'ARS', priceAnchor: 15000 },
  marunouchi: { label: '丸の内周辺', center: { lat: 35.681, lng: 139.764 }, currency: 'JPY', priceAnchor: 1500 },
  kuramae: { label: '蔵前駅周辺', center: { lat: 35.704, lng: 139.791 }, currency: 'JPY', priceAnchor: 1500 },
};
export const dietLabels: Record<string, string> = {
  vegetarian: 'ベジタリアン', vegan: 'ヴィーガン', halal: 'ハラール',
  glutenFree: 'グルテンフリー', porkFree: '豚肉不使用',
  cookingAlcoholFree: '調理酒不使用', reducedSalt: '減塩対応', kosher: 'コーシャ'
};
export const heatOptions: Record<string, string> = { '0': '辛くないものだけ', '1': 'ピリ辛まで', '2': '中辛まで', '3': '辛口まで' };
export const modes = ['食事', 'カフェ・軽食'];
export const priorityLabels: Record<string, string> = { price: '安い方がいい', distance: '近い方がいい', rating: '口コミ評価が高い方がいい' };
export const orderLabels: Record<string, string> = { drink: '飲み物', dessert: '甘いもの', light: '軽食' };
export const needLabels: Record<string, string> = { main: 'しっかり食事', cafe: '軽食・お茶', drink: '飲み物だけ', any: 'みんなに合わせる' };
export const noiseLabels: Record<string, string> = { quiet: '静か', moderate: 'ほどよい', lively: 'にぎやか' };
export const styleLabels: Record<string, string> = { green: '木と緑', bright: '明るい・自然光', classic: 'クラシック', modern: 'モダン' };

// Every mock recipe explicitly fills every dietary flag. null is reserved for unknown evidence.
const profiles: Record<string, string[]> = {
  plant: ['vegetarian', 'vegan', 'glutenFree', 'porkFree', 'cookingAlcoholFree', 'reducedSalt'],
  plantWheat: ['vegetarian', 'vegan', 'porkFree', 'cookingAlcoholFree', 'reducedSalt'],
  dairy: ['vegetarian', 'porkFree', 'cookingAlcoholFree'],
  fish: ['glutenFree', 'porkFree'],
  chicken: ['glutenFree', 'porkFree', 'cookingAlcoholFree'],
  beef: ['glutenFree', 'porkFree', 'cookingAlcoholFree'],
  beefWheat: ['porkFree', 'cookingAlcoholFree'],
  pork: ['cookingAlcoholFree'],
  certifiedPlant: Object.keys(dietLabels)
};
function recipe(name: string, genreId: string | null, price: number, profile: string, heat = 0, portion: string | null = 'main', kind = 'food'): DiscoveryMenu {
  return { name, genreId, price, heat, portion, kind,
    dietary: Object.fromEntries(Object.keys(dietLabels).map(key => [key, profiles[profile].includes(key)])),
    evidence: { status: 'confirmed', source: 'synthetic-fixture', checkedAt: '2026-11-22' }
  };
}
const recipes: Record<string, DiscoveryMenu[]> = {
  sushi: [recipe('にぎり寿司', 'sushi', 1800, 'fish'), recipe('野菜巻き寿司', 'sushi', 1100, 'plant')],
  ramen: [recipe('豚骨ラーメン', 'ramen', 1000, 'pork'), recipe('ピリ辛の野菜ラーメン', 'ramen', 1200, 'plantWheat', 1)],
  yakiniku: [recipe('牛焼肉セット', 'yakiniku', 2200, 'beef'), recipe('豚焼肉セット', 'yakiniku', 1600, 'pork')],
  yakitori: [recipe('鶏の塩焼きとご飯', 'yakitori', 1200, 'chicken'), recipe('辛口の鶏焼きセット', 'yakitori', 1500, 'chicken', 3)],
  tonkatsu: [recipe('ロースかつ定食', 'tonkatsu', 1400, 'pork'), recipe('ひれかつ定食', 'tonkatsu', 1800, 'pork')],
  pizza: [recipe('チーズピザ', 'pizza', 1500, 'dairy'), recipe('中辛の野菜ピザ', 'pizza', 1300, 'plantWheat', 2)],
  pasta: [recipe('トマトパスタ', 'pasta', 1300, 'plantWheat'), recipe('クリームパスタ', 'pasta', 1700, 'dairy')],
  chinese: [recipe('中辛の麻婆豆腐とご飯', 'chinese', 1100, 'pork', 2), recipe('野菜炒飯', 'chinese', 950, 'plant')],
  thai: [recipe('辛口グリーンカレー', 'thai', 1300, 'chicken', 3), recipe('ピリ辛の野菜ご飯', 'thai', 1150, 'plant', 1)],
  indian: [recipe('中辛のチキンカレー', 'indian', 1200, 'chicken', 2), recipe('豆のカレー', 'indian', 1000, 'plant')],
  burger: [recipe('ビーフバーガー', 'burger', 1400, 'beefWheat'), recipe('野菜バーガー', 'burger', 1250, 'plantWheat')],
  steak: [recipe('牛ステーキとライス', 'steak', 2800, 'beef'), recipe('ピリ辛牛ステーキ', 'steak', 2500, 'beef', 1)],
  mexican: [recipe('中辛の牛肉ボウル', 'mexican', 1400, 'beef', 2), recipe('豆と野菜のボウル', 'mexican', 1100, 'plant')],
  salad: [recipe('野菜と豆のボウル', 'salad', 1100, 'certifiedPlant', 0, 'light'), recipe('大きな野菜ボウルとご飯', 'salad', 1500, 'certifiedPlant')]
};
const cafeMenus: Record<string, DiscoveryMenu> = {
  coffee: { ...recipe('ハンドドリップコーヒー', null, 550, 'certifiedPlant', 0, null, 'drink'), category: 'coffee' },
  tea: { ...recipe('紅茶', null, 600, 'certifiedPlant', 0, null, 'drink'), category: 'tea' },
  cake: { ...recipe('季節のケーキ', null, 800, 'dairy', 0, null, 'dessert'), category: 'cake' },
  biscuit: { ...recipe('焼き菓子', null, 450, 'plantWheat', 0, null, 'dessert'), category: 'biscuit' },
  sandwich: { ...recipe('野菜サンド', null, 900, 'plantWheat', 0, 'light'), category: 'sandwich' },
  salad: { ...recipe('サラダ', 'salad', 950, 'plant', 0, 'light'), category: 'salad' }
};
const cafeMenuProfiles = [
  ['coffee', 'tea', 'cake', 'salad'],
  ['coffee', 'tea', 'biscuit', 'sandwich'],
  ['coffee', 'cake', 'biscuit', 'sandwich'],
  ['tea', 'cake', 'salad']
];
function mockShop(areaId: string, id: string, name: string, genreIds: string[], meters: number, bearing: number, priceFactor: number, rating: number, reviews: number, cafe = false, placeTypes?: string[]): DiscoveryShop {
  const area = areas[areaId];
  const radians = bearing * Math.PI / 180;
  const coordinates = {
    lat: area.center.lat + meters * Math.cos(radians) / 111195,
    lng: area.center.lng + meters * Math.sin(radians) / (111195 * Math.cos(area.center.lat * Math.PI / 180))
  };
  const rawMenus = genreIds.flatMap(genreId => recipes[genreId]);
  if (cafe) rawMenus.push(...cafeMenuProfiles[Number(id.replace(/\D/g, '')) % 4].map(key => cafeMenus[key]));
  const menus = rawMenus.map((menu, index) => ({ ...menu, id: id + '-m' + index,
    price: Math.round(menu.price * priceFactor * (area.currency === 'ARS' ? 10 : 1) / 10) * 10
  }));
  const types = placeTypes ? [...placeTypes] : [...new Set(genreIds.flatMap(genreId => genres.find(genre => genre.id === genreId)!.types))];
  if (!types.length) types.push('restaurant');
  if (cafe) types.push('cafe', 'coffee_shop');
  return { id, areaId, name, coordinates, currency: area.currency,
    primaryType: types[0], types, genreIds, rating, reviewCount: reviews,
    acceptsDrinkOnly: cafe, noise: Object.keys(noiseLabels)[Number(id.replace(/\D/g, '')) % 3],
    style: Object.keys(styleLabels)[Number(id.replace(/\D/g, '')) % 4],
    atmosphereTags: Number(id.replace(/\D/g, '')) % 4 === 0 ? ['green', 'bright'] : [Object.keys(styleLabels)[Number(id.replace(/\D/g, '')) % 4]],
    estimatedWaitMinutes: [0, 5, 10, 20, 30][Number(id.replace(/\D/g, '')) % 5],
    seatCharge: 0, drinkRequired: cafe && Number(id.replace(/\D/g, '')) % 2 === 0, menus
  };
}
// Additional areas use synthetic fixtures so the area questionnaire can hand off
// into restaurant/café discovery without an empty catalogue. Existing Shinjuku
// and Buenos Aires central fixtures below remain unchanged and in the same order.
const additionalAreaShops = Object.entries(areas)
  .filter(([id]) => id !== 'shinjuku' && id !== 'buenosaires')
  .flatMap(([areaId, area], index) => {
    const label = area.label.replace(/駅周辺$|周辺$/, '');
    const seed = 1000 + index * 10;
    const shopId = (offset: number) => `fixture-${areaId}-${seed + offset}`;
    const leadGenre = area.currency === 'JPY'
      ? ['yakitori', 'chinese', 'burger', 'sushi', 'tonkatsu', 'ramen'][index % 6]
      : ['steak', 'burger', 'sushi', 'yakitori'][index % 4];
    return [
      mockShop(areaId, shopId(1), `${label}の食卓（サンプル）`, [leadGenre], 180, 10, 1, 4.3, 160),
      mockShop(areaId, shopId(2), `${label}ピザとパスタ（サンプル）`, ['pizza', 'pasta'], 280, 65, .95, 4.4, 210, false, ['italian_restaurant', 'pizza_restaurant']),
      mockShop(areaId, shopId(3), `${label}グリーンテーブル（サンプル）`, ['salad'], 360, 140, .9, 4.2, 125, true),
      mockShop(areaId, shopId(4), `${label}木もれび喫茶（サンプル）`, [], 220, 210, 1, 4.5, 245, true),
      mockShop(areaId, shopId(5), `${label}小さな珈琲室（サンプル）`, [], 430, 280, .9, 4.3, 190, true),
      mockShop(areaId, shopId(6), `${label}豆とスパイス（サンプル）`, ['indian'], 480, 330, .95, 4.4, 175),
    ];
  });
// Fictional locations only. The two original areas still span all three radii.
export const discoveryShops: DiscoveryShop[] = [
  mockShop('shinjuku', 's01', 'すしの庭', ['sushi'], 180, 10, 1, 4.4, 260),
  mockShop('shinjuku', 's02', '麺のこみち', ['ramen'], 260, 45, .9, 4.2, 190),
  mockShop('shinjuku', 's03', '焼肉ひだまり', ['yakiniku'], 340, 90, 1, 4.5, 380),
  mockShop('shinjuku', 's04', '鳥とごはん', ['yakitori'], 420, 150, .95, 4.1, 120),
  mockShop('shinjuku', 's05', 'かつ日和', ['tonkatsu'], 460, 200, 1, 4.3, 210),
  mockShop('shinjuku', 's06', 'ピザの窓', ['pizza', 'pasta'], 380, 270, 1, 4.4, 175, false, ['italian_restaurant', 'pizza_restaurant']),
  mockShop('shinjuku', 's07', '中華つばめ', ['chinese'], 620, 30, .95, 4.2, 330),
  mockShop('shinjuku', 's08', 'タイの食卓', ['thai'], 720, 85, 1.05, 4.5, 240),
  mockShop('shinjuku', 's09', '豆とスパイス', ['indian'], 810, 145, .9, 4.3, 130),
  mockShop('shinjuku', 's10', 'バーガー小屋', ['burger'], 920, 210, 1.1, 4.1, 145),
  mockShop('shinjuku', 's11', '緑のテーブル', ['salad'], 300, 320, 1, 4.3, 95, true),
  mockShop('shinjuku', 's12', '光の喫茶室', [], 680, 280, .9, 4.5, 280, true),
  mockShop('shinjuku', 's13', '珈琲の書斎', [], 1300, 170, 1.2, 4.7, 620, true),
  mockShop('shinjuku', 's14', 'ステーキの丘', ['steak'], 1450, 250, 1, 4.6, 310),
  mockShop('shinjuku', 's15', 'トルティーヤ食堂', ['mexican'], 1700, 60, 1, 4.2, 110),
  mockShop('shinjuku', 's17', '庭先のティールーム', [], 480, 80, .85, 4.9, 420, true),
  mockShop('shinjuku', 's18', '路地の焼き菓子室', [], 850, 300, 1, 4.6, 290, true),
  {
    ...mockShop('shinjuku', 's19', '和風パスタ こはる', ['pasta'], 550, 120, 1, 4.4, 210, false, ['restaurant']),
    menus: recipes.pasta.map((menu, index) => ({ ...menu, id: 's19-m' + index,
      name: index === 0 ? 'きのこの和風パスタ' : 'きのこのクリームパスタ' })),
  },
  mockShop('shinjuku', 's16', 'すしと炭火', ['sushi', 'yakitori'], 1250, 345, .8, 4.0, 85),
  mockShop('buenosaires', 'b01', 'Patio Pizza', ['pizza', 'pasta'], 250, 20, 1, 4.5, 230, false, ['italian_restaurant', 'pizza_restaurant']),
  mockShop('buenosaires', 'b02', 'Mesa Parrilla', ['steak'], 350, 75, 1, 4.6, 400),
  mockShop('buenosaires', 'b03', 'Jardín Café', ['salad'], 160, 120, 1, 4.3, 130, true),
  mockShop('buenosaires', 'b04', 'Café de Luz', [], 430, 210, .9, 4.4, 175, true),
  mockShop('buenosaires', 'b05', 'Sushi del Sol', ['sushi'], 650, 260, 1.2, 4.5, 210),
  mockShop('buenosaires', 'b06', 'Casa Burger', ['burger'], 700, 330, 1, 4.2, 185),
  mockShop('buenosaires', 'b07', 'Mesa India', ['indian'], 760, 50, 1, 4.3, 160),
  mockShop('buenosaires', 'b08', 'Rincón Thai', ['thai'], 900, 140, 1.1, 4.1, 150),
  mockShop('buenosaires', 'b09', 'Café Biblioteca', [], 1300, 220, 1.1, 4.6, 380, true),
  mockShop('buenosaires', 'b10', 'Mesa China', ['chinese'], 1500, 280, .9, 4.2, 230),
  mockShop('buenosaires', 'b11', 'Patio Mexicano', ['mexican'], 1600, 10, 1, 4.4, 120),
  mockShop('buenosaires', 'b13', 'Café del Patio', [], 460, 45, .85, 4.8, 400, true),
  mockShop('buenosaires', 'b14', 'Dulce Rincón', [], 820, 190, 1, 4.5, 220, true),
  mockShop('buenosaires', 'b12', 'Fideos del Barrio', ['ramen'], 1800, 90, 1, 4.1, 90),
  ...additionalAreaShops,
];


export function freshAnswer(): DiscoveryAnswer {
  return { need: '', genres: [], priorities: [], order: [], noise: '', style: '', diet: [], heat: '', budget: '' };
}
export function distanceMeters(point: DiscoveryCoordinates, center: DiscoveryCoordinates): number {
  const rad = Math.PI / 180;
  const a = Math.sin((point.lat - center.lat) * rad / 2) ** 2 +
    Math.cos(point.lat * rad) * Math.cos(center.lat * rad) * Math.sin((point.lng - center.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function nearbyShops(config: DiscoveryConfig, shops: readonly DiscoveryShop[] = discoveryShops): DiscoveryShop[] {
  const area = areas[config.areaId];
  return shops.filter(shop => shop.areaId === config.areaId && distanceMeters(shop.coordinates, area.center) <= config.radius);
}
export function needFor(config: DiscoveryConfig, answer: DiscoveryAnswer): string {
  return config.mode === '食事' ? 'main' : config.mode === 'カフェ・軽食' ? 'cafe' : answer.need;
}
function fitsNeed(shop: DiscoveryShop, menu: DiscoveryMenu, need: string): boolean {
  if (need === 'main') return menu.kind === 'food' && menu.portion === 'main';
  if (need === 'drink') return menu.kind === 'drink' && shop.acceptsDrinkOnly;
  if (need === 'cafe') return (menu.kind === 'drink' && shop.acceptsDrinkOnly) || menu.kind === 'dessert' || menu.portion === 'light';
  return menu.kind !== 'drink' || shop.acceptsDrinkOnly;
}
export function menusFor(config: DiscoveryConfig, shop: DiscoveryShop, answer: DiscoveryAnswer): DiscoveryMenu[] {
  if (answer.cafe && ['cafe', 'drink', 'any'].includes(needFor(config, answer))) {
    return [...new Set(cafeOrdersFor(config, shop, answer).flatMap(order => order.menus))];
  }
  return shop.menus.filter(menu => fitsNeed(shop, menu, needFor(config, answer)) &&
    (!answer.budget || menu.price <= Number(answer.budget)) &&
    (answer.heat === '' || (Number.isFinite(menu.heat) && menu.heat !== null && menu.heat <= Number(answer.heat))) &&
    answer.diet.every(key => menu.evidence.status === 'confirmed' && menu.dietary[key] === true));
}
function hasGenre(shop: DiscoveryShop, menu: DiscoveryMenu, genreId: string): boolean {
  // Both a store classification and a matching dish are necessary to earn a genre match.
  return shop.genreIds.includes(genreId) && menu.genreId === genreId;
}
export function availableGenres(config: DiscoveryConfig, answer: DiscoveryAnswer): DiscoveryGenre[] {
  return genres.filter(genre => nearbyShops(config).some(shop => menusFor(config, shop, answer).some(menu => hasGenre(shop, menu, genre.id))));
}
export function firstGenres(available: DiscoveryGenre[]): DiscoveryGenre[] {
  // Round-robin across families avoids filling all six slots with a single family.
  const families = [...new Set(available.map(genre => genre.family))];
  const queues = families.map(family => available.filter(genre => genre.family === family));
  const ordered = [];
  while (queues.some(queue => queue.length)) {
    for (const queue of queues) if (queue.length) ordered.push(queue.shift()!);
  }
  return ordered.slice(0, 6);
}
function orderMatches(menu: DiscoveryMenu, order: string[]): boolean {
  return order.some(value => value === 'light' ? menu.kind === 'food' && menu.portion === 'light' : menu.kind === value);
}
export function scoreMenu(config: DiscoveryConfig, shop: DiscoveryShop, menu: DiscoveryMenu, answer: DiscoveryAnswer): number | null {
  const dimensions = [];
  if (answer.genres.length) dimensions.push(Number(answer.genres.some(id => hasGenre(shop, menu, id))));
  if (answer.order.length) dimensions.push(Number(orderMatches(menu, answer.order)));
  if (answer.priorities.includes('price')) dimensions.push(1 / (1 + menu.price / areas[config.areaId].priceAnchor));
  if (answer.priorities.includes('distance')) dimensions.push(1 / (1 + distanceMeters(shop.coordinates, areas[config.areaId].center) / 700));
  if (answer.priorities.includes('rating')) dimensions.push(shop.rating / 5);
  if (answer.noise) dimensions.push(Number(shop.noise === answer.noise));
  if (answer.style) dimensions.push(Number(shop.style === answer.style));
  return dimensions.length ? dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length : null;
}
export function rankShops(config: DiscoveryConfig, answers: DiscoveryAnswer[], shops: readonly DiscoveryShop[] = discoveryShops): DiscoveryCandidate[] {
  if (!answers.length) return [];
  const candidates: DiscoveryCandidate[] = [];
  for (const shop of nearbyShops(config, shops)) {
    const choices = answers.map(answer => menusFor(config, shop, answer));
    if (choices.some(menus => !menus.length)) continue;
    const orders = answers.map(answer => answer.cafe ? cafeOrdersFor(config, shop, answer) : []);
    const personScores = choices.map((menus, index) => {
      const answer = answers[index];
      const scores = answer.cafe
        ? orders[index].map(order => scoreCafeOrder(config, shop, order, answer))
        : menus.map(menu => answer.restaurant ? scoreRestaurantMenu(config, shop, menu, answer) : scoreMenu(config, shop, menu, answer));
      const known = scores.filter((score): score is number => score !== null);
      return known.length ? Math.max(...known) : null;
    });
    const activeScores = personScores.filter((score): score is number => score !== null);
    const score = activeScores.length ? activeScores.reduce((sum, value) => sum + value, 0) / activeScores.length : 0;
    candidates.push({ shop, choices, score, personScores, orders });
  }
  return candidates.sort((a, b) => b.score - a.score ||
    distanceMeters(a.shop.coordinates, areas[config.areaId].center) - distanceMeters(b.shop.coordinates, areas[config.areaId].center) || a.shop.id.localeCompare(b.shop.id));
}

export function formatDiscoveryPrice(config: DiscoveryConfig, price: number): string {
  return price.toLocaleString('ja-JP') + (areas[config.areaId].currency === 'JPY' ? '円' : ' ARS');
}

export function resolveDiscoveryAgreement(candidateIds: string[], votes: string[][], partySize: number): string | null {
  if (votes.length !== partySize) return null;
  return candidateIds.find(id => votes.every(ballot => ballot.includes(id))) ?? null;
}


export const cafeDetailLabels: Record<string, Record<string, string>> = {
  drink: { coffee: 'コーヒー', tea: '紅茶' },
  dessert: { cake: 'ケーキ', biscuit: '焼き菓子' },
  light: { sandwich: 'サンドイッチ', salad: 'サラダ' },
  atmosphere: styleLabels
};
export const cafePlanLabels: Record<string, string> = {
  onsite: 'まだ決めない', drink: '食べ物なし',
  'drink-dessert': 'スイーツも頼む', 'drink-light': '軽食も頼む'
};
export interface CafePreferences {
  foodDecision?: 'unspecified' | 'selected' | 'onsite' | 'none';
  interests: string[];
  details: Record<string, string[]>;
  undecided: string[];
  important: string[];
  plan: string;
}
export interface CafeOrder { menus: DiscoveryMenu[]; total: number; label: string }
export type CafeReaction = 'yes' | 'more' | 'no';
export interface CafeFeedback { shopId: string; status: CafeReaction; reason?: string }
export const cafeReasonLabels: Record<string, string> = {
  menu: 'メニューが合わない', atmosphere: '雰囲気が違う', price: '予算感が合わない',
  distance: '遠い', other: 'その他'
};
export function freshCafePreferences(): CafePreferences {
  return { interests: [], details: {}, undecided: [], important: [], plan: 'onsite' };
}

export function cafeOrdersFor(config: DiscoveryConfig, shop: DiscoveryShop, answer: DiscoveryAnswer): CafeOrder[] {
  const need = needFor(config, answer);
  if (!shop.acceptsDrinkOnly && need !== 'any') return [];
  const eligible = shop.menus.filter(menu => fitsNeed(shop, menu, need) &&
    (answer.heat === '' || (menu.heat !== null && menu.heat <= Number(answer.heat))) &&
    answer.diet.every(key => menu.evidence.status === 'confirmed' && menu.dietary[key] === true));
  const drinks = eligible.filter(menu => menu.kind === 'drink');
  const foods = eligible.filter(menu => menu.kind !== 'drink');
  const plan = need === 'drink' ? 'drink' : answer.cafe?.plan ?? 'onsite';
  const combinations: DiscoveryMenu[][] = [];
  if (plan === 'drink' || plan === 'onsite') combinations.push(...drinks.map(menu => [menu]));
  if (plan === 'onsite' && !shop.drinkRequired) combinations.push(...foods.map(menu => [menu]));
  if (plan !== 'drink') {
    const allowedFoods = foods.filter(menu => plan === 'onsite' ||
      (plan === 'drink-dessert' && menu.kind === 'dessert') ||
      (plan === 'drink-light' && menu.kind === 'food' && menu.portion === 'light'));
    for (const drink of drinks) for (const food of allowedFoods) combinations.push([drink, food]);
  }
  return combinations.map(menus => ({ menus, total: menus.reduce((sum, menu) => sum + menu.price, shop.seatCharge ?? 0),
    label: menus.map(menu => menu.name).join('＋')
  })).filter(order => !answer.budget || order.total <= Number(answer.budget));
}

// Prototype weights. They preserve weak interests across participants; user trials will calibrate trade-offs.
const NICE_PREFERENCE_WEIGHT = 0.2;
export function scoreCafeOrder(config: DiscoveryConfig, shop: DiscoveryShop, order: CafeOrder, answer: DiscoveryAnswer): number | null {
  const cafe = answer.cafe;
  if (!cafe) return null;
  const keys = [...new Set([...cafe.interests, ...cafe.important])];
  if (!keys.length) return null;
  let total = 0;
  let weights = 0;
  for (const key of keys) {
    const weight = cafe.important.includes(key) ? 1 : NICE_PREFERENCE_WEIGHT;
    const details = cafe.details[key] ?? [];
    let value = 0;
    if (Object.hasOwn(venuePreferenceLabels, key)) {
      const score = venuePreferenceScore(key, config, shop, order.total, details);
      if (score === null) continue;
      value = score;
    }
    else value = Number(order.menus.some(menu => {
      const kindMatches = key === 'light' ? menu.kind === 'food' && menu.portion === 'light' : menu.kind === key;
      return kindMatches && (!details.length || details.includes(menu.category ?? ''));
    }));
    // An undecided atmosphere has no known direction until the visitor sees a candidate.
    if (key === 'atmosphere' && !details.length) continue;
    weights += weight;
    total += weight * value;
  }
  if (!weights) return null;
  const strength = cafe.important.some(key => key !== 'atmosphere' || (cafe.details.atmosphere?.length ?? 0) > 0) ? 1 : NICE_PREFERENCE_WEIGHT;
  return total / weights * strength;
}

export function selectDiscoveryShortlist(candidates: DiscoveryCandidate[], seenIds: readonly string[] = []): DiscoveryCandidate[] {
  const remaining = candidates.filter(candidate => !seenIds.includes(candidate.shop.id));
  if (remaining.length <= 3) return remaining;
  const selected = [remaining[0]];
  const minimumScore = (candidate: DiscoveryCandidate) => {
    const scores = (candidate.personScores ?? []).filter((score): score is number => score !== null);
    return scores.length ? Math.min(...scores) : 0;
  };
  const compromise = [...remaining].sort((a, b) => minimumScore(b) - minimumScore(a) || b.score - a.score)
    .find(candidate => candidate.shop.id !== selected[0].shop.id)!;
  selected.push(compromise);
  const alternatives = remaining.filter(candidate => !selected.includes(candidate));
  const restaurantOnly = remaining.every(candidate => !(candidate.orders ?? []).some(orders => orders.length));
  const diversity = (candidate: DiscoveryCandidate) => selected.reduce((sum, prior) => {
    if (restaurantOnly) return sum + Number(prior.shop.noise !== candidate.shop.noise) +
      Number(!prior.shop.genreIds.some(id => candidate.shop.genreIds.includes(id)));
    return sum + Number(prior.shop.style !== candidate.shop.style) +
      Number(prior.shop.menus.some(menu => menu.category === 'cake') !== candidate.shop.menus.some(menu => menu.category === 'cake'));
  }, 0);
  alternatives.sort((a, b) => diversity(b) - diversity(a) || b.score - a.score);
  selected.push(alternatives[0]);
  return selected;
}

export function refineDiscoveryAnswers(answers: DiscoveryAnswer[], feedback: CafeFeedback[][]): DiscoveryAnswer[] {
  return answers.map((answer, index) => {
    const priorities = (feedback[index] ?? []).filter(item => item.status === 'no')
      .flatMap(item => item.reason === 'distance' ? ['distance'] : item.reason === 'price' ? ['price'] : item.reason === 'wait' ? ['wait'] : []);
    if (answer.cafe) return { ...answer, cafe: { ...answer.cafe, important: [...new Set([...answer.cafe.important, ...priorities])] } };
    if (answer.restaurant) return { ...answer, restaurant: { ...answer.restaurant, important: [...new Set([...answer.restaurant.important, ...priorities])] } };
    return answer;
  });
}

export interface RestaurantGenre extends DiscoveryGenre {
  matchSource: 'place_type' | 'menu';
  dishIds: string[];
}
export interface RestaurantPreferences {
  noisePreferences?: string[];
  genres: string[];
  details: Record<string, string[]>;
  important: string[];
  styles: string[];
  undecided: string[];
}

// Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
// Place categories and dish availability are independent. Pasta is a menu signal,
// which does not classify a Japanese-style pasta shop as an Italian restaurant.
export const restaurantGenres: RestaurantGenre[] = [
  { id: 'italian', label: 'イタリアン', family: '洋食', types: ['italian_restaurant'],
    dishIds: ['pizza', 'pasta'], matchSource: 'place_type' },
  ...genres.map(genre => ({ ...genre, dishIds: [genre.id],
    matchSource: genre.id === 'pasta' ? 'menu' as const : 'place_type' as const })),
];
export const restaurantVenuePreferenceLabels: Record<string, string> = {
  noise: '落ち着き・にぎやかさ', wait: '待ち時間の短さ',
  rating: '口コミ評価', distance: '集合エリアの中心から近い', price: '価格',
};
export const venuePreferenceLabels: Record<string, string> = {
  atmosphere: '好きな雰囲気', rating: '評判のよさ', distance: '集合エリアの中心から近い', price: '価格',
};
export function freshRestaurantPreferences(): RestaurantPreferences {
  return { genres: [], details: {}, important: [], styles: [], undecided: [], noisePreferences: [] };
}
export function surveyCurrency(config: DiscoveryConfig, pendingCity?: MeetingCityId): string {
  return pendingCity ? meetingCities[pendingCity].currency : areas[config.areaId].currency;
}

export function availableRestaurantGenres(
  config: DiscoveryConfig, answer: DiscoveryAnswer, areaIds: readonly string[] = [config.areaId],
): RestaurantGenre[] {
  const available = new Set<RestaurantGenre>();
  for (const areaId of new Set(areaIds)) {
    if (!Object.hasOwn(areas, areaId)) continue;
    const areaConfig = { ...config, areaId };
    for (const shop of nearbyShops(areaConfig)) {
      const menus = menusFor(areaConfig, shop, answer);
      for (const genre of restaurantGenres) {
        if (matchesRestaurantType(shop, genre) && menus.some(menu => genre.dishIds.some(id => hasGenre(shop, menu, id)))) {
          available.add(genre);
        }
      }
    }
  }
  return restaurantGenres.filter(genre => available.has(genre));
}
function restaurantDishMatches(shop: DiscoveryShop, menu: DiscoveryMenu, genre: RestaurantGenre, preferences: RestaurantPreferences): boolean {
  if (!matchesRestaurantType(shop, genre)) return false;
  const details = preferences.details[genre.id] ?? [];
  return (details.length ? details : genre.dishIds).some(id => hasGenre(shop, menu, id));
}
export function scoreRestaurantMenu(config: DiscoveryConfig, shop: DiscoveryShop, menu: DiscoveryMenu, answer: DiscoveryAnswer): number | null {
  const preferences = answer.restaurant;
  if (!preferences) return null;
  const chosen = restaurantGenres.filter(genre => preferences.genres.includes(genre.id));
  let total = 0;
  let weights = 0;
  if (chosen.length) {
    weights += chosen.some(genre => preferences.important.includes(genre.id)) ? 1 : NICE_PREFERENCE_WEIGHT;
    // Selected genres are acceptable alternatives, so a single matched choice is enough.
    total += Math.max(...chosen.map(genre => restaurantDishMatches(shop, menu, genre, preferences)
      ? preferences.important.includes(genre.id) ? 1 : NICE_PREFERENCE_WEIGHT : 0));
  }
  for (const key of preferences.important.filter(key => Object.hasOwn(restaurantVenuePreferenceLabels, key))) {
    const value = venuePreferenceScore(key, config, shop, menu.price, preferences.styles, preferences.noisePreferences ?? []);
    if (value === null) continue;
    total += value;
    weights += 1;
  }
  if (!weights) return null;
  const strongFood = chosen.some(genre => preferences.important.includes(genre.id));
  const strongVenue = preferences.important.some(key => Object.hasOwn(restaurantVenuePreferenceLabels, key) &&
    (key !== 'noise' || (preferences.noisePreferences?.length ?? 0) > 0));
  return total / weights * (strongFood || strongVenue ? 1 : NICE_PREFERENCE_WEIGHT);
}

function venuePreferenceScore(key: string, config: DiscoveryConfig, shop: DiscoveryShop, price: number, styles: string[], noisePreferences: string[] = []): number | null {
  if (key === 'noise') return noisePreferences.length ? Number(noisePreferences.includes(shop.noise)) : null;
  if (key === 'wait') return shop.estimatedWaitMinutes == null ? null : 1 / (1 + shop.estimatedWaitMinutes / 10);
  if (key === 'atmosphere') return styles.length
    ? Number(styles.some(tag => (shop.atmosphereTags ?? [shop.style]).includes(tag))) : null;
  if (key === 'rating') {
    const adjustedRating = adjustedReviewRating(shop.rating, shop.reviewCount);
    return Math.max(0, Math.min(1, (adjustedRating - 3.5) / 1.5));
  }
  if (key === 'distance') return 1 / (1 + distanceMeters(shop.coordinates, areas[config.areaId].center) / 700);
  if (key === 'price') return 1 / (1 + price / areas[config.areaId].priceAnchor);
  return null;
}

function matchesRestaurantType(shop: DiscoveryShop, genre: RestaurantGenre): boolean {
  return genre.matchSource === 'menu' || genre.types.some(type => shop.types.includes(type));
}
export function restaurantGenreLabels(shop: DiscoveryShop): string[] {
  return restaurantGenres.filter(genre => matchesRestaurantType(shop, genre) &&
    genre.dishIds.some(id => shop.genreIds.includes(id))).map(genre => genre.label);
}

// Prototype prior only; these constants require calibration against actual choices.
const REVIEW_PRIOR_RATING = 4.2;
const REVIEW_PRIOR_COUNT = 30;
export function adjustedReviewRating(rating: number, reviewCount: number): number {
  return (rating * reviewCount + REVIEW_PRIOR_RATING * REVIEW_PRIOR_COUNT) / (reviewCount + REVIEW_PRIOR_COUNT);
}

export const restaurantNoiseLabels: Record<string, string> = {
  quiet: '静かで落ち着いた店', moderate: 'ほどよく活気のある店', lively: 'にぎやかに楽しめる店',
};
export const restaurantReasonLabels: Record<string, string> = {
  menu: 'メニューが合わない', noise: '落ち着き・にぎやかさが合わない',
  wait: '待ち時間が気になる', price: '予算感が合わない', distance: '遠い', other: 'その他',
};
