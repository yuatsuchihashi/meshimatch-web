'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { ArrowRight, Check, UserRound } from 'lucide-react';
import { maxDeviceNameLength, readDeviceName, saveDeviceName, subscribeDeviceName } from '@/lib/device-profile';
import styles from './DeviceProfile.module.css';

const serverName = () => '';

export function DeviceProfile({ hasAccount }: { hasAccount: boolean }) {
  const saved = useSyncExternalStore(subscribeDeviceName, readDeviceName, serverName);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const value = draft ?? saved;

  function apply(name: string) {
    try {
      saveDeviceName(name);
      setDraft(null);
      setError('');
      setNotice(name ? '表示名を保存しました。' : 'このブラウザから表示名を削除しました。');
    } catch {
      setNotice('');
      setError('保存できませんでした。ブラウザのサイトデータ設定を確認してください。');
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const name = value.trim();
    if (name && name !== saved) apply(name);
  }

  return <main className={styles.page}>
    <div className={styles.shell}>
      <Link className={styles.brand} href="/home">meshimatch</Link>
      <h1>プロフィール</h1>
      <section className={styles.card} aria-labelledby="device-profile-title">
        <div className={styles.heading}><UserRound size={20} aria-hidden="true" /><h2 id="device-profile-title">回答に使う名前</h2></div>
        <p>名前を保存すると、新しい集まりの回答欄に入ります。集まりごとに変更できます。</p>
        <form onSubmit={submit}>
          <label htmlFor="device-name">表示名</label>
          <input id="device-name" name="displayName" type="text" autoComplete="nickname"
            placeholder="ニックネームでもOK" maxLength={maxDeviceNameLength} value={value}
            aria-describedby="device-name-privacy" onChange={event => { setDraft(event.target.value); setNotice(''); setError(''); }} />
          <small id="device-name-privacy">保存先はこのブラウザです。回答を送ると、その集まりの参加者に名前が表示されます。</small>
          <div className={styles.actions}>
            <button className={styles.save} type="submit" disabled={!value.trim() || value.trim() === saved}>表示名を保存</button>
            {saved && <button className={styles.forget} type="button" onClick={() => apply('')}>保存した名前を削除</button>}
          </div>
        </form>
        {notice && <p role="status" className={styles.notice}><Check size={16} aria-hidden="true" />{notice}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </section>
      {hasAccount && <Link className={styles.account} href="/profile?view=account">アカウントのプロフィールを開く<ArrowRight size={16}/></Link>}
    </div>
  </main>;
}
