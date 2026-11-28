import type { ShopPlan } from './schedule';

type ShopChoice = { shopPlan?: ShopPlan };

// Older gatherings offered the shop survey automatically.
export function shouldFindShop(schedule?: ShopChoice | null, area?: ShopChoice | null) {
  return (schedule?.shopPlan ?? 'adjust') === 'adjust' && (area?.shopPlan ?? 'adjust') === 'adjust';
}
