import type { ReactNode } from 'react';
import { Armchair, Star, Utensils } from 'lucide-react';
import { PhotoCard } from '@/components/v2';
import { interiorPhotos, menuPhoto } from '@/lib/instant/discovery-photos';
import { formatDiscoveryPrice, noiseLabels, restaurantGenreLabels, styleLabels, type DiscoveryConfig, type DiscoveryPhoto } from '@/lib/instant/discovery';
import type { ShopCandidate } from '@/lib/shop-poll';
import css from './shop.module.css';

function ShopImage({ photo }: { photo: DiscoveryPhoto }) {
  const crop = photo.crop;
  return <span role="img" aria-label={photo.alt} className={css.image} style={{
    backgroundImage: `url("${photo.src}")`, aspectRatio: crop?.aspectRatio ?? 1.5,
    backgroundSize: crop ? `${crop.columns * 100}% ${crop.rows * 100}%` : 'cover',
    backgroundPosition: crop ? `${crop.column / Math.max(1, crop.columns - 1) * 100}% ${crop.row / Math.max(1, crop.rows - 1) * 100}%` : 'center',
  }} />;
}

export function ShopCard({ candidate, config, children }: { candidate: ShopCandidate; config: DiscoveryConfig; children?: ReactNode }) {
  const { shop } = candidate;
  const interior = interiorPhotos(shop)[0];
  const food = shop.menus.map(menuPhoto).find(Boolean);
  const hero = config.mode === '食事' ? food ?? interior : interior ?? food;
  const genres = config.mode === '食事' ? restaurantGenreLabels(shop).slice(0, 2).join('・') : styleLabels[shop.style] || 'カフェ';
  return <PhotoCard className={css.shopCard} photoAlt={hero?.alt ?? shop.name}
    placeholder={hero ? <ShopImage photo={hero}/> : <Utensils aria-hidden="true"/>}
    overlayStart={candidate.recommended ? <span className={css.badge}>参加者のおすすめ</span> : undefined}
    overlayEnd={hero && <span className={css.photoCaption}>{hero.kind === 'food' ? 'メニュー例' : '店内'}{hero.origin === 'ai-reference' ? 'のイメージ' : ''}</span>}>
    <p className={css.genre}>{genres}</p>
    <h3>{shop.name}</h3>
    <div className={css.facts}>
      <span aria-label={`評価${shop.rating}、口コミ${shop.reviewCount}件`}><Star size={14}/> {shop.rating.toFixed(1)}（{shop.reviewCount}件）</span>
      {noiseLabels[shop.noise] && <span><Armchair size={15}/>{noiseLabels[shop.noise]}</span>}
    </div>
    <p className={css.reason}>{candidate.groupReason}</p>
    <details className={css.menu}><summary>メニュー例を見る</summary>
      <ul>{shop.menus.map((menu, i) => {
        const photo = menuPhoto(menu);
        return <li key={menu.id ?? i}>{photo && <ShopImage photo={photo}/>}<span>{menu.name}<small>{formatDiscoveryPrice(config, menu.price)}</small></span></li>;
      })}</ul>
    </details>
    {children}
  </PhotoCard>;
}
