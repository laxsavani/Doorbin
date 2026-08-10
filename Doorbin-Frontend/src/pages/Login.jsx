import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../components/Toast';
import { validators, focusFirstErrorField } from '../utils/validation';
import { authService } from '../services/authService';
import { Eye, EyeOff, Layers, Check } from 'lucide-react';
import './Login.css';

export const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: 'laxsavani4259@gmail.com',
    password: '',
    rememberMe: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Curated High-End Interior & Architectural Render Gallery Wall
  const galleryWall = [
    {
      id: 1,
      title: 'Modern Villa Render',
      tag: 'Villa Render',
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
    },
    {
      id: 2,
      title: 'Luxury Living Room',
      tag: 'Living Space',
      url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&q=80',
    },
    {
      id: 3,
      title: 'Scandinavian Kitchen',
      tag: 'Kitchen CGI',
      url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80',
    },
    {
      id: 4,
      title: 'Minimal Bedroom Design',
      tag: 'Bedroom Interior',
      url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80',
    },
    {
      id: 5,
      title: 'Architectural Facade',
      tag: 'Exterior 3D',
      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
    },
    {
      id: 6,
      title: 'Warm Dining Space',
      tag: 'Dining Setup',
      url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=80',
    },
    {
      id: 7,
      title: 'Penthouse Lounge',
      tag: 'Penthouse',
      url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80',
    },
    {
      id: 8,
      title: 'Modern Terrace Garden',
      tag: 'Deck Design',
      url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80',
    },
    {
      id: 9,
      title: 'Sunset Elevation Render',
      tag: 'Elevation',
      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
    },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  /**
   * SOP #7: Form Validation Rules
   */
  const validateForm = () => {
    const newErrors = {};

    const emailErr = validators.required(formData.email, 'Email') || validators.email(formData.email);
    if (emailErr) newErrors.email = emailErr;

    const passwordErr = validators.required(formData.password, 'Password') || validators.minLength(formData.password, 6, 'Password');
    if (passwordErr) newErrors.password = passwordErr;

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => focusFirstErrorField(newErrors), 50);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setToast({ message: '', type: 'info' });

    try {
      // Calling Auth Service
      await authService.login(formData);

      // Trigger Inline Animated Success Card (Form vanishes, success replaces it on same background)
      setShowSuccessAnim(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1400);
    } catch (err) {
      setToast({
        message: err.message || 'Invalid login credentials.',
        type: 'error',
      });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setToast({
      message: 'Google Sign-In is currently in demonstration mode.',
      type: 'info',
    });
  };

  return (
    <div className="login-page-wrapper">
      {/* SOP #8: Global Toast Component */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />

      <div className="login-card-container">
        {/* LEFT COLUMN - INTERIOR DESIGN GALLERY WALL (50% VIEWPORT) */}
        <div className="login-showcase-section">
          {/* Ambient Glow */}
          <div className="login-showcase-glow" />

          {/* Centered Logo Header */}
          <div className="showcase-header-centered">
            <img src="/logo.png" alt="Doorbin Visuals Logo" className="showcase-logo-img" />
          </div>

          {/* Masonry Gallery Wall Container */}
          <div className="masonry-gallery-wrapper">
            <div className="masonry-grid">
              {galleryWall.map((item) => (
                <div key={item.id} className="masonry-item">
                  <img src={item.url} alt={item.title} className="masonry-img" />
                  <div className="masonry-tag">{item.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Showcase Footer */}
          <div className="showcase-footer-text">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <Layers size={18} color="#aa653e" />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e4dc', letterSpacing: '0.02em' }}>
                Powered By NexAlliance IT Solutions
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - LOGIN FORM SECTION (50% VIEWPORT, SAME BACKGROUND) */}
        <div className="login-form-section">
          {/* Form Content Body / Inline Success Card Container */}
          <div className="login-form-content-body">
            {showSuccessAnim ? (
              /* INLINE ANIMATED SUCCESS CARD ON SAME BACKGROUND */
              <div className="login-inline-success-card">
                <div className="login-inline-check-circle">
                  <Check size={40} color="#ffffff" strokeWidth={3.5} />
                </div>
                <h2 className="login-inline-success-title">Login Successful!</h2>
                <p className="login-inline-success-subtitle">Welcome back to Doorbin Visuals Studio</p>
                <div className="login-inline-loader-bar">
                  <div className="login-inline-loader-progress" />
                </div>
              </div>
            ) : (
              <>
                {/* Header Titles */}
                <div className="login-header-text">
                  <h1>Welcome Back</h1>
                  <p>Sign in to your Doorbin Studio workspace to manage architectural visualization projects</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} noValidate>
                  {/* Email Pill Input */}
                  <div className="pill-input-group">
                    <label htmlFor="email" className="pill-input-label">
                      Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="pill-input-wrapper">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="e.g. lax@doorbin.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={`pill-input ${errors.email ? 'is-invalid' : ''}`}
                        aria-invalid={Boolean(errors.email)}
                      />
                    </div>
                    {errors.email && <span className="error-message">{errors.email}</span>}
                  </div>

                  {/* Password Pill Input */}
                  <div className="pill-input-group">
                    <label htmlFor="password" className="pill-input-label">
                      Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="pill-input-wrapper">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`pill-input ${errors.password ? 'is-invalid' : ''}`}
                        aria-invalid={Boolean(errors.password)}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <span className="error-message">{errors.password}</span>}
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="login-options-row">
                    <label className="remember-me-label">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        checked={formData.rememberMe}
                        onChange={handleChange}
                        className="remember-checkbox"
                      />
                      <span>Remember me</span>
                    </label>

                    <a href="#forgot" onClick={(e) => { e.preventDefault(); setToast({ message: 'Please contact studio admin to reset credentials.', type: 'info' }); }} className="forgot-password-link">
                      Forgot Password?
                    </a>
                  </div>

                  {/* Bronze Gradient Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || showSuccessAnim}
                    className="btn-login-submit"
                  >
                    {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Form Footer */}
          <div className="login-form-footer">
            &copy; 2026 Doorbin Visuals · High-End Architectural Visualization
          </div>
        </div>
      </div>
    </div>
  );
};
