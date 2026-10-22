import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { bookPageCopy } from '../data/books';
import { Colouring } from './Colouring';
import { GrownUps } from './GrownUps';
import { Home } from './Home';
import { NotFound } from './NotFound';
import { PaperPage } from './Paper';
import { Picker } from './Picker';
import { useRoute } from './router';

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
  }, [route.name, route.name === 'picker' || route.name === 'paper' ? route.bookId : '']);

  // A book's pages carry the book's own title, as its prerendered page does.
  const pageTitle = route.name === 'picker' ? bookPageCopy(route.bookId)?.title : undefined;
  useEffect(() => {
    document.title = pageTitle ?? copy.appName;
  }, [pageTitle]);

  let screen;
  switch (route.name) {
    case 'home':
      screen = <Home />;
      break;
    case 'picker':
      screen = <Picker key={route.bookId} bookId={route.bookId} />;
      break;
    case 'colour':
      screen = <Colouring bookId={route.bookId} pageId={route.pageId} done={route.done} cbn={route.cbn} />;
      break;
    case 'grownups':
      screen = <GrownUps />;
      break;
    case 'paper':
      screen = <PaperPage bookId={route.bookId} />;
      break;
    default:
      screen = <NotFound />;
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
