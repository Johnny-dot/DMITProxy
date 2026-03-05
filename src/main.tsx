import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { I18nProvider } from './context/I18nContext';

const initialTheme = (() => {
  const stored = window.localStorage.getItem('proxydog-theme');
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
})();
document.documentElement.setAttribute('data-theme', initialTheme);
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
