import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { defaultDiscoveryConfig } from '@/lib/instant/discovery-session';
import type { PlacePlan, ShopPlan } from '@/lib/schedule';
import { AreaSetup } from './AreaSetup';

let search: URLSearchParams;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => search,
}));

function setup(query: string) {
  search = new URLSearchParams(query);
  return renderToStaticMarkup(<AreaSetup config={defaultDiscoveryConfig} onChange={() => {}} onLegacyStart={() => {}}
    areaPoll={null} scheduledPoll={null} loadingContext={false} />);
}

const choices: PlacePlan[] = ['known', 'adjust'];
const shopChoices: ShopPlan[] = ['known', 'adjust', 'skip'];
const combinations = choices.flatMap(day => choices.flatMap(place => shopChoices.map(shop => ({ day, place, shop }))));

describe('what the organizer still needs to decide', () => {
  it('lets the organizer choose the status of all three items independently', () => {
    const html = setup('');
    expect(html).toContain('日程');
    expect(html).toContain('集合エリア');
    expect(html).toContain('カフェ');
    expect(html.match(/決まっている<\/button>/g)).toHaveLength(3);
    expect(html.match(/みんなで調整<\/button>/g)).toHaveLength(3);
    expect(html.match(/調整しない<\/button>/g)).toHaveLength(1);
    expect(html).not.toContain('aria-pressed="true"');
  });

  it.each(combinations)('day=$day, place=$place, shop=$shop', ({ day, place, shop }) => {
    const html = setup(new URLSearchParams({ day, place, shop }).toString());
    const steps = html.match(/<nav[^>]*aria-label="今回の流れ"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
    const text = steps.replace(/<[^>]*>/g, '');
    expect(/日程/.test(text)).toBe(day === 'adjust');
    expect(/場所|エリア/.test(text)).toBe(place === 'adjust');
    expect(/お店/.test(text)).toBe(shop === 'adjust');
    if (day === 'known' && place === 'known' && shop === 'adjust') {
      expect(html).toContain('カフェ・軽食');
      expect(html).toContain('お店のアンケートを作る');
      expect(html).toContain('各自の端末');
    } else {
      expect(html).not.toContain('お店のアンケートを作る');
    }
    if (day === 'known' && place === 'known' && shop !== 'adjust') {
      expect(html).toContain('/home');
      expect(html).not.toContain('集まる都市');
    }
  });
});
