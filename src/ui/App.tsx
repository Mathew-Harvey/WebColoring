import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { Colouring } from './Colouring';
import { GrownUps } from './GrownUps';
import { Home } from './Home';
import { Picker } from './Picker';
import { href, useRoute } from './router';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  return online;
}

export function App() {
  const route = useRoute();
  const online = useOnline();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name, route.name === 'picker' ? route.bookId : '']);

  let screen;
  switch (route.name) {
    case 'home':
      screen = <Home />;
      break;
    case 'picker':
      screen = <Picker bookId={route.bookId} />;
      break;
    case 'colour':
      screen = <Colouring bookId={route.bookId} pageId={route.pageId} done={route.done} cbn={route.cbn} />;
      break;
    case 'grownups':
      screen = <GrownUps />;
      break;
    default:
      screen = (
        <div class="screen">
          <p class="notice">{copy.misc.notFound}</p>
          <a class="btn" href={href.home()}>
            {copy.misc.goHome}
          </a>
        </div>
      );
  }

  return (
    <>
      {screen}
      {!online && route.name !== 'colour' && (
        <p class="offline-note" role="status">
          {copy.misc.offline}
        </p>
      )}
    </>
  );
}
