import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { startHistory } from './ui/router';

startHistory();
render(<App />, document.getElementById('app')!);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}
