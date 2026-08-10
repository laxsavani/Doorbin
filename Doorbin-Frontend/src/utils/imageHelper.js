/**
 * SOP #9.1: Frontend must append the backend domain before displaying images.
 * @param {string} imagePath - Relative path or full URL of image
 * @returns {string} - Complete absolute image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '/placeholder.png';
  
  // If already absolute URL (http/https/data-uri), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath;
  }

  const backendDomain = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:5000';
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${backendDomain}${cleanPath}`;
};
