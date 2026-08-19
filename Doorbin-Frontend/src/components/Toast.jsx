import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import './Toast.css';

/**
 * Toast alert component mounted via React Portal to body.
 * Always renders floating in top-right corner.
 */
export const Toast = ({
  message,
  type = 'info', // 'success' | 'error' | 'info'
  onClose,
  duration = 4000
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message || typeof document === 'undefined') return null;

  const icons = {
    success: <CheckCircle2 size={18} color="#2E7D4E" />,
    error: <AlertCircle size={18} color="#C75B39" />,
    info: <Info size={18} color="#1C1A17" />
  };

  const toastContent = (
    <div className="toast-portal-wrapper" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 999999, pointerEvents: 'auto' }}>
      <div className={`toast toast-${type}`} role="alert">
        {icons[type]}
        <div className="toast-content">{message}</div>
        <button className="toast-close" onClick={onClose} aria-label="Close notification">
          <X size={16} />
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(toastContent, document.body);
};
