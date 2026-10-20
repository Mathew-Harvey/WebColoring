import type { ComponentChildren } from 'preact';
import { goBack, goBackTo } from './router';

interface Props {
  /** Where back leads. */
  to: string;
  /** Back to wherever we came from (a side page) rather than straight to `to`. */
  previous?: boolean;
  class?: string;
  label?: string;
  children: ComponentChildren;
}

/**
 * Every back button. A real link to `to` (so it can still be opened in a new tab), that steps
 * back through history when it can, so in-app back and the phone's back gesture agree.
 */
export function BackLink({ to, previous, class: cls, label, children }: Props) {
  return (
    <a
      class={cls}
      href={to}
      aria-label={label}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (previous) goBack(to);
        else goBackTo(to);
      }}
    >
      {children}
    </a>
  );
}
