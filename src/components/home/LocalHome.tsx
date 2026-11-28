'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Plus, UsersRound, Utensils } from 'lucide-react';
import { gatheringAction, gatheringDescription, type Gathering } from './gathering';
import { loadDeviceGatherings } from './device-gatherings';
import styles from './LocalHome.module.css';

function EventRow({ entry }: { entry: Gathering }) {
  const { title, date, location, count } = gatheringDescription(entry);
  const action = gatheringAction(entry);
  const selected = action.venue;
  const photo = selected?.photos?.find(item => item.kind === 'interior' && (item.origin === 'venue' || item.origin === 'user') && !item.crop);
  return <li><Link className={styles.row} href={action.href}>
    {photo && <span className={styles.thumb} role="img" aria-label={photo.alt} style={{ backgroundImage: `url("${photo.src}")` }}/>}
    <div className={styles.rowBody}>
      <div className={styles.line}><h2>{title}</h2>{(entry.dateMember.host || entry.areaMember.host || entry.shopMember?.host) && <span className={styles.role}>幹事</span>}</div>
      <p className={styles.meta}>
        {date && <span><CalendarDays/>{date}</span>}{location && <span><MapPin/>{location}</span>}
        {count && <span><UsersRound/>{count}人</span>}
      </p>
      <p className={styles.detail}>{selected && <Utensils size={15}/>} {action.detail}</p>
      <span className={styles.action}>{action.label}<ArrowRight size={15}/></span>
    </div>
  </Link></li>;
}

export function LocalHome({ signedIn }: { signedIn: boolean }) {
  const [entries, setEntries] = useState<Gathering[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(8);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    void loadDeviceGatherings(active.signal).then(data => {
      if (active.signal.aborted) return;
      setEntries(data.entries); setFailed(data.retry);
    }).catch(() => {
      if (!active.signal.aborted) setFailed(true);
    }).finally(() => {
      if (controller.current === active) controller.current = null;
    });
  }, []);

  useEffect(() => {
    reload();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || /^meshimatch_(schedule|area_poll|shop)_v1_/.test(event.key)) reload();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', reload);
    window.addEventListener('pageshow', reload);
    window.addEventListener('storage', onStorage);
    return () => {
      controller.current?.abort();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', reload);
      window.removeEventListener('pageshow', reload);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload]);

  const hasGatherings = Boolean(entries?.length);
  useEffect(() => {
    if (!hasGatherings) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !controller.current) reload();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [hasGatherings, reload]);

  return <main className={styles.screen}><div className={styles.shell}>
    <header className={styles.top}><span className={styles.brand}>meshimatch</span>{signedIn && <Link href="/home?view=account">アカウントの集まり</Link>}</header>
    <div className={styles.heading}><h1>自分の集まり</h1><Link className={styles.create} href="/instant"><Plus size={17}/>集まりを作る</Link></div>
    {failed && <div className={styles.warning} role="status">一部の集まりを読み込めませんでした。<button type="button" onClick={reload}>もう一度読み込む</button></div>}
    {!entries && !failed && <p role="status">集まりを読み込み中…</p>}
    {entries && !entries.length && !failed && <section className={styles.empty}>
      <div className={styles.emptyIcon}><CalendarDays size={29}/></div>
      <h2>まだ集まりがありません</h2><p>このブラウザで作った集まりや、招待リンクから回答した集まりが表示されます。</p>
    </section>}
    {!!entries?.length && <ul className={styles.list}>{entries.slice(0, visible).map(entry => <EventRow key={entry.id} entry={entry}/>)}</ul>}
    {entries && entries.length > visible && <button className={styles.more} type="button" onClick={() => setVisible(value => value + 8)}>ほかの集まりを見る</button>}
  </div></main>;
}
