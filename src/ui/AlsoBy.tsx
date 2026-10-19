import { copy } from '../copy';
import { useHold } from './HoldButton';

declare const __PUBLIC__: string;

// "Also by Mat Harvey": the other sites, each in its own mark, as on thebodyweightgym.org and
// webfpv.org. Those sites are dark, so their logos are drawn light; this page is light, so the
// logos in public/also-by are the same files drawn in the ink colour, and the two wordmarks
// borrow each site's accent a few shades deeper so they can be read on cream.
//
// This is the children's home screen, so like every link that leaves the site, each one opens
// only after a grown-up holds it down.

type Site =
  | { key: keyof typeof copy.alsoBy.sites; url: string; logo: string; width: number; height: number }
  | { key: keyof typeof copy.alsoBy.sites; url: string; mark: [string, string]; accent: string };

const SITES: Site[] = [
  { key: 'gym', url: 'https://thebodyweightgym.org/', logo: 'the-bodyweight-gym.png', width: 268, height: 72 },
  { key: 'webfpv', url: 'https://webfpv.org/', mark: ['WEB', 'FPV'], accent: '#b0486a' },
  { key: 'apphub', url: 'https://my-app-hub.com/', logo: 'apphub.png', width: 98, height: 66 },
  { key: 'winmarchy', url: 'https://winmarchy.org/', mark: ['win', 'marchy'], accent: '#4c7a1f' },
];

function AlsoLink({ site }: { site: Site }) {
  const name = copy.alsoBy.sites[site.key];
  const { progress, handlers } = useHold(() => window.open(site.url, '_blank', 'noopener,noreferrer'));
  return (
    <a class="also-link" href={site.url} aria-label={`${name}. ${copy.alsoBy.hint}`} {...handlers}>
      {'logo' in site ? (
        <img
          src={`./${__PUBLIC__}also-by/${site.logo}`}
          width={site.width}
          height={site.height}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span class="also-mark" aria-hidden="true">
          {site.mark[0]}
          <span style={{ color: site.accent }}>{site.mark[1]}</span>
        </span>
      )}
      <span class="also-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
    </a>
  );
}

export function AlsoBy() {
  return (
    <nav class="also" aria-label={copy.alsoBy.label}>
      <span class="also-label">{copy.alsoBy.label}</span>
      <div class="also-row">
        {SITES.map((s) => (
          <AlsoLink key={s.key} site={s} />
        ))}
      </div>
      <span class="also-hint">{copy.alsoBy.hint}</span>
    </nav>
  );
}
