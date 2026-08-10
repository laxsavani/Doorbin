import React from 'react';

/**
 * Reusable FormField Component complying with SOP #7 (Form Validation Standards):
 * 7.2: Validation messages displayed directly below respective field.
 * 7.3: Invalid fields show a red border (.is-invalid).
 */
export const FormField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  children,
  ...props
}) => {
  const isInvalid = Boolean(error);

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={name} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}

      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
          aria-invalid={isInvalid}
          {...props}
        >
          {children}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
          aria-invalid={isInvalid}
          {...props}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
          aria-invalid={isInvalid}
          {...props}
        />
      )}

      {/* SOP #7.2: Validation message displayed directly below field */}
      {isInvalid && <span className="error-message">{error}</span>}
    </div>
  );
};
