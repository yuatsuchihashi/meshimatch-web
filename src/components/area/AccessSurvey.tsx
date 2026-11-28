import { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { accessAreas, accessStations, type AccessTrip, type ShopSuggestion } from '@/lib/area-access';
import { meetingAreas } from '@/lib/meeting-areas';
import styles from './AreaPollFlow.module.css';
import fields from './AccessSurvey.module.css';

export const emptyTrip: AccessTrip = { origin: '', onward: '', wish: '' };
const readings: Record<string, string> = {
  tokyo: 'とうきょう', omiya: 'おおみや', shinjuku: 'しんじゅく', shibuya: 'しぶや',
  ueno: 'うえの', asakusa: 'あさくさ', kuramae: 'くらまえ', ikebukuro: 'いけぶくろ',
};
function stationTerm(text: string) {
  return text.normalize('NFKC').toLowerCase().trim().replace(/駅$/, '')
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 96));
}
function stationAliases(station: typeof accessStations[number]) {
  return [station.label, station.label.split('（')[0], station.id, readings[station.id]].map(stationTerm);
}

function StationField({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const selected = accessStations.find(station => station.id === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const resultsId = useId();
  const term = stationTerm(query);
  const matches = accessStations.filter(station => stationAliases(station).some(alias => alias.includes(term)));
  const showResults = expanded && !selected;

  function type(text: string, composition: boolean) {
    setQuery(text);
    setExpanded(true);
    const match = !composition && accessStations.find(station => stationAliases(station).includes(stationTerm(text)));
    onChange(match ? match.id : '');
  }
  function choose(station: typeof accessStations[number]) {
    setQuery(station.label); setExpanded(false); onChange(station.id);
  }
  return <div className={styles.stationField}>
    <label className={styles.tripField}><span>{label}</span>
      <span className={fields.inputWrap}><input ref={input} autoComplete="off" placeholder="駅名を入力" value={query}
        onFocus={event => { if (selected) event.currentTarget.select(); }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={event => { composing.current = false; type(event.currentTarget.value, false); }}
        onChange={event => type(event.target.value, composing.current)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          event.preventDefault();
          if (selected) { setQuery(selected.label); setExpanded(false); input.current?.blur(); }
          else if (matches.length === 1) { choose(matches[0]); input.current?.blur(); }
        }} />
        {selected && <Check className={fields.selected} size={18} aria-label="選択済み" />}
      </span>
    </label>
    {!query && <button className={fields.browse} type="button" aria-expanded={showResults} aria-controls={resultsId}
      onClick={() => setExpanded(current => !current)}>対応する{accessStations.length}駅から選ぶ<ChevronDown size={14} /></button>}
    {showResults && <div id={resultsId} className={styles.tripChips}>
      {matches.map(station => <button type="button" key={station.id} onClick={() => choose(station)}>{station.label}</button>)}
      {!matches.length && <div className={fields.empty} role="status">この駅は試作の対象外です。
        <button type="button" onClick={() => { type('', false); }}>対応する駅を見る</button></div>}
    </div>}
  </div>;
}

export function AccessSurvey({ trip, change, mode }: { trip: AccessTrip; change: (trip: AccessTrip) => void; mode: string | null }) {
  const suggestion = trip.suggestion;
  const label = mode === '食事' ? 'レストラン' : 'カフェ';
  const [showOnward, setShowOnward] = useState(Boolean(trip.onward && !['return', 'unknown'].includes(trip.onward)));
  const [otherStation, setOtherStation] = useState(showOnward ? trip.onward : '');
  const previousSuggestion = useRef<ShopSuggestion | undefined>(suggestion);
  const routeSelected = trip.anywhere === false || (!trip.anywhere && Boolean(trip.origin));
  return <>
    <fieldset className={fields.routeChoices}>
      <legend className={styles.srOnly}>集まる場所の希望</legend>
      <label><input type="radio" name="areaPreference" checked={trip.anywhere === true}
        onChange={() => change({ ...trip, anywhere: true })} /><span><strong>どこでも大丈夫</strong><small>場所はみんなに合わせる</small></span></label>
      <label><input type="radio" name="areaPreference" checked={routeSelected}
        onChange={() => change({ ...trip, anywhere: false, onward: showOnward ? otherStation : trip.onward || 'unknown' })} /><span><strong>行きやすい場所がいい</strong><small>出発駅や帰り道から候補を探す</small></span></label>
    </fieldset>
    {routeSelected && <>
    <StationField label="当日、どこから来る？" value={trip.origin} onChange={origin => change({ ...trip, origin })} />
    <fieldset className={styles.choicesField}><legend className={fields.legend}>解散後の行き先 <small>任意</small></legend>
      <div className={styles.tripChips}>
        {[['return', '出発駅に戻る'], ['unknown', 'まだ未定'], ['station', '別の駅へ']].map(([id, title]) =>
          <button type="button" key={id} aria-pressed={id === 'station' ? showOnward : trip.onward === id}
            onClick={() => { setShowOnward(id === 'station'); change({ ...trip, onward: id === 'station' ? otherStation : id }); }}>{title}</button>)}
      </div>
      {showOnward && <StationField label="解散後の駅" value={trip.onward} onChange={onward => {
        setOtherStation(onward); change({ ...trip, onward });
      }} />}
    </fieldset>
    <p className={fields.privacy}>行き帰りの駅はほかの参加者に公開されません。</p></>}
    {mode && <label className={styles.recommendCheck}><input type="checkbox" checked={Boolean(suggestion)}
      onChange={event => {
        if (suggestion) previousSuggestion.current = suggestion;
        change({ ...trip, suggestion: event.target.checked ? previousSuggestion.current ?? { text: '', areaId: '' } : undefined });
      }} />
      おすすめの{label}はある？ <small>任意</small></label>}
    {mode && suggestion && <div className={styles.suggestionBox}>
      <label className={styles.tripField}>みんなに共有する店名・リンク
        <input required maxLength={2000} placeholder="店名を入力、または地図のリンクを貼る" value={suggestion.text}
          onChange={event => change({ ...trip, suggestion: { ...suggestion, text: event.target.value } })} /></label>
      <fieldset className={styles.choicesField}><legend>お店のエリア（わかれば）</legend><div className={styles.tripChips}>
        {accessAreas.map(id => <button type="button" key={id} aria-pressed={id === suggestion.areaId}
          onClick={() => change({ ...trip, suggestion: { ...suggestion, areaId: id === suggestion.areaId ? '' : id } })}>
          {meetingAreas.find(area => area.id === id)?.label}</button>)}
      </div></fieldset><p className={styles.help}>エリアを選ぶと街の候補にも反映されます。</p>
    </div>}
  </>;
}
