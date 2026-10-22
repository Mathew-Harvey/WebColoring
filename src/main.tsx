import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { startHistory } from './ui/router';

startHistory();
// A book's page (/book/<id>) arrives with its heading prerendered; the app draws the same screen
// in its place, in the same moment.
const root = document.getElementById('app')!;
root.textContent = '';
render(<App />, root);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check for a newer offline copy on every visit, not only when the browser gets round to it.
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => reg.update())
      .catch(() => {});
  });
}
