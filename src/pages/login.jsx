import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../App";
import "../styles/login.css";

export default function Login({ setOtpVerified }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // ------------------- LOGIN (Step 1: Password) -------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // First verify password
      const { data: loginData, error: loginError } =
        await supabaseClient.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError(loginError.message);
        setIsLoading(false);
        return;
      }

      // Development bypass: treat password login as fully verified.
      if (setOtpVerified) setOtpVerified(true);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Login failed. Try again.");
      setIsLoading(false);
    }
  };

  // ------------------- SEND OTP -------------------
  const sendOTP = async () => {
    try {
      // Sign out first to require OTP verification
      await supabaseClient.auth.signOut();

      // Send OTP to email
      const { error: otpError } = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false, // Don't create new users
        },
      });

      if (otpError) {
        setError(otpError.message);
        setIsLoading(false);
        return;
      }

      setOtpSent(true);
      setShowOtpInput(true);
      setIsLoading(false);
      setError(""); // Clear any previous errors
    } catch (err) {
      console.error(err);
      setError("Failed to send OTP. Try again.");
      setIsLoading(false);
    }
  };

  // ------------------- VERIFY OTP -------------------
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: verifyError } = await supabaseClient.auth.verifyOtp({
        email: email,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        setIsLoading(false);
        return;
      }

      // OTP verified successfully
      if (setOtpVerified) setOtpVerified(true);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("OTP verification failed. Try again.");
      setIsLoading(false);
    }
  };

  // ------------------- RESEND OTP -------------------
  const handleResendOTP = async () => {
    setError("");
    setIsLoading(true);
    await sendOTP();
  };

  // ------------------- RENDER -------------------
  return (
    <div className="login-page">
      <div className="centered-content">
        <div className="logo-section">
          <img src="images/logo.png" alt="Logo" className="logo-placeholder" />
          <div className="subtitle">Admin Login</div>
        </div>

        <div className="modern-card">
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

              {error && (
                <div style={{ color: "red", marginBottom: "10px" }}>
                  {error}
                </div>
              )}

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
              <div className="otp-info" style={{ marginBottom: "20px" }}>
                <p>
                  A verification code has been sent to <strong>{email}</strong>
                </p>
                <p style={{ fontSize: "14px", color: "#000000" }}>
                  Please check your email and enter the code below.
                </p>
              </div>

              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength="6"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ color: "red", marginBottom: "10px" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={`login-btn ${isLoading ? "loading" : ""}`}
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>

              <div style={{ marginTop: "15px", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#007bff",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Resend Code
                </button>
                <span style={{ margin: "0 10px", color: "#ccc" }}>|</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpInput(false);
                    setOtp("");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#007bff",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
