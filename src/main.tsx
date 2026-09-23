import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UpdateNotice } from './components/UpdateNotice';
import { ToastProvider } from './state/toast';
import { StoreProvider } from './state/store';
import './index.css';
import { registerServiceWorker } from './lib/device';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <App />
          <UpdateNotice />
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
