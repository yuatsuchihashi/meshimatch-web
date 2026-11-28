import { areas, modes, rankShops, resolveDiscoveryAgreement, selectDiscoveryShortlist, type CafeFeedback, type DiscoveryCandidate, type DiscoveryAnswer, type DiscoveryConfig } from './discovery';

export const DISCOVERY_SESSION_KEY = 'meshimatch_instant_discovery_v1';
export interface DiscoverySession {
  version: 1;
  surveyVersion?: 2;
  seenIds?: string[];
  feedback?: CafeFeedback[][];
  config: DiscoveryConfig;
  answers: DiscoveryAnswer[];
  offset: number;
  votes: string[][];
  ballotPhase: 'shortlist' | 'handoff' | 'result';
  winnerId: string | null;
}
export const defaultDiscoveryConfig: DiscoveryConfig = {
  areaId: 'shinjuku', radius: 1000, mode: '食事', partySize: 2,
};
export function newDiscoverySession(config: DiscoveryConfig): DiscoverySession {
  const selectedConfig = { ...config, mode: modes.includes(config.mode) ? config.mode : defaultDiscoveryConfig.mode };
  return { version: 1, surveyVersion: 2, seenIds: [], feedback: [], config: selectedConfig, answers: [], offset: 0, votes: [], ballotPhase: 'shortlist', winnerId: null };
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function validAnswer(value: unknown): value is DiscoveryAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Record<string, unknown>;
  if (answer.cafe !== undefined) {
    const cafe = answer.cafe as Record<string, unknown>;
    if (cafe?.foodDecision !== undefined && !['unspecified', 'selected', 'onsite', 'none'].includes(String(cafe.foodDecision))) return false;
    if (!cafe || typeof cafe !== 'object' || !strings(cafe.interests) || !strings(cafe.important) ||
      !strings(cafe.undecided) || !cafe.details || typeof cafe.details !== 'object' ||
      !Object.values(cafe.details).every(strings) ||
      !['onsite', 'drink', 'drink-dessert', 'drink-light'].includes(String(cafe.plan))) return false;
  }
  if (answer.restaurant !== undefined) {
    const restaurant = answer.restaurant as Record<string, unknown>;
    if (restaurant?.noisePreferences !== undefined && !strings(restaurant.noisePreferences)) return false;
    if (!restaurant || typeof restaurant !== 'object' || !strings(restaurant.genres) ||
      !strings(restaurant.important) || !strings(restaurant.styles) || !strings(restaurant.undecided) ||
      !restaurant.details || typeof restaurant.details !== 'object' || !Object.values(restaurant.details).every(strings)) return false;
  }
  return ['genres', 'priorities', 'order', 'diet'].every(key => strings(answer[key])) &&
    ['need', 'noise', 'style', 'heat', 'budget'].every(key => typeof answer[key] === 'string') &&
    (answer.budget === '' || /^\d+$/.test(String(answer.budget)) && Number(answer.budget) > 0) &&
    ['', '0', '1', '2', '3'].includes(String(answer.heat));
}
export function parseDiscoverySession(raw: string | null): DiscoverySession | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as DiscoverySession;
    const config = session?.config;
    if (session?.version !== 1 || !config || !Object.hasOwn(areas, config.areaId) ||
      ![500, 1000, 2000].includes(config.radius) || (!modes.includes(config.mode) && config.mode !== 'どちらでも') ||
      !Number.isInteger(config.partySize) || config.partySize < 2 || config.partySize > 8 ||
      !Array.isArray(session.answers) || session.answers.length > config.partySize || !session.answers.every(validAnswer) ||
      !Number.isInteger(session.offset) || session.offset < 0 || session.offset % 3 !== 0 ||
      !Array.isArray(session.votes) || session.votes.length > config.partySize || !session.votes.every(strings) ||
      !['shortlist', 'handoff', 'result'].includes(session.ballotPhase) ||
      !(session.winnerId === null || typeof session.winnerId === 'string')) return null;
    if (session.answers.some(answer => config.mode === 'どちらでも' && !['main', 'cafe', 'drink', 'any'].includes(answer.need))) return null;
    if (session.surveyVersion !== undefined && session.surveyVersion !== 2) return null;
    if (session.seenIds !== undefined && !strings(session.seenIds)) return null;
    if (session.feedback !== undefined && (!Array.isArray(session.feedback) || session.feedback.length > config.partySize ||
      !session.feedback.every(ballot => Array.isArray(ballot) && ballot.every(item => item &&
        typeof item.shopId === 'string' && ['yes', 'more', 'no'].includes(item.status) &&
        (item.reason === undefined || typeof item.reason === 'string'))))) return null;
    const complete = session.answers.length === config.partySize;
    if (!complete && (session.votes.length || session.offset || session.ballotPhase !== 'shortlist' || session.winnerId)) return null;
    if (session.ballotPhase === 'shortlist' && (session.votes.length || session.winnerId)) return null;
    if (session.ballotPhase === 'handoff' && (session.votes.length >= config.partySize || session.winnerId)) return null;
    if (session.ballotPhase === 'result') {
      if (session.votes.length !== config.partySize) return null;
      const ids = discoverySessionShortlist(session, rankShops(config, session.answers)).map(candidate => candidate.shop.id);
      if (resolveDiscoveryAgreement(ids, session.votes, config.partySize) !== session.winnerId) return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function usesCafeSurvey(session: DiscoverySession): boolean {
  return session.surveyVersion === 2 && session.answers.some(answer => answer.cafe !== undefined);
}
export function discoverySessionShortlist(session: DiscoverySession, candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return usesAdaptiveSurvey(session)
    ? selectDiscoveryShortlist(candidates, session.seenIds ?? [])
    : candidates.slice(session.offset, session.offset + 3);
}

export function usesAdaptiveSurvey(session: DiscoverySession): boolean {
  return session.surveyVersion === 2 && session.answers.some(answer => answer.cafe !== undefined || answer.restaurant !== undefined);
}
