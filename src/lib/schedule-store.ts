// Local prototype persistence. One process, synchronous read/modify/atomic rename.
// Auth capabilities stay on the server; invitees receive only the public poll.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MAX_SCHEDULE_OPTIONS, ScheduleError, parsePollInput, parseOption, optionKey, record, textField, canConfirmDate,
  type Availability, type SchedulePoll } from './schedule';

type StoredPoll = SchedulePoll & { hostHash: string; responseHashes: Record<string, string> };
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
function publicPoll(poll: StoredPoll): SchedulePoll {
  const { id, title, description, timezone, expectedCount, options, responses, selectedOptionId, createdAt, updatedAt,
    placePlan, shopPlan, decisionEpoch, attendanceBased, areaPollId } = poll;
  return {
    id, title, description, timezone, expectedCount, options, responses, selectedOptionId, createdAt, updatedAt,
    ...(placePlan ? { placePlan } : {}),
    ...(shopPlan ? { shopPlan } : {}),
    ...(decisionEpoch ? { decisionEpoch } : {}),
    ...(attendanceBased ? { attendanceBased: true } : {}),
    ...(areaPollId ? { areaPollId } : {}),
  };
}
function authenticated(token: unknown, expected?: string) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200 || !expected ||
    !crypto.timingSafeEqual(Buffer.from(hash(token)), Buffer.from(expected))) {
    throw new ScheduleError('この操作に必要な編集権限がありません。', 403);
  }
}
export function createScheduleStore(directory: string) {
  function filename(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ScheduleError('日程調整が見つかりません。', 404);
    return path.join(directory, `${id}.json`);
  }
  function read(id: string): StoredPoll {
    const file = filename(id);
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) as StoredPoll; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ScheduleError('日程調整が見つかりません。', 404);
      throw error;
    }
  }
  function write(poll: StoredPoll) {
    fs.mkdirSync(directory, { recursive: true });
    const file = filename(poll.id);
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(poll), { mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return {
    create(input: unknown) {
      const data = parsePollInput(input);
      const hostToken = crypto.randomBytes(32).toString('base64url');
      const now = new Date().toISOString();
      const poll: StoredPoll = { ...data, id: crypto.randomUUID(), responses: [], selectedOptionId: null,
        ...(data.placePlan === 'known' && data.shopPlan === 'adjust' ? { attendanceBased: true } : {}),
        createdAt: now, updatedAt: now, hostHash: hash(hostToken), responseHashes: {} };
      write(poll);
      return { poll: publicPoll(poll), hostToken };
    },
    verifyHost(id: string, token: unknown) { authenticated(token, read(id).hostHash); },
    verifyRespondent(id: string, responseId: string, token: unknown) {
      const poll = read(id);
      const person = poll.responses.find(person => person.id === responseId);
      if (!person) throw new ScheduleError('先に日程に回答してください。', 409);
      authenticated(token, poll.responseHashes[responseId]);
      return person;
    },
    enableAttendance(id: string) {
      const poll = read(id);
      if (poll.attendanceBased || poll.placePlan !== 'adjust' || !poll.areaPollId) return;
      poll.attendanceBased = true;
      poll.updatedAt = new Date().toISOString();
      write(poll);
    },
    linkArea(id: string, token: unknown, areaId: string) {
      const poll = read(id);
      authenticated(token, poll.hostHash);
      if (poll.areaPollId && poll.areaPollId !== areaId) throw new ScheduleError('場所調整は作成済みです。', 409);
      if (poll.areaPollId === areaId) return;
      poll.areaPollId = areaId;
      poll.updatedAt = new Date().toISOString();
      write(poll);
    },
    get(id: string) { return publicPoll(read(id)); },
    update(id: string, value: unknown) {
      const input = record(value);
      const poll = read(id);
      if (input.action === 'respond') {
        if (poll.selectedOptionId) throw new ScheduleError('日程は決定済みです。変更する場合は幹事に再開してもらってください。', 409);
        const responseId = textField(input.responseId, '回答ID', 80);
        if (!/^[\w-]+$/.test(responseId)) throw new ScheduleError('回答IDを確認してください。');
        const token = textField(input.token, '回答の編集キー', 200);
        if (token.length < 20) throw new ScheduleError('回答の編集キーを確認してください。');
        const existing = poll.responses.find(response => response.id === responseId);
        if (existing) authenticated(token, poll.responseHashes[responseId]);
        else if (poll.responses.length >= poll.expectedCount) throw new ScheduleError('予定人数分の回答がそろっています。自分の回答を編集してください。', 409);
        const name = textField(input.name, 'お名前', 40);
        const comment = textField(input.comment, '補足', 500, false);
        const rawAnswers = record(input.answers);
        const answers: Record<string, Availability> = {};
        for (const option of poll.options) {
          const answer = rawAnswers[option.id];
          if (answer !== 'yes' && answer !== 'maybe' && answer !== 'no') {
            throw new ScheduleError('すべての候補に○・△・×で回答してください。候補が追加された場合は再読み込みしてください。', 409);
          }
          answers[option.id] = answer;
        }
        const response = { id: responseId, name, comment, answers, updatedAt: new Date().toISOString() };
        if (existing) poll.responses = poll.responses.map(item => item.id === responseId ? response : item);
        else poll.responses.push(response);
        poll.responseHashes[responseId] = hash(token);
      } else {
        authenticated(input.token, poll.hostHash);
        if (input.action === 'reopen') {
          if (poll.selectedOptionId) poll.decisionEpoch = (poll.decisionEpoch ?? 0) + 1;
          poll.selectedOptionId = null;
        }
        else if (input.action === 'confirm') {
          if (poll.selectedOptionId && poll.selectedOptionId !== input.optionId) throw new ScheduleError('別の日程に変更するには、日程調整を再開してください。', 409);
          const option = poll.options.find(option => option.id === input.optionId);
          if (!option || !canConfirmDate(poll, option.id)) {
            throw new ScheduleError(poll.attendanceBased ? '全員の回答がそろい、2人以上が○の候補を選んでください。' : '全員の○がそろった候補から決定してください。', 409);
          }
          poll.selectedOptionId = option.id;
        } else if (input.action === 'add-option') {
          if (poll.selectedOptionId) throw new ScheduleError('候補を追加するには日程調整を再開してください。', 409);
          const raw = input.options === undefined ? [input.option] : input.options;
          if (!Array.isArray(raw) || !raw.length || raw.length > MAX_SCHEDULE_OPTIONS) throw new ScheduleError(`追加する候補を1〜${MAX_SCHEDULE_OPTIONS}件選んでください。`);
          const additions = raw.map(parseOption);
          const next = [...poll.options];
          for (const option of additions) {
            const prior = next.find(item => item.id === option.id);
            if (prior && optionKey(prior) === optionKey(option)) continue;
            if (prior || next.some(item => optionKey(item) === optionKey(option))) throw new ScheduleError('同じ候補日時が重複しています。');
            next.push(option);
          }
          if (next.length > MAX_SCHEDULE_OPTIONS) throw new ScheduleError(`候補は${MAX_SCHEDULE_OPTIONS}件までです。`);
          poll.options = next;
        } else throw new ScheduleError('操作を確認してください。');
      }
      poll.updatedAt = new Date().toISOString();
      write(poll);
      return publicPoll(poll);
    },
  };
}
export const scheduleStore = createScheduleStore(path.join(process.cwd(), '.localdb', 'schedules'));
