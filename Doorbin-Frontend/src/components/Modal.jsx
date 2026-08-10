import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Reusable Popup / Modal component conforming to SOP #6:
 * 6.1: Header remains fixed
 * 6.2: Footer remains fixed
 * 6.3: Only body content is scrollable
 * 6.4: Mobile popup displays as Bottom Sheet
 */
export const Modal = ({
  isOpen = true,
  onClose,
  title,
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* SOP #6.1: Fixed Header */}
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* SOP #6.3: Scrollable Content Body */}
        <div className="modal-content">
          {children}
        </div>

        {/* SOP #6.2: Fixed Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
