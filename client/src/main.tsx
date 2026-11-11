import '@fontsource-variable/fraunces/soft.css';
import '@fontsource-variable/inter/index.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { start } from './ws';

start();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root missing');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
