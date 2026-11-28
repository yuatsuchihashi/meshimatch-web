import { Check } from 'lucide-react';
import { PillButton } from '@/components/v2';
import { canConfirmDate, dateLabel, periodLabel, summarizeOption, type SchedulePoll } from '@/lib/schedule';
import styles from './ScheduleDecision.module.css';

type Props = {
  poll: SchedulePoll;
  host: boolean;
  busy: boolean;
  confirming: string | null;
  select: (id: string | null) => void;
  confirm: (id: string) => void;
};

export function ScheduleDecision({ poll, host, busy, confirming, select, confirm }: Props) {
  if (poll.selectedOptionId || !poll.responses.length) return null;
  const rows = poll.options.map(option => ({
    option, count: summarizeOption(poll, option.id), eligible: canConfirmDate(poll, option.id),
  })).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.count.yes - a.count.yes);
  const best = rows[0];
  const tied = rows.filter(row => row.count.yes === best.count.yes && row.eligible === best.eligible).length;

  function candidate({ option, count, eligible }: typeof best) {
    const label = dateLabel(option.date) + ' ' + periodLabel(option);
    const names = poll.responses.filter(person => person.answers[option.id] === 'yes').map(person => person.name);
    const isConfirming = confirming === option.id && eligible;
    return <article key={option.id} className={styles.row} aria-label={label}>
      <div className={styles.summary}>
        <h3>{dateLabel(option.date)} <span>{periodLabel(option)}</span></h3>
        <strong>{count.yes}人が○</strong>
      </div>
      {names.length > 0 && <p className={styles.names}>{names.join('、')}</p>}
      {(count.maybe > 0 || count.no > 0 || count.pending > 0) && <p className={styles.otherCounts}>
        {[count.maybe && `△ ${count.maybe}人`, count.no && `× ${count.no}人`, count.pending && `未回答 ${count.pending}人`].filter(Boolean).join('　')}
      </p>}
      {host && eligible && (isConfirming ? <div className={styles.confirm}>
        <p>{poll.attendanceBased ? `この日程に○の${count.yes}人で集まりますか？` : 'この日程に決めますか？'}</p>
        <div><PillButton variant="cta" disabled={busy} onClick={() => confirm(option.id)}>この日程で確定</PillButton>
          <button type="button" className={styles.cancel} disabled={busy} onClick={() => select(null)}>戻る</button></div>
      </div> : <button type="button" className={styles.choose} aria-label={`${label}を選ぶ`} disabled={busy} onClick={() => select(option.id)}>この日程を選ぶ<Check size={15}/></button>)}
    </article>;
  }

  return <section className={styles.section} aria-label="候補日時の比較">
    <div className={styles.heading}><h2>{host && best.eligible ? '集まる日程を選ぶ' : '候補ごとの回答'}</h2>
      {best.eligible && <p>{tied > 1 ? `${best.count.yes}人が参加できる候補が${tied}件` : `いちばん多く集まれるのは${best.count.yes}人`}</p>}
      {!best.eligible && <p>{rows.some(row => row.count.pending) ? '候補ごとに全員の回答がそろうと、日程を決められます。' : poll.attendanceBased ? '○が2人以上の候補が必要です。' : '全員が○の候補が必要です。'}</p>}
    </div>
    <div className={styles.list}>{rows.slice(0, 3).map(candidate)}</div>
    {rows.length > 3 && <details className={styles.more}>
      <summary>ほかの候補を見る（{rows.length - 3}件）</summary>
      <div className={styles.list}>{rows.slice(3).map(candidate)}</div>
    </details>}
  </section>;
}
