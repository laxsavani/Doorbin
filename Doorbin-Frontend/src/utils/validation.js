/**
 * Common Form Validation Utility Functions
 * SOP #7: Frontend form validation, error message formatting, and field focus logic.
 */

export const validators = {
  required: (value, fieldName = 'Field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (value, min, fieldName = 'Field') => {
    if (!value) return null;
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters long`;
    }
    return null;
  },

  phone: (value, fieldName = 'Mobile Number') => {
    if (!value || String(value).trim() === '') return null;
    const cleanDigits = String(value).replace(/\D/g, '');
    if (cleanDigits.length !== 10) {
      return `${fieldName} must be exactly 10 digits`;
    }
    return null;
  },

  validateFile: (file, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSizeBytes = 5 * 1024 * 1024) => {
    if (!file) return 'Please select a file to upload';
    
    // Validate file type (SOP #9.2)
    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed formats: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
    }

    // Validate file size (SOP #9.2)
    if (file.size > maxSizeBytes) {
      const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      return `File size exceeds maximum limit of ${maxMb}MB`;
    }

    return null;
  }
};

/**
 * SOP #7.4: Invalid fields must automatically receive focus when submitting the form.
 * Focuses the first DOM element that has the '.is-invalid' class or specified name attribute.
 * @param {Object} errors Object containing field validation error messages
 */
export const focusFirstErrorField = (errors) => {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return;

  const firstErrorKey = errorKeys[0];
  const invalidElement = document.querySelector(`[name="${firstErrorKey}"], .is-invalid`);
  if (invalidElement) {
    invalidElement.focus();
    invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
