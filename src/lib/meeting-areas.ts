// Meeting candidates are grouped by city. They are selection labels, not
// guarantees about journey times, transport connections or restaurant coverage.
export const meetingCities = {
  tokyo: { label: '東京', currency: 'JPY' },
  buenosaires: { label: 'ブエノスアイレス', currency: 'ARS' },
} as const;

export type MeetingCityId = keyof typeof meetingCities;
export interface MeetingArea {
  id: string;
  label: string;
  cityId: MeetingCityId;
  discoveryAreaId: string;
}

export const meetingAreas: MeetingArea[] = [
  { id: 'shibuya', label: '渋谷', cityId: 'tokyo', discoveryAreaId: 'shibuya' },
  { id: 'shinjuku', label: '新宿', cityId: 'tokyo', discoveryAreaId: 'shinjuku' },
  { id: 'ikebukuro', label: '池袋', cityId: 'tokyo', discoveryAreaId: 'ikebukuro' },
  { id: 'ginza', label: '銀座', cityId: 'tokyo', discoveryAreaId: 'ginza' },
  { id: 'roppongi', label: '六本木', cityId: 'tokyo', discoveryAreaId: 'roppongi' },
  { id: 'ebisu', label: '恵比寿', cityId: 'tokyo', discoveryAreaId: 'ebisu' },
  { id: 'omotesando', label: '表参道', cityId: 'tokyo', discoveryAreaId: 'omotesando' },
  { id: 'shimokitazawa', label: '下北沢', cityId: 'tokyo', discoveryAreaId: 'shimokitazawa' },
  { id: 'kichijoji', label: '吉祥寺', cityId: 'tokyo', discoveryAreaId: 'kichijoji' },
  { id: 'ueno', label: '上野', cityId: 'tokyo', discoveryAreaId: 'ueno' },
  { id: 'marunouchi', label: '丸の内', cityId: 'tokyo', discoveryAreaId: 'marunouchi' },
  { id: 'kuramae', label: '蔵前', cityId: 'tokyo', discoveryAreaId: 'kuramae' },
  { id: 'buenosaires', label: '中心部', cityId: 'buenosaires', discoveryAreaId: 'buenosaires' },
  { id: 'palermo', label: 'パレルモ', cityId: 'buenosaires', discoveryAreaId: 'palermo' },
  { id: 'recoleta', label: 'レコレータ', cityId: 'buenosaires', discoveryAreaId: 'recoleta' },
  { id: 'puerto-madero', label: 'プエルトマデロ', cityId: 'buenosaires', discoveryAreaId: 'puerto-madero' },
  { id: 'san-telmo', label: 'サンテルモ', cityId: 'buenosaires', discoveryAreaId: 'san-telmo' },
];
