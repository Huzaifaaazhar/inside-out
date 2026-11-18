import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/grandstander/600.css';
import '@fontsource/grandstander/700.css';
import '@fontsource/grandstander/800.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/700-italic.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Hold the loading screen until the fonts the canvas draws with are ready (or a short timeout).
const boot = document.getElementById('boot');
if (boot) {
  const done = () => {
    boot.classList.add('gone');
    window.setTimeout(() => boot.remove(), 600);
  };
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => window.setTimeout(r, 2500))]).then(done, done);
}
