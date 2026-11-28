'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CafeSurvey } from '@/components/instant/CafeSurvey';
import { RestaurantSurvey } from '@/components/instant/RestaurantSurvey';
import { freshAnswer } from '@/lib/instant/discovery';
import type { ShopPoll } from '@/lib/shop-poll';
import styles from './shop.module.css';

type PreviewProps = Pick<ShopPoll, 'config' | 'pendingArea'> & {
  previousPath: string;
  sharePath: string;
};

export function ShopSurveyPreview({ config, pendingArea, previousPath, sharePath }: PreviewProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(freshAnswer);
  const cafe = config.mode === 'カフェ・軽食';
  const Survey = cafe ? CafeSurvey : RestaurantSurvey;
  return <main className={styles.screen}><div className={styles.shell}>
    <nav className={styles.nav}>
      <Link href={previousPath}><ArrowLeft size={16}/> 前の画面へ</Link>
      <Link href={sharePath}>共有画面へ</Link>
    </nav>
    <header className={styles.header}>
      <p className={styles.event}>参加者プレビュー</p>
      <h1>{cafe ? 'カフェの希望' : 'レストランの希望'}</h1>
      <p className={styles.sub}>ここで選んだ内容は集計に含まれません。</p>
    </header>
    <Survey config={config} pendingArea={pendingArea} draft={draft} onChange={setDraft}
      lastPerson submitLabel="プレビューを終える" onSubmit={event => {
        event.preventDefault();
        router.push(sharePath);
      }} />
  </div></main>;
}
