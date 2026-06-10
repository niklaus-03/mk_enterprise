import React, { createContext, useContext, useRef, useCallback } from 'react';

const PullToRefreshContext = createContext(null);

export function PullToRefreshProvider({ children }) {
  const handlerRef = useRef(null);

  const setRefreshHandler = useCallback((fn) => {
    handlerRef.current = fn;
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (handlerRef.current) {
      await handlerRef.current();
    }
  }, []);

  return (
    <PullToRefreshContext.Provider value={{ setRefreshHandler, triggerRefresh }}>
      {children}
    </PullToRefreshContext.Provider>
  );
}

/**
 * Hook for pages to register their refresh function.
 * Call once in useEffect: useRegisterRefresh(myLoadDataFn)
 */
export function useRegisterRefresh(refreshFn) {
  const ctx = useContext(PullToRefreshContext);
  React.useEffect(() => {
    if (ctx) ctx.setRefreshHandler(refreshFn);
    return () => { if (ctx) ctx.setRefreshHandler(null); };
  }, [ctx, refreshFn]);
}

export function usePullToRefreshContext() {
  return useContext(PullToRefreshContext);
}
