// components/logoutmodal.jsx
import { useState, useEffect } from "react";
import { supabaseClient } from "../App";
import "../styles/logoutModal.css";

export default function LogoutModal({ isOpen, onCancel, onConfirm }) {
  console.log("=== LOGOUT MODAL COMPONENT RENDER ===");
  console.log("isOpen prop:", isOpen);
  console.log("onCancel:", typeof onCancel);
  console.log("onConfirm:", typeof onConfirm);
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    console.log("LogoutModal useEffect - isOpen changed to:", isOpen);
    if (!isOpen) {
      setIsLoggingOut(false);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    console.log("handleLogout called");
    setIsLoggingOut(true);
    
    try {
      const { error } = await supabaseClient.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
        setIsLoggingOut(false);
        return;
      }

      if (onConfirm) {
        onConfirm();
      }
      
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      console.error("Logout failed:", err);
      alert("An error occurred during logout.");
      setIsLoggingOut(false);
    }
  };

  if (!isOpen) {
    console.log("LogoutModal: returning null (not showing)");
    return null;
  }

  console.log("LogoutModal: RENDERING MODAL!");

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm Logout</h2>
          <button className="close-btn" onClick={onCancel} disabled={isLoggingOut}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p>Are you sure you want to logout?</p>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-cancel" 
            onClick={onCancel}
            disabled={isLoggingOut}
          >
            Cancel
          </button>
          <button 
            className="btn-logout" 
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}