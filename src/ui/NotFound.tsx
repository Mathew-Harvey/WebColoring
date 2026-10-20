import { copy } from '../copy';
import { BackLink } from './BackLink';
import { Icon } from './icons';
import { Logo } from './Logo';
import { Crayon } from './Paper';
import { href } from './router';

/** A screen or book that is not there: a friendly way back to the bookshelf. */
export function NotFound() {
  return (
    <div class="screen not-found">
      <main class="not-found-card">
        <Logo size="small" />
        <div class="not-found-art" aria-hidden="true">
          <Crayon colour="#ef5a52" dark="#c43c36" class="crayon-1" />
          <Crayon colour="#3e7fe0" dark="#2c5fae" class="crayon-2" />
        </div>
        <h1>{copy.misc.notFound}</h1>
        <p>{copy.misc.notFoundBody}</p>
        <BackLink class="btn btn-paper" to={href.home()}>
          <Icon name="home" size={26} /> {copy.misc.goHome}
        </BackLink>
      </main>
    </div>
  );
}
