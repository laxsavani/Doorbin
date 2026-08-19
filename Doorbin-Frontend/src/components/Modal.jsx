import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Reusable Popup / Modal component conforming to SOP #6:
 * - Rendered directly to document.body via React Portal to prevent viewport clipping
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
  maxWidth = '580px',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Lock both body and internal dashboard scroll areas
      const originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      const scrollAreas = document.querySelectorAll('.dashboard-content-scroll-area, .dashboard-layout');
      scrollAreas.forEach(el => {
        el.style.overflow = 'hidden';
      });

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalBodyOverflow || 'unset';
        scrollAreas.forEach(el => {
          el.style.overflow = '';
        });
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalNode = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth }}
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
            <X size={18} />
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

  return createPortal(modalNode, document.body);
};
