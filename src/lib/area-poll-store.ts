// Local-only prototype store. Mutations contain no awaits and persist atomically
// within the single Next.js server process. Public responses omit all edit keys.
import { accessShortlist, parseTrip, type AccessTrip } from './area-access';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { commonAreaCandidates, parseAreaPollInput, parseAreaPollResponse, type AreaPoll } from './area-poll';
import { attendingIds, record, ScheduleError, textField } from './schedule';
import { scheduleStore } from './schedule-store';
import { shouldFindShop } from './shop-plan';

type StoredAreaPoll = AreaPoll & { selectedRoster?: string; trips?: Record<string, AccessTrip>; hostHash: string; responseHashes: Record<string, string> };
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function publicPoll(poll: StoredAreaPoll): AreaPoll {
  const { id, cityId, expectedCount, mode, scheduleId, scheduleOptionId, areaIds, responses, selectedAreaId, createdAt, updatedAt } = poll;
  const trips = Object.values(poll.trips ?? {});
  const findShop = shouldFindShop(undefined, poll);
  const access = poll.method === 'access-demo' ? {
    method: poll.method,
    suggestions: findShop ? trips.flatMap(trip => trip.suggestion ? [trip.suggestion] : []) : [],
    accessOptions: poll.responses.length === expectedCount ? accessShortlist(trips, findShop ? mode : null) : [],
  } : {};
  return { ...(poll.decisionEpoch ? { decisionEpoch: poll.decisionEpoch } : {}), ...(poll.eligibleResponseIds ? { eligibleResponseIds: poll.eligibleResponseIds } : {}), ...(poll.attendanceBased ? { attendanceBased: true } : {}), ...access, shopPlan: poll.shopPlan, id, cityId, expectedCount, mode, scheduleId, scheduleOptionId, areaIds,
    responses: responses.map(response => ({ ...response, cannotAttend: response.cannotAttend === true })),
    selectedAreaId, createdAt, updatedAt };
}

function authenticate(value: unknown, expected: unknown): void {
  if (typeof value !== 'string' || value.length < 20 || value.length > 200 || typeof expected !== 'string' ||
    !/^[0-9a-f]{64}$/.test(expected) || !crypto.timingSafeEqual(Buffer.from(hash(value)), Buffer.from(expected))) {
    throw new ScheduleError('この操作に必要な編集権限がありません。', 403);
  }
}

export function createAreaPollStore(directory: string, linkedSchedules = scheduleStore) {
  function filename(id: string): string {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)) throw new ScheduleError('エリア調整が見つかりません。', 404);
    return path.join(directory, `${id}.json`);
  }
  function read(id: string): StoredAreaPoll {
    try { return JSON.parse(fs.readFileSync(filename(id), 'utf8')) as StoredAreaPoll; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ScheduleError('エリア調整が見つかりません。', 404);
      throw error;
    }
  }
  function write(poll: StoredAreaPoll): void {
    fs.mkdirSync(directory, { recursive: true });
    const target = filename(poll.id);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(poll), { mode: 0o600 });
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  function validateSchedule(scheduleId: string | null, expectedCount: number, expectedOptionId?: string | null): string | null {
    if (!scheduleId) return null;
    const schedule = linkedSchedules.get(scheduleId);
    if (schedule.placePlan === 'adjust' && expectedOptionId == null) {
      if (schedule.expectedCount !== expectedCount) throw new ScheduleError('日程調整とエリア調整の参加人数をそろえてください。', 409);
      return null;
    }
    if (expectedOptionId !== undefined && (!schedule.selectedOptionId || schedule.selectedOptionId !== expectedOptionId || schedule.expectedCount !== expectedCount)) {
      throw new ScheduleError('日程が変更されています。新しくエリア調整を始めてください。', 409);
    }
    if (!schedule.selectedOptionId) throw new ScheduleError('先に日程調整で日程を決定してください。', 409);
    if (schedule.expectedCount !== expectedCount) throw new ScheduleError('日程調整とエリア調整の参加人数をそろえてください。', 409);
    return schedule.selectedOptionId;
  }
  function participants(poll: StoredAreaPoll) {
    if (!poll.attendanceBased || !poll.scheduleId) return {};
    const schedule = linkedSchedules.get(poll.scheduleId);
    const roster = attendingIds(schedule);
    return { roster, key: roster && JSON.stringify([schedule.selectedOptionId, ...[...roster].sort()]) };
  }
  function visiblePoll(poll: StoredAreaPoll): AreaPoll {
    const { roster, key } = participants(poll);
    if (!poll.attendanceBased) return publicPoll(poll);
    const responses = roster ? poll.responses.filter(person => roster.includes(person.id)) : poll.responses;
    const trips = Object.fromEntries(responses.flatMap(person => {
      const key = hash(person.id);
      const trip = poll.trips?.[key];
      return trip ? [[key, trip]] : [];
    }));
    const result = publicPoll({ ...poll, responses, trips, eligibleResponseIds: roster, expectedCount: roster?.length ?? poll.expectedCount,
      selectedAreaId: key && poll.selectedRoster === key ? poll.selectedAreaId : null });
    if (!roster && result.method) result.accessOptions = [];
    return result;
  }
  return {
    verifyHost(id: string, token: unknown) {
      authenticate(token, read(id).hostHash);
    },
    verifyRespondent(id: string, responseId: string, token: unknown) {
      const poll = read(id);
      const person = poll.responses.find(response => response.id === responseId);
      if (!person) throw new ScheduleError('先に場所に回答してください。', 409);
      authenticate(token, poll.responseHashes[hash(responseId)]);
      return person;
    },
    create(value: unknown): { poll: AreaPoll; hostToken: string } {
      const input = parseAreaPollInput(value);
      const scheduleOptionId = validateSchedule(input.scheduleId, input.expectedCount);
      const schedule = input.scheduleId ? linkedSchedules.get(input.scheduleId) : null;
      const parallel = schedule?.placePlan === 'adjust';
      const scheduleToken = parallel ? textField(record(value).scheduleHostToken, '幹事の編集キー', 200) : '';
      if (parallel) linkedSchedules.verifyHost(schedule.id, scheduleToken);
      // A stable ID and capability let the organizer safely retry either file write.
      const id = parallel ? schedule.id : crypto.randomUUID();
      const hostToken = parallel ? crypto.createHmac('sha256', scheduleToken).update('area:' + id).digest('base64url') : crypto.randomBytes(32).toString('base64url');
      if (parallel && fs.existsSync(filename(id))) {
        const existing = read(id);
        authenticate(hostToken, existing.hostHash);
        linkedSchedules.linkArea(schedule.id, scheduleToken, id);
        if (existing.attendanceBased) linkedSchedules.enableAttendance(schedule.id);
        return { poll: visiblePoll(existing), hostToken };
      }
      const timestamp = new Date().toISOString();
      const poll: StoredAreaPoll = { ...input, shopPlan: schedule ? schedule.shopPlan : input.shopPlan, ...(parallel && record(value).attendanceBased === true ? { attendanceBased: true } : {}), scheduleOptionId, id, responses: [], selectedAreaId: null,
        createdAt: timestamp, updatedAt: timestamp, hostHash: hash(hostToken), responseHashes: {} };
      write(poll);
      if (parallel) linkedSchedules.linkArea(schedule.id, scheduleToken, id);
      if (schedule && poll.attendanceBased) linkedSchedules.enableAttendance(schedule.id);
      return { poll: visiblePoll(poll), hostToken };
    },
    get(id: string): AreaPoll { return visiblePoll(read(id)); },
    update(id: string, value: unknown): AreaPoll {
      const input = record(value);
      const poll = read(id);
      if (input.action === 'respond') {
        validateSchedule(poll.scheduleId, poll.expectedCount, poll.scheduleOptionId);
        if (visiblePoll(poll).selectedAreaId) throw new ScheduleError('エリアは決定済みです。変更する場合は幹事に再開してもらってください。', 409);
        const responseId = textField(input.responseId, '回答ID', 80);
        if (!/^[\w-]+$/.test(responseId)) throw new ScheduleError('回答IDを確認してください。');
        const token = textField(input.token, '回答の編集キー', 200);
        if (token.length < 20) throw new ScheduleError('回答の編集キーを確認してください。');
        if (poll.scheduleId && (poll.attendanceBased || (input.fromSchedule === true && poll.id === poll.scheduleId && !poll.responses.length))) {
          linkedSchedules.verifyRespondent(poll.scheduleId, responseId, token);
          poll.attendanceBased = true;
          const { roster } = participants(poll);
          if (roster && !roster.includes(responseId)) throw new ScheduleError('決定した日程に参加する人の回答を受け付けています。', 409);
          poll.selectedAreaId = null;
          delete poll.selectedRoster;
        }
        const existingIndex = poll.responses.findIndex(response => response.id === responseId);
        // Hash keys also avoid special object property names supplied as IDs.
        if (existingIndex >= 0) authenticate(token, poll.responseHashes[hash(responseId)]);
        else if (poll.responses.length >= poll.expectedCount) throw new ScheduleError('予定人数分の回答がそろっています。自分の回答を編集してください。', 409);
        const access = poll.method === 'access-demo';
        const parsed = access ? { name: textField(input.name, 'お名前', 40, false), allowedAreaIds: [], preferredAreaIds: [], cannotAttend: false } : parseAreaPollResponse(input, poll);
        if (access) {
          poll.trips ??= {};
          poll.trips[hash(responseId)] = parseTrip(shouldFindShop(undefined, poll) ? input : { ...input, suggestion: undefined });
        }
        const number = existingIndex >= 0 ? existingIndex + 1 : poll.responses.length + 1;
        const response = { ...parsed, name: parsed.name || `参加者${number}`, id: responseId, updatedAt: new Date().toISOString() };
        if (existingIndex >= 0) poll.responses[existingIndex] = response;
        else poll.responses.push(response);
        poll.responseHashes[hash(responseId)] = hash(token);
      } else {
        authenticate(input.token, poll.hostHash);
        if (input.action === 'reopen') {
          if (poll.selectedAreaId) poll.decisionEpoch = (poll.decisionEpoch ?? 0) + 1;
          poll.selectedAreaId = null;
        }
        else if (input.action === 'confirm') {
          const visible = visiblePoll(poll);
          if (visible.selectedAreaId && visible.selectedAreaId !== input.areaId) {
            throw new ScheduleError('別のエリアに変更するには、エリア調整を再開してください。', 409);
          }
          validateSchedule(poll.scheduleId, poll.expectedCount, poll.scheduleOptionId);
          const { key } = participants(poll);
          if (poll.attendanceBased && !key) throw new ScheduleError('先に日程を決定してください。', 409);
          const candidates = poll.method === 'access-demo' ? visible.accessOptions ?? [] : commonAreaCandidates(visible);
          const candidate = candidates.find(candidate => candidate.areaId === input.areaId);
          if (!candidate) throw new ScheduleError('全員が行けるエリアから決定してください。', 409);
          poll.selectedAreaId = candidate.areaId;
          poll.selectedRoster = key;
        } else throw new ScheduleError('操作を確認してください。');
      }
      poll.updatedAt = new Date().toISOString();
      write(poll);
      if (poll.attendanceBased && poll.scheduleId) linkedSchedules.enableAttendance(poll.scheduleId);
      return visiblePoll(poll);
    },
  };
}

export const areaPollStore = createAreaPollStore(path.join(process.cwd(), '.localdb', 'area-polls'));
