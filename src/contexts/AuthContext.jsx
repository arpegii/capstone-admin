import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../App";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Restore session on refresh
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setUser(data.session.user);
        setOtpVerified(true);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
        setOtpVerified(true);
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setOtpVerified(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const openLogoutModal = () => {
    console.log("=== openLogoutModal CALLED ===");
    console.log("Current showLogoutModal state:", showLogoutModal);
    setShowLogoutModal(true);
    console.log("setShowLogoutModal(true) executed");
  };

  const closeLogoutModal = () => {
    console.log("=== closeLogoutModal CALLED ===");
    setShowLogoutModal(false);
  };

  const handleLogout = async () => {
    console.log("=== handleLogout CALLED ===");
    await supabaseClient.auth.signOut();
    setShowLogoutModal(false);
    navigate("/");
  };

  // Debug: Log state changes
  useEffect(() => {
    console.log("=== showLogoutModal STATE CHANGED ===", showLogoutModal);
  }, [showLogoutModal]);

  const value = {
    user,
    otpVerified,
    loading,
    showLogoutModal,
    openLogoutModal,
    closeLogoutModal,
    handleLogout,
    setOtpVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};