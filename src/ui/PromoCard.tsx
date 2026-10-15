import { copy } from '../copy';
import { safeStoreUrl } from '../data/books';
import { HoldButton } from './HoldButton';
import { Icon } from './icons';

interface Props {
  storeUrl: string | null;
  title: string;
  variant: 'home' | 'picker' | 'finished';
}

/** A small, quiet "get the paperback" card. Hidden while the book has no store link. */
export function PromoCard({ storeUrl, title, variant }: Props) {
  const url = safeStoreUrl(storeUrl);
  if (!url) return null;
  const open = () => window.open(url, '_blank', 'noopener,noreferrer');
  if (variant === 'finished') {
    return (
      <div class="promo promo-finished">
        <HoldButton label={copy.promo.finishedLink} hint={copy.grownUps.holdHint} onDone={open} class="hold-link">
          <Icon name="book" size={22} />
        </HoldButton>
      </div>
    );
  }
  return (
    <aside class={`promo promo-${variant}`} aria-label={`${title}: ${variant === 'home' ? copy.promo.homeTitle : copy.promo.pickerTitle}`}>
      <Icon name="book" size={30} />
      <div class="promo-text">
        <strong>{variant === 'home' ? copy.promo.homeTitle : copy.promo.pickerTitle}</strong>
        <span>{variant === 'home' ? copy.promo.homeBody : copy.promo.pickerBody}</span>
      </div>
      <HoldButton label={copy.promo.button} hint={copy.grownUps.holdHint} onDone={open} class="hold-small">
        <Icon name="lock" size={18} />
      </HoldButton>
    </aside>
  );
}
