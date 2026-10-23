import { useEffect } from 'react';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ConfirmProvider } from './lib/confirm';
import { ToastProvider } from './lib/toast';
import { requestPersistence } from './db/db';
import { HQPage } from './hq/HQPage';
import { CreativeLibrary } from './modules/creative/CreativeLibrary';
import { CampaignEditor } from './modules/creative/CampaignEditor';
import { PlannedDesk } from './modules/stations/PlannedDesk';
import { CoreDesk } from './modules/stations/CoreDesk';
import { SettingsDesk } from './modules/stations/SettingsDesk';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HQPage />} />
      <Route path="/creative" element={<CreativeLibrary />} />
      <Route path="/creative/:id" element={<CampaignEditor />} />
      <Route path="/social" element={<PlannedDesk stationId="social" />} />
      <Route path="/finance" element={<PlannedDesk stationId="finance" />} />
      <Route path="/shop" element={<PlannedDesk stationId="shop" />} />
      <Route path="/booking" element={<PlannedDesk stationId="booking" />} />
      <Route path="/core" element={<CoreDesk />} />
      <Route path="/settings" element={<SettingsDesk />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    void requestPersistence();
  }, []);
  return (
    <ToastProvider>
      <ConfirmProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}
