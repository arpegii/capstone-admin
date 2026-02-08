import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../App";
import "../styles/login.css";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

export default function Login({ setOtpVerified }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpResultModal, setOtpResultModal] = useState({ open: false, type: "success", message: "" });
  const otpInputRefs = useRef([]);
  const lastAutoSubmittedOtpRef = useRef("");

  const normalizedEmail = email.trim().toLowerCase();
  const otpCode = otpDigits.join("");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timerId = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [resendCooldown]);

  useEffect(() => {
    if (showOtpInput) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 0);
    }
  }, [showOtpInput]);

  const isEmailRateLimitError = (err) => {
    const message = String(err?.message || "").toLowerCase();
    return err?.status === 429 || message.includes("rate limit");
  };

  // ------------------- LOGIN (Step 1: Password) -------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Step 1: verify account credentials
      const { error: loginError } =
        await supabaseClient.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginError) {
        setError(loginError.message);
        setIsLoading(false);
        return;
      }

      // Step 2: force OTP by clearing any existing session and sending code
      if (setOtpVerified) setOtpVerified(false);
      await supabaseClient.auth.signOut();
      try {
        await sendOTP(normalizedEmail);
        setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      } catch (otpError) {
        if (isEmailRateLimitError(otpError)) {
          setShowOtpInput(true);
          setError("A code was sent recently. Please use it or wait before requesting a new one.");
          setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
          return;
        }
        throw otpError;
      }

      setShowOtpInput(true);
      setOtpDigits(["", "", "", "", "", ""]);
      lastAutoSubmittedOtpRef.current = "";
      setError("");
    } catch (err) {
      console.error(err);
      setError("Login failed. Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------- SEND OTP -------------------
  const sendOTP = async (targetEmail = normalizedEmail) => {
    const { error: otpError } = await supabaseClient.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      throw otpError;
    }
  };

  // ------------------- VERIFY OTP -------------------
  const handleVerifyOTP = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: verifyError } = await supabaseClient.auth.verifyOtp({
        email: normalizedEmail,
        token: otpCode.trim(),
        type: "email",
      });

      if (verifyError) {
        setOtpResultModal({
          open: true,
          type: "error",
          message: verifyError.message || "Incorrect OTP. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      // OTP verified successfully
      if (setOtpVerified) setOtpVerified(true);
      setOtpResultModal({
        open: true,
        type: "success",
        message: "OTP verified successfully. You can now continue to the dashboard.",
      });
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setOtpResultModal({
        open: true,
        type: "error",
        message: "OTP verification failed. Try again.",
      });
      setIsLoading(false);
    }
  }, [normalizedEmail, otpCode, setOtpVerified]);

  // ------------------- RESEND OTP -------------------
  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setIsLoading(true);
    try {
      await sendOTP(normalizedEmail);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setError("A new verification code has been sent.");
      setOtpDigits(["", "", "", "", "", ""]);
      lastAutoSubmittedOtpRef.current = "";
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 0);
    } catch (err) {
      console.error(err);
      if (isEmailRateLimitError(err)) {
        setError("You requested codes too quickly. Please wait and try again.");
        setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      } else {
        setError("Failed to resend OTP. Try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    const next = [...otpDigits];
    next[index] = cleaned.slice(-1);
    setOtpDigits(next);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((digit, idx) => {
      next[idx] = digit;
    });
    setOtpDigits(next);
    const nextFocusIndex = Math.min(pasted.length, 5);
    setTimeout(() => {
      otpInputRefs.current[nextFocusIndex]?.focus();
    }, 0);
  };

  useEffect(() => {
    if (!showOtpInput) return;
    if (otpCode.length !== 6) return;
    if (isLoading) return;
    if (otpCode === lastAutoSubmittedOtpRef.current) return;

    lastAutoSubmittedOtpRef.current = otpCode;
    handleVerifyOTP({ preventDefault: () => {} });
  }, [otpCode, isLoading, showOtpInput, handleVerifyOTP]);

  const closeOtpResultModal = () => {
    const isSuccess = otpResultModal.type === "success";
    setOtpResultModal({ open: false, type: "success", message: "" });
    if (isSuccess) {
      navigate("/dashboard");
      return;
    }
    setOtpDigits(["", "", "", "", "", ""]);
    lastAutoSubmittedOtpRef.current = "";
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 0);
  };

  useEffect(() => {
    if (!otpResultModal.open || otpResultModal.type !== "success") return undefined;
    const timerId = setTimeout(() => {
      navigate("/dashboard");
    }, 2200);
    return () => clearTimeout(timerId);
  }, [otpResultModal.open, otpResultModal.type, navigate]);

  // ------------------- RENDER -------------------
  return (
    <div className="login-page">
      <div className="centered-content">
        <div className="modern-card">
          <div className="login-card-brand">
            <img src="images/logo.png" alt="Logo" className="logo-placeholder" />
            <div className="subtitle">Admin Login</div>
          </div>

          {!showOtpInput ? (
            // Password Form
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                className={`login-btn ${isLoading ? "loading" : ""}`}
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Sign In"}
              </button>
            </form>
          ) : (
            // OTP Form
            <form onSubmit={handleVerifyOTP}>
              <div className="otp-info">
                <p>
                  A verification code has been sent to <strong>{email}</strong>
                </p>
                <p className="otp-subtext">
                  Please check your email and enter the code below.
                </p>
              </div>

              <div className="form-group">
                <label>Verification Code</label>
                <div className="otp-input-container" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={`otp-${index}`}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      className="otp-input-box"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      maxLength={1}
                      aria-label={`OTP digit ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              {error && <div className="login-error">{error}</div>}

              <p className="otp-auto-verify">
                {isLoading ? "Verifying code..." : "Code verifies automatically after 6 digits."}
              </p>

              <div className="otp-actions">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading || resendCooldown > 0}
                  className="otp-link-btn"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
                <span className="otp-divider">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpInput(false);
                    setOtpDigits(["", "", "", "", "", ""]);
                    lastAutoSubmittedOtpRef.current = "";
                    setError("");
                  }}
                  className="otp-link-btn"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {otpResultModal.open && (
        <div
          className="otp-result-overlay"
          onClick={() => {
            if (otpResultModal.type === "error") closeOtpResultModal();
          }}
        >
          <div className="otp-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="otp-result-header">
              <h3>{otpResultModal.type === "success" ? "Verification Successful" : "Verification Failed"}</h3>
            </div>
            <div className="otp-result-body">
              <div className={`otp-result-symbol ${otpResultModal.type}`} aria-hidden="true">
                {otpResultModal.type === "success" ? (
                  <span className="otp-result-checkmark" />
                ) : (
                  <span className="otp-result-xmark" />
                )}
              </div>
              <p className="otp-result-message">
                {otpResultModal.type === "success"
                  ? "OTP verified successfully. Redirecting to dashboard..."
                  : otpResultModal.message}
              </p>
              {otpResultModal.type === "error" && (
                <button type="button" className="otp-result-btn" onClick={closeOtpResultModal}>
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
