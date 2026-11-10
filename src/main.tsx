import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { db, ensureSeeded } from './data/db';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

ensureSeeded(db)
  .catch((e) => console.error('Seed failed', e))
  .finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
