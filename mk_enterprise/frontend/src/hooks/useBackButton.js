import { useEffect, useRef } from 'react';

/**
 * useBackButton
 * Handles the hardware back button for modals, dropdowns, and overlays.
 * It prevents the app from navigating away when the user just wants to close a modal.
 */
export default function useBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy state to history
    window.history.pushState({ modalId: 'app-modal' }, '');

    const handlePopState = () => {
      // The browser already popped the state, so we just call onClose
      if (onCloseRef.current) onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      
      // If the modal was closed via UI (not back button)
      // and the current state is still our modal, we need to go back 
      // to remove the pushed state.
      if (window.history.state && window.history.state.modalId === 'app-modal') {
        window.history.back();
      }
    };
  }, [isOpen]);
}
