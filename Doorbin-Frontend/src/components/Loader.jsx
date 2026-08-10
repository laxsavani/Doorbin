import React from 'react';
import './Loader.css';

export const Loader = ({ text = 'Loading data...' }) => {
  return (
    <div className="loader-container">
      <div className="loader-spinner-ring" />
      {text && <div className="loader-text">{text}</div>}
    </div>
  );
};
