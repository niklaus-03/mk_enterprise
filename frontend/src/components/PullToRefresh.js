import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePullToRefreshContext } from '../context/PullToRefreshContext';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 80;   // px to pull before triggering
const MAX_PULL = 120;        // max visual displacement
const DESKTOP_WHEEL_THRESHOLD = 150; // accumulated wheel delta

export default function PullToRefresh({ children }) {
  const ctx = usePullToRefreshContext();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | pulling | refreshing | done
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef(null);

  // Desktop: accumulated wheel-up delta at scroll top
  const wheelAccum = useRef(0);
  const wheelTimer = useRef(null);

  const isAtTop = useCallback(() => {
    return window.scrollY <= 0;
  }, []);

  const doRefresh = useCallback(async () => {
    if (!ctx?.triggerRefresh) return;
    setPhase('refreshing');
    setRefreshing(true);
    setPullDistance(60);
    try {
      await ctx.triggerRefresh();
    } catch (e) {
      console.error('Pull-to-refresh error:', e);
    }
    // Brief pause so the user sees the "done" state
    setPhase('done');
    await new Promise(r => setTimeout(r, 400));
    setRefreshing(false);
    setPullDistance(0);
    setPhase('idle');
  }, [ctx]);

  // ── Touch events (mobile) ──────────────────────────────────
  useEffect(() => {
    const onTouchStart = (e) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e) => {
      if (!isPulling.current || refreshing) return;
      if (!isAtTop()) {
        isPulling.current = false;
        setPullDistance(0);
        setPhase('idle');
        return;
      }
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        const distance = Math.min(dy * 0.5, MAX_PULL);
        setPullDistance(distance);
        setPhase('pulling');
        // Prevent native scroll while pulling
        if (dy > 10) e.preventDefault();
      } else {
        setPullDistance(0);
        setPhase('idle');
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current || refreshing) return;
      isPulling.current = false;
      if (pullDistance >= PULL_THRESHOLD) {
        doRefresh();
      } else {
        setPullDistance(0);
        setPhase('idle');
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshing, pullDistance, isAtTop, doRefresh]);

  // ── Wheel events (desktop trackpad) ────────────────────────
  useEffect(() => {
    const onWheel = (e) => {
      if (refreshing) return;
      if (!isAtTop()) {
        wheelAccum.current = 0;
        return;
      }
      // deltaY < 0 means scrolling up (pulling down)
      if (e.deltaY < 0) {
        wheelAccum.current += Math.abs(e.deltaY);
        // Show visual indicator
        const visualPull = Math.min(wheelAccum.current * 0.4, MAX_PULL);
        setPullDistance(visualPull);
        setPhase('pulling');

        if (wheelAccum.current >= DESKTOP_WHEEL_THRESHOLD) {
          wheelAccum.current = 0;
          doRefresh();
        }

        // Reset accumulator after a pause (user stopped scrolling)
        clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          if (phase !== 'refreshing') {
            wheelAccum.current = 0;
            setPullDistance(0);
            setPhase('idle');
          }
        }, 600);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimer.current);
    };
  }, [refreshing, isAtTop, doRefresh, phase]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = phase !== 'idle';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Pull indicator */}
      <div style={{
        position: 'fixed',
        top: 60,
        left: '50%',
        transform: `translate(-50%, ${showIndicator ? '0' : '-60px'})`,
        zIndex: 9999,
        transition: phase === 'pulling' ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s',
        opacity: showIndicator ? 1 : 0,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-card, #fff)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}>
          <RefreshCw
            size={20}
            style={{
              color: phase === 'done' ? '#22c55e' : 'var(--primary, #2563eb)',
              transform: phase === 'refreshing'
                ? 'rotate(0deg)'
                : `rotate(${progress * 360}deg)`,
              animation: phase === 'refreshing' ? 'ptr-spin 0.8s linear infinite' : 'none',
              transition: phase === 'pulling' ? 'none' : 'color 0.3s',
            }}
          />
        </div>
      </div>

      {/* Content wrapper — slight push-down while pulling */}
      <div style={
        phase === 'pulling' 
          ? { transform: `translateY(${pullDistance * 0.3}px)`, transition: 'none' }
          : { transform: 'none', transition: 'none' }
      }>
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
