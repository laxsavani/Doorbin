import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../components/Toast';
import { validators, focusFirstErrorField } from '../utils/validation';
import { authService } from '../services/authService';
import { Eye, EyeOff, Layers, Check, ShieldAlert, Clock } from 'lucide-react';
import './Login.css';

export const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);
  const [failedAttemptCount, setFailedAttemptCount] = useState(() => {
    return Number(localStorage.getItem('doorbin_login_failed_attempts') || 0);
  });
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Check rate-limit lockout status on mount & timer tick
  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntil = Number(localStorage.getItem('doorbin_login_lockout_until') || 0);
      const attempts = Number(localStorage.getItem('doorbin_login_failed_attempts') || 0);
      setFailedAttemptCount(attempts);

      const now = Date.now();
      if (lockoutUntil > now || attempts >= 5) {
        const lockoutTime = lockoutUntil > now ? lockoutUntil : (now + 15 * 60 * 1000);
        if (!lockoutUntil || lockoutUntil <= now) {
          localStorage.setItem('doorbin_login_lockout_until', String(lockoutTime));
        }
        setIsLockedOut(true);
        setLockoutRemainingMs(Math.max(1000, lockoutTime - now));
      } else {
        setIsLockedOut(false);
        setLockoutRemainingMs(0);
      }
    };

    checkLockout();
    const interval = setInterval(() => {
      const lockoutUntil = Number(localStorage.getItem('doorbin_login_lockout_until') || 0);
      const attempts = Number(localStorage.getItem('doorbin_login_failed_attempts') || 0);
      const diff = lockoutUntil - Date.now();

      if (diff <= 0 && attempts < 5) {
        setIsLockedOut(false);
        setLockoutRemainingMs(0);
      } else if (diff <= 0 && attempts >= 5) {
        // Expiration reached
        setIsLockedOut(false);
        setLockoutRemainingMs(0);
        setFailedAttemptCount(0);
        localStorage.removeItem('doorbin_login_lockout_until');
        localStorage.removeItem('doorbin_login_failed_attempts');
      } else {
        setIsLockedOut(true);
        setLockoutRemainingMs(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatMinutesSeconds = (ms) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  // Curated High-End Interior & Architectural Render Gallery Wall
  const galleryWall = [
    {
      id: 1,
      title: 'The Hill Home',
      tag: 'The Hill Home',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2021/01/FL1-A.jpg',
    },
    {
      id: 2,
      title: 'Kids Room',
      tag: 'Kids Room',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2021/01/Kids-Bedroom-1-Cam-A.jpg',
    },
    {
      id: 3,
      title: 'RG Residance',
      tag: 'RG Residance',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2021/01/Parents-Room-01.jpg',
    },
    {
      id: 4,
      title: 'McNulty Rd',
      tag: 'McNulty Rd',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/06/McNulty-Rd-Cam-B.jpg',
    },
    {
      id: 5,
      title: 'Residential Tower',
      tag: 'Residential Tower',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/02/TC_Residence-Ar_Tanmay_Choksi.jpg',
    },
    {
      id: 6,
      title: 'Autobotss',
      tag: 'Autobotss ',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/02/Auto_Botss-Ninsquare_Architects-2.jpg',
    },
    {
      id: 7,
      title: 'Luxe Dining',
      tag: 'Luxe Dining',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/02/Luxe_Dining_Osri_Architects.jpg',
    },
    {
      id: 8,
      title: 'Dunlop Ave Townhouse',
      tag: 'Dunlop Ave Townhouse',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/02/Dunlop_Ave_Townhouse-Alan_Didak.jpg',
    },
    {
      id: 9,
      title: 'Compact Living',
      tag: 'Compact Living',
      url: 'https://www.doorbinvisuals.in/wp-content/uploads/2020/02/Compact_Living_Priyanka_Gohil2.jpg',
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

    if (isLockedOut) {
      setToast({
        message: `Too many failed attempts! Account is blocked for ${formatMinutesSeconds(lockoutRemainingMs)}.`,
        type: 'error',
      });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    setToast({ message: '', type: 'info' });

    try {
      // Calling Auth Service
      await authService.login(formData);

      // Reset failed attempts on success
      localStorage.removeItem('doorbin_login_failed_attempts');
      localStorage.removeItem('doorbin_login_lockout_until');
      setFailedAttemptCount(0);
      setIsLockedOut(false);

      // Trigger Inline Animated Success Card
      setShowSuccessAnim(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
    } catch (err) {
      const attempts = Number(localStorage.getItem('doorbin_login_failed_attempts') || 0) + 1;
      localStorage.setItem('doorbin_login_failed_attempts', String(attempts));
      setFailedAttemptCount(attempts);

      const isBackend429 = err.status === 429 || (err.message && err.message.includes('blocked'));

      if (attempts >= 5 || isBackend429) {
        const lockoutTime = err.data?.lockoutUntil || (Date.now() + 15 * 60 * 1000);
        localStorage.setItem('doorbin_login_lockout_until', String(lockoutTime));
        setIsLockedOut(true);
        setLockoutRemainingMs(Math.max(1000, lockoutTime - Date.now()));
        setToast({
          message: '5 consecutive failed login attempts! Your account access is temporarily blocked for 15 minutes.',
          type: 'error',
        });
      } else {
        const remaining = Math.max(1, 5 - attempts);
        setToast({
          message: `${err.message || 'Invalid login credentials.'} (${remaining} attempt${remaining > 1 ? 's' : ''} remaining before 15-min lockout)`,
          type: 'error',
        });
      }
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
          {/* Form Content Body / Inline Success & Lockout Card Container */}
          <div className="login-form-content-body">
            {isLockedOut ? (
              /* RATE LIMIT LOCKOUT CARD WITH COUNTDOWN & BLOCK SIGN */
              <div className="login-inline-lockout-card">
                <div className="login-inline-lockout-circle">
                  <ShieldAlert size={44} color="#dc2626" strokeWidth={2.5} />
                </div>
                <h2 className="login-inline-lockout-title">Account Temporarily Blocked</h2>
                <p className="login-inline-lockout-subtitle">
                  5 consecutive failed login attempts detected. Access has been temporarily restricted for security.
                </p>
                <div className="login-lockout-timer-box">
                  <Clock size={18} color="#dc2626" />
                  <span>Try again in {formatMinutesSeconds(lockoutRemainingMs)}</span>
                </div>
              </div>
            ) : showSuccessAnim ? (
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
                        autoComplete="username"
                        placeholder="e.g. doorbin@gmail.com"
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
                        autoComplete="current-password"
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

                  {/* Failed Attempt Warning Badge */}
                  {failedAttemptCount > 0 && failedAttemptCount < 5 && (
                    <div style={{
                      backgroundColor: '#fff7ed',
                      border: '1px solid #ffedd5',
                      color: '#c2410c',
                      borderRadius: '12px',
                      padding: '0.5rem 0.85rem',
                      marginBottom: '1rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      ⚠️ Failed login attempts: <strong>{failedAttemptCount} / 5</strong>. (Lockout after 5 failures)
                    </div>
                  )}

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
