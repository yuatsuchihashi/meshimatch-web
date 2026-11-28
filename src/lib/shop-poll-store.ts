// Local-mode mutations are synchronous and atomically persisted within this server process.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { areaPollStore } from './area-poll-store';
import { scheduleStore } from './schedule-store';
import { record, ScheduleError, textField } from './schedule';
import { parseShopAnswer, shopShortlist, type ShopPoll } from './shop-poll';
import { areaContext, confirmedSchedule, digest, linkedContext, parseShopConfig, requireShopPlan, scheduleContext,
  standaloneContext, type ShopSetup, type SurveyContext } from './shop-poll-context';
import type { DiscoveryAnswer } from './instant/discovery';

type Member = { id: string; name: string; tokenHash: string };
type StoredPoll = {
  contextKey: string;
  revision: number;
  answers: Record<string, DiscoveryAnswer>;
  members?: Member[];
  selectedShopId: string | null;
  updatedAt?: string;
};

function pollId(input: unknown): string {
  if (typeof input !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/.test(input)) {
    throw new ScheduleError('この集まりが見つかりません。', 404);
  }
  return input;
}

function readFile<T>(directory: string, id: string): T | undefined {
  try { return JSON.parse(fs.readFileSync(path.join(directory, id + '.json'), 'utf8')) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function write(directory: string, id: string, value: unknown) {
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, id + '.json');
  const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function optional<T>(get: () => T): T | undefined {
  try { return get(); }
  catch (error) {
    if (!(error instanceof ScheduleError) || error.status !== 404) throw error;
  }
}

function validToken(value: unknown): string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 200) {
    throw new ScheduleError('この操作に必要な編集キーを確認してください。', 403);
  }
  return value;
}

function authenticate(token: unknown, hash: string | undefined) {
  const key = validToken(token);
  if (!hash || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(digest(key)))) {
    throw new ScheduleError('この操作に必要な編集権限がありません。', 403);
  }
}

export function createShopPollStore(directory: string, schedules = scheduleStore, areas = areaPollStore) {
  const setupDir = path.join(directory, 'setup');

  function getContext(input: string): SurveyContext {
    const id = pollId(input);
    const setup = readFile<ShopSetup>(setupDir, id);
    const schedule = optional(() => schedules.get(id));
    if (schedule) {
      requireShopPlan(schedule);
      if (schedule.areaPollId) return linkedContext(schedule, areas.get(schedule.areaPollId));
      if (schedule.placePlan === 'adjust') throw new ScheduleError('先に集合エリアを決めてください。', 409);
      if (setup?.source === 'schedule') return scheduleContext(schedule, setup);
      throw new ScheduleError('幹事が集合エリアとお店の種類を設定すると回答できます。', 409);
    }
    const area = optional(() => areas.get(id));
    if (area) {
      if (!area.scheduleId) return areaContext(area);
      const linked = schedules.get(area.scheduleId);
      if (linked.areaPollId && linked.areaPollId !== area.id) throw new ScheduleError('この日程の集合エリアを開き直してください。', 409);
      return linkedContext(linked, area);
    }
    if (setup?.source === 'standalone') return standaloneContext(setup);
    throw new ScheduleError('この集まりが見つかりません。', 404);
  }

  function read(context: SurveyContext): StoredPoll {
    const existing = readFile<StoredPoll>(directory, context.id);
    if (existing?.contextKey === context.contextKey) return existing;
    if (existing && context.legacyContextKey === existing.contextKey) return { ...existing, contextKey: context.contextKey };
    return { contextKey: context.contextKey, revision: 0, answers: {}, selectedShopId: null };
  }

  function publicPoll({ legacyContextKey, ...context }: SurveyContext, stored: StoredPoll): ShopPoll {
    const roster = context.source === 'standalone' ? (stored.members ?? []) : context.participants;
    const participants = roster.map(({id, name}) => ({id, name, answered: Boolean(stored.answers[digest(id)])}));
    const candidates = !context.pendingArea && participants.length === context.config.partySize && participants.every(person => person.answered)
      ? shopShortlist(context.config, participants.map(person => stored.answers[digest(person.id)]), context.suggestions)
      : [];
    return { ...context, participants, candidates, selectedShopId: stored.selectedShopId,
      updatedAt: stored.updatedAt ?? context.createdAt, shortlistVersion: digest((legacyContextKey ?? context.contextKey) + ':' + stored.revision) };
  }

  function get(id: string) {
    const context = getContext(id);
    return publicPoll(context, read(context));
  }

  function verifyHost(context: SurveyContext, token: unknown) {
    if (context.scheduleId) schedules.verifyHost(context.scheduleId, token);
    else if (context.source === 'area') areas.verifyHost(context.id, token);
    else authenticate(token, readFile<ShopSetup>(setupDir, context.id)?.hostHash);
  }

  function create(value: unknown) {
    const input = record(value);
    const linked = input.scheduleId != null;
    const id = pollId(linked ? input.scheduleId : input.id);
    const hostToken = validToken(input.hostToken);
    const schedule = linked ? schedules.get(id) : undefined;
    if (schedule) {
      schedules.verifyHost(id, hostToken);
      requireShopPlan(schedule);
      if (schedule.placePlan === 'adjust' || schedule.areaPollId) throw new ScheduleError('集合エリアの調整からお店選びに進んでください。', 409);
    } else if (optional(() => schedules.get(id)) || optional(() => areas.get(id))) {
      throw new ScheduleError('この集まりはすでに作成されています。', 409);
    }
    const count = schedule ? confirmedSchedule(schedule).attendees.length : undefined;
    const config = parseShopConfig(input.config, count);
    const title = schedule?.title || textField(input.title, '集まりの名前', 80, false)
      || (config.mode === '食事' ? 'みんなのレストラン選び' : 'みんなのカフェ選び');
    const source = schedule ? 'schedule' : 'standalone';
    const saved = readFile<ShopSetup>(setupDir, id);
    if (saved) {
      if (!schedule) authenticate(hostToken, saved.hostHash);
      // Party size follows the newly confirmed schedule roster.
      const comparable = schedule ? { ...saved.config, partySize: count } : saved.config;
      if (saved.source !== source || JSON.stringify(comparable) !== JSON.stringify(config) || saved.title !== title) {
        throw new ScheduleError('この集まりには別の設定でアンケートが作成されています。', 409);
      }
    } else {
      write(setupDir, id, { id, source, title, config, createdAt: new Date().toISOString(), hostHash: schedule ? undefined : digest(hostToken) } satisfies ShopSetup);
    }
    return { poll: get(id), hostToken };
  }

  return {
    get, create,
    update(id: string, value: unknown): { poll: ShopPoll; answer?: DiscoveryAnswer | null } {
      const input = record(value);
      const context = getContext(id);
      if (input.contextKey !== context.contextKey && (!context.legacyContextKey || input.contextKey !== context.legacyContextKey)) throw new ScheduleError('日程・場所・参加者が変わりました。開き直してください。', 409);
      const stored = read(context);
      if (input.action === 'mine' || input.action === 'respond') {
        const responseId = textField(input.responseId, '回答ID', 80);
        if (!/^[\w-]+$/.test(responseId)) throw new ScheduleError('回答IDを確認してください。');
        const token = validToken(input.token);
        const open = context.source === 'standalone';
        const member = stored.members?.find(person => person.id === responseId);
        if (open) {
          if (member) authenticate(token, member.tokenHash);
        } else {
          if (!context.participants.some(person => person.id === responseId)) throw new ScheduleError('当日参加する方が回答できます。', 403);
          if (context.scheduleId) schedules.verifyRespondent(context.scheduleId, responseId, token);
          else areas.verifyRespondent(context.id, responseId, token);
        }
        const key = digest(responseId);
        const previous = stored.answers[key];
        if (input.action === 'mine') return { poll: publicPoll(context, stored), answer: previous ?? null };
        if (stored.selectedShopId) throw new ScheduleError('お店は決定済みです。変更するには幹事に再開を依頼してください。', 409);
        const answer = parseShopAnswer(input.answer, context.config);
        if (open && !member) {
          if ((stored.members?.length ?? 0) >= context.config.partySize) throw new ScheduleError('予定人数分の回答がそろっています。', 409);
          const name = textField(input.name, 'お名前', 40);
          (stored.members ??= []).push({ id: responseId, name, tokenHash: digest(token) });
        }
        if (previous && JSON.stringify(answer) === JSON.stringify(previous)) return { poll: publicPoll(context, stored) };
        stored.answers[key] = answer;
      } else if (input.action === 'confirm' || input.action === 'reopen') {
        verifyHost(context, input.token);
        if (context.pendingArea) throw new ScheduleError('日程と集合エリアが決まるとお店の候補を選べます。', 409);
        const current = publicPoll(context, stored);
        const reopening = input.action === 'reopen';
        if (reopening ? !stored.selectedShopId : stored.selectedShopId && stored.selectedShopId === input.shopId) {
          return { poll: current };
        }
        if (current.shortlistVersion !== input.shortlistVersion) throw new ScheduleError('回答または候補が更新されました。候補を確認して、もう一度選んでください。', 409);
        if (!reopening) {
          if (stored.selectedShopId) throw new ScheduleError('別のお店にするには、お店選びを再開してください。', 409);
          const candidate = current.candidates.find(shop => shop.shopId === input.shopId);
          if (!candidate) throw new ScheduleError('参加者の回答がそろってから、候補のお店を選んでください。', 409);
          stored.selectedShopId = candidate.shopId;
        } else stored.selectedShopId = null;
      } else throw new ScheduleError('操作を確認してください。');
      stored.revision++;
      stored.updatedAt = new Date().toISOString();
      write(directory, context.id, stored);
      return { poll: publicPoll(context, stored) };
    },
  };
}

export const shopPollStore = createShopPollStore(path.join(process.cwd(), '.localdb', 'shop-polls'));
