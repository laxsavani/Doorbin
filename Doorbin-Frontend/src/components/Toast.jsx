import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import './Toast.css';

/**
 * Toast alert component adhering to SOP #8:
 * Displays exact success & error messages returned from backend or validation response.
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

  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={18} color="var(--color-success)" />,
    error: <AlertCircle size={18} color="var(--color-danger)" />,
    info: <Info size={18} color="var(--color-secondary)" />
  };

  return (
    <div className="toast-container">
      <div className={`toast toast-${type}`} role="alert">
        {icons[type]}
        <div className="toast-content">{message}</div>
        <button className="toast-close" onClick={onClose} aria-label="Close notification">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
