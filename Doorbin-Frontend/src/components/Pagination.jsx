import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const handlePrev = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.85rem 1.25rem',
      backgroundColor: '#faf9f6',
      borderTop: '1px solid #efeae1',
      marginTop: '1rem',
      borderRadius: '0 0 12px 12px',
      flexWrap: 'wrap',
      gap: '0.75rem'
    }}>
      <div style={{ fontSize: '0.8rem', color: '#525252', fontWeight: 600 }}>
        Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{totalItems}</strong> items
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid #dcd8cf',
            backgroundColor: currentPage === 1 ? '#f3eee7' : '#ffffff',
            color: currentPage === 1 ? '#a3a3a3' : '#1F1F1F',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1F1F1F', padding: '0 0.5rem' }}>
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid #dcd8cf',
            backgroundColor: currentPage === totalPages ? '#f3eee7' : '#ffffff',
            color: currentPage === totalPages ? '#a3a3a3' : '#1F1F1F',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
