import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsApi } from '../utils/api';
import { useAuth } from './AuthContext';

const AppContext = createContext();

const DEFAULT_SETTINGS = {
  business_name: 'My Shop',
  business_address: '',
  business_phone: '',
  business_gstin: '',
  business_state: '',
  upi_id: '',
  upi_name: '',
  invoice_prefix: 'INV',
  language: 'en',
  gst_enabled: true,
  discount_enabled: false,
  currency_symbol: '₹',
};

export function AppProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [globalDate, setGlobalDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (isAuthenticated) {
      settingsApi.get()
        .then(s => { setSettings(s); setSettingsLoaded(true); })
        .catch(() => setSettingsLoaded(true));
    }
  }, [isAuthenticated]);

  const updateSettings = async (data) => {
    const updated = await settingsApi.update(data);
    setSettings(updated);
    return updated;
  };

  const t = (en, hi_text) => settings.language === 'hi' && hi_text ? hi_text : en;

  return (
    <AppContext.Provider value={{ settings, settingsLoaded, updateSettings, t, globalDate, setGlobalDate }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
