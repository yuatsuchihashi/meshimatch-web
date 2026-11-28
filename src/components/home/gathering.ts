import type { DiscoveryShop } from '@/lib/instant/discovery';
import type { AreaPoll } from '@/lib/area-poll';
import { meetingAreas, meetingCities, type MeetingCityId } from '@/lib/meeting-areas';
import { canConfirmDate, completedResponses, dateLabel, periodLabel, type SchedulePoll } from '@/lib/schedule';
import { shouldFindShop } from '@/lib/shop-plan';
import type { ShopPoll } from '@/lib/shop-poll';

export type DeviceRecord = { host: boolean; ids: string[] };
export type Gathering = {
  id: string; schedule?: SchedulePoll; area?: AreaPoll; shop?: ShopPoll;
  dateMember: DeviceRecord; areaMember: DeviceRecord; shopMember?: DeviceRecord;
};
export const noMember: DeviceRecord = { host: false, ids: [] };
type Action = { href: string; label: string; detail: string; venue?: DiscoveryShop };
export function gatheringAction({ schedule, area, shop, dateMember, areaMember, shopMember }: Gathering): Action {
  const datePath = schedule ? '/schedule/' + schedule.id : '';
  const areaPath = area ? '/area/' + area.id : '';
  const publicPath = (datePath || areaPath) + '?view=results';
  const datePeople = schedule?.responses.filter(person => dateMember.ids.includes(person.id)) ?? [];
  const own = datePeople.length === 1 ? datePeople[0] : undefined;
  const selectedDate = schedule?.selectedOptionId;
  const attends = !selectedDate || !datePeople.length || datePeople.some(person => person.answers[selectedDate] === 'yes');
  const multiple = datePeople.length > 1 || (area?.responses.filter(person => areaMember.ids.includes(person.id)).length ?? 0) > 1;
  const placeReplies = area?.responses.length ?? 0;
  const canAnswerPlace = Boolean(area && !area.selectedAreaId && placeReplies < area.expectedCount &&
    !area.responses.some(response => areaMember.ids.includes(response.id) || response.id === own?.id) &&
    (!area.attendanceBased || own && (selectedDate ? attends : Object.values(own.answers).some(value => value !== 'no'))));
  if (!attends && !dateMember.host) return { href: publicPath, label: '日程を確認する', detail: '今回は参加予定に含まれていません' };
  const findShop = shouldFindShop(schedule, area);
  if (schedule && !selectedDate && dateMember.host && schedule.options.some(option => canConfirmDate(schedule, option.id))) {
    return { href: publicPath, label: '日程を決める', detail: '決定できる候補日があります' };
  }
  if (area && !area.selectedAreaId && (!schedule || selectedDate) && areaMember.host && placeReplies === area.expectedCount) {
    return { href: areaPath + '?view=results', label: 'エリアの候補を確認する', detail: '場所の回答がそろいました' };
  }
  if (schedule && !selectedDate) {
    if (schedule.placePlan === 'adjust' && !area && !schedule.areaPollId && dateMember.host) return { href: '/instant?schedule=' + schedule.id, label: '場所のアンケートを用意する', detail: '候補日を保存しました' };
    if (!multiple && ((!own && schedule.responses.length < schedule.expectedCount) || own && schedule.options.some(option => !own.answers[option.id]))) return { href: datePath + '?view=answer', label: own ? '日程の回答を更新する' : '日程に回答する', detail: own ? '未回答の日程候補があります' : '候補日への○・△・×を入力' };
  }
  if (shop && findShop && shop.pendingArea) {
    const member = shop.source === 'area' ? areaMember : dateMember;
    const voters = shop.participants.filter(person => member.ids.includes(person.id));
    const topic = shop.config.mode === '食事' ? 'レストラン' : 'カフェ';
    if (voters.some(person => !person.answered)) return { href: '/shop/' + shop.id,
      label: voters.length > 1 ? '回答する人を選ぶ' : topic + 'の希望に回答する', detail: '場所の回答は保存済みです' };
    if (voters.length) return { href: '/shop/' + shop.id, label: '回答状況を見る',
      detail: topic + 'の希望は回答済みです。集合エリアの決定を待っています' };
  }
  if (shop && findShop && !shop.pendingArea) {
    const shopPath = '/shop/' + shop.id;
    const final = shop.candidates.find(candidate => candidate.shopId === shop.selectedShopId)?.shop;
    if (final) return { href: shopPath, label: '決まったお店を見る', detail: final.name, venue: final };
    const member = shop.source === 'standalone' ? shopMember ?? noMember : shop.source === 'area' ? areaMember : dateMember;
    const voters = shop.participants.filter(person => member.ids.includes(person.id));
    const count = shop.participants.filter(person => person.answered).length;
    const progress = `お店の希望　${count} / ${shop.config.partySize}人が回答`;
    if (shop.source === 'standalone' && member.host && !voters.length && count < shop.config.partySize) {
      return { href: shopPath, label: '招待・自分の回答へ', detail: progress };
    }
    if (voters.some(person => !person.answered)) return {
      href: shopPath,
      label: voters.length > 1 ? '回答する人を選ぶ' : 'お店の希望に回答する',
      detail: progress,
    };
    if (count === shop.config.partySize) return { href: shopPath,
      label: shop.candidates.length ? (member.host ? 'お店を決める' : '候補のお店を見る') : '条件を確認する',
      detail: shop.candidates.length ? `お店の候補が${shop.candidates.length}件あります` : '全員の条件に合うお店がありません' };
    return { href: shopPath, label: 'お店の回答状況を見る', detail: progress };
  }
  if (area && !area.selectedAreaId) {
    if (canAnswerPlace && !multiple && (!schedule || own || !area.attendanceBased)) return { href: areaPath + '?view=answer' + (own ? '&person=' + encodeURIComponent(own.id) : ''), label: '場所に回答する', detail: '集まる場所の希望を教えてください' };
    if (!schedule || selectedDate) return { href: areaPath + '?view=results', label: '場所の回答状況を見る', detail: `場所　${placeReplies} / ${area.expectedCount}人が回答` };
  }
  if (schedule && !selectedDate) return { href: publicPath, label: '日程の回答状況を見る', detail: `日程　${completedResponses(schedule)} / ${schedule.expectedCount}人が回答` };
  if (findShop && area?.shopPlan !== 'adjust' && area?.selectedAreaId && !area.scheduleId && areaMember.host) return { href: '/instant?area=' + area.id, label: 'お店選びに進む', detail: '集合エリアが決まりました' };
  if (area?.selectedAreaId) return { href: areaPath + '?view=results', label: '集合エリアを見る', detail: '集合エリアが決まりました' };
  if (findShop && schedule && dateMember.host && selectedDate && schedule.placePlan !== 'adjust') return { href: '/instant?schedule=' + schedule.id, label: schedule.shopPlan === 'adjust' ? 'お店のアンケートを準備する' : 'お店選びに進む', detail: '日程が決まりました' };
  if (selectedDate && !findShop) return { href: publicPath, label: '決まった日程を見る', detail: '日程が決まりました' };
  return { href: publicPath, label: '回答状況を見る', detail: selectedDate ? '日程が決まりました' : '場所を調整中' };
}

export function gatheringDescription({ schedule, area, shop }: Gathering) {
  const city = area && meetingCities[area.cityId as MeetingCityId]?.label;
  const location = meetingAreas.find(item => item.id === area?.selectedAreaId)?.label ?? meetingAreas.find(item => item.discoveryAreaId === shop?.config.areaId)?.label ?? city;
  const selected = schedule?.options.find(option => option.id === schedule.selectedOptionId);
  const date = selected && dateLabel(selected.date) + ' ' + periodLabel(selected);
  const areaTitle = location && area && (shouldFindShop(schedule, area) ? location + 'で' + area.mode : location + 'での集まり');
  const title = schedule?.title && schedule.title !== 'みんなの日程調整' ? schedule.title :
    areaTitle || shop?.title || 'みんなの日程調整';
  return { title, date, location, count: shop?.config.partySize ?? area?.expectedCount ?? schedule?.expectedCount };
}
