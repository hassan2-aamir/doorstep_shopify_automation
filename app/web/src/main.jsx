import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AppShell } from './components/AppShell.jsx';
import { PublicShell } from './components/PublicShell.jsx';
import { Welcome } from './screens/Welcome.jsx';
import { Setup } from './screens/Setup.jsx';
import { Today } from './screens/Today.jsx';
import { SyncHealth } from './screens/SyncHealth.jsx';
import { Connections } from './screens/Connections.jsx';
import { Orders } from './screens/Orders.jsx';
import { OrderDrawer } from './screens/OrderDrawer.jsx';
import { NotFound } from './screens/NotFound.jsx';

// Follow the system theme (no toggle), applied before first paint so there's no light flash.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches);
applyTheme();
darkQuery.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <WorkspaceProvider>
          <Routes>
            <Route element={<PublicShell />}>
              <Route index element={<Welcome />} />
              <Route path="welcome" element={<Welcome />} />
              <Route path="setup" element={<Setup />} />
            </Route>
            <Route element={<AppShell />}>
              <Route path="today" element={<Today />} />
              <Route path="orders" element={<Orders />}>
                <Route path=":orderId" element={<OrderDrawer />} />
              </Route>
              <Route path="sync-health" element={<SyncHealth />} />
              <Route path="connections" element={<Connections />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
