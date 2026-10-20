import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { startHistory } from './ui/router';

startHistory();
render(<App />, document.getElementById('app')!);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check for a newer offline copy on every visit, not only when the browser gets round to it.
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => reg.update())
      .catch(() => {});
  });
}
