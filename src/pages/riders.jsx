import { useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "../components/sidebar";
import { supabaseClient } from "../App"; // ✅ Import from App.jsx instead of creating new client
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/riders.css";
import "../styles/global.css";
import PageSpinner from "../components/PageSpinner";

export default function Riders() {
  const [riders, setRiders] = useState([]);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackingRider, setTrackingRider] = useState("");
  const [loadingMap, setLoadingMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [selectedRiderInfo, setSelectedRiderInfo] = useState(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creatingRider, setCreatingRider] = useState(false);
  const [createRiderError, setCreateRiderError] = useState("");
  const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
  const [createSuccessMessage, setCreateSuccessMessage] = useState("");
  const joinDateToday = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const allMapRef = useRef(null);
  const allLeafletMapRef = useRef(null);
  const allMarkersRef = useRef([]);

  const getRiderPosition = (name, index = 0) => {
    const seed = (name || "")
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + index * 37;
    const latOffset = ((seed % 140) - 70) * 0.00028;
    const lngOffset = (((seed * 3) % 140) - 70) * 0.00028;

    return {
      lat: 14.676 + latOffset,
      lng: 121.0437 + lngOffset,
    };
  };

  const riderLocations = useMemo(
    () =>
      riders.map((rider, idx) => ({
        ...rider,
        ...getRiderPosition(rider.username, idx),
      })),
    [riders]
  );

  // Load riders on mount
  useEffect(() => {
    async function loadRiders() {
      try {
        const { data, error } = await supabaseClient.from("users").select("username");
        if (error) return console.error(error);
        setRiders(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadRiders();
  }, []);

  useEffect(() => {
    if (loading || !allMapRef.current) return;

    if (!allLeafletMapRef.current) {
      allLeafletMapRef.current = L.map(allMapRef.current).setView([14.676, 121.0437], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(allLeafletMapRef.current);
    }

    const map = allLeafletMapRef.current;
    const riderIcon = L.icon({
      iconUrl: "/images/rider.png",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    allMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    allMarkersRef.current = [];

    riderLocations.forEach((rider) => {
      const marker = L.marker([rider.lat, rider.lng], { icon: riderIcon })
        .addTo(map)
        .bindPopup(`${rider.username}'s location`);
      allMarkersRef.current.push(marker);
    });

    if (allMarkersRef.current.length > 1) {
      const bounds = L.featureGroup(allMarkersRef.current).getBounds().pad(0.2);
      map.fitBounds(bounds);
    } else if (allMarkersRef.current.length === 1) {
      const first = allMarkersRef.current[0].getLatLng();
      map.setView([first.lat, first.lng], 14);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  }, [loading, riderLocations]);

  useEffect(() => {
    return () => {
      if (allLeafletMapRef.current) {
        allLeafletMapRef.current.remove();
        allLeafletMapRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const openTrackModal = (riderName) => {
    setTrackingRider(riderName);
    setTrackModalOpen(true);
    setLoadingMap(true);

    // Remove previous map if exists
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      currentMarkerRef.current = null;
    }

    // Wait until modal renders fully
    setTimeout(() => {
      if (!mapRef.current) return;

      setLoadingMap(false);
      const selectedRider = riderLocations.find((r) => r.username === riderName);
      const focusedLat = selectedRider?.lat ?? 14.676;
      const focusedLng = selectedRider?.lng ?? 121.0437;

      const map = L.map(mapRef.current).setView([focusedLat, focusedLng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const riderIcon = L.icon({
        iconUrl: "/images/rider.png", // replace with your PNG
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
      });

      const marker = L.marker(
        [focusedLat, focusedLng],
        { icon: riderIcon }
      )
        .addTo(map)
        .bindPopup(`${riderName}'s location`)
        .openPopup();

      leafletMapRef.current = map;
      currentMarkerRef.current = marker;

      // Force Leaflet to render correctly
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }, 500); // wait 500ms for modal animation
  };

  const closeTrackModal = () => {
    if (currentMarkerRef.current) {
      currentMarkerRef.current.remove();
      currentMarkerRef.current = null;
    }
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    setTrackModalOpen(false);
  };

  const openInfoModal = async (riderName) => {
    setInfoModalOpen(true);
    setLoadingInfo(true);
    setInfoError("");
    setSelectedRiderInfo(null);

    try {
      const { data, error } = await supabaseClient
        .from("users")
        .select("username, email, fname, lname, mname, gender, age, status, pnumber, profile_url")
        .eq("username", riderName)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setInfoError("Rider information not found.");
        return;
      }

      setSelectedRiderInfo(data);
    } catch (err) {
      console.error("Failed to fetch rider information:", err);
      setInfoError("Failed to load rider information.");
    } finally {
      setLoadingInfo(false);
    }
  };

  const closeInfoModal = () => {
    setInfoModalOpen(false);
    setSelectedRiderInfo(null);
    setInfoError("");
    setPhotoPreviewOpen(false);
  };

  const openCreateModal = () => {
    setCreateRiderError("");
    setCreateUsername("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creatingRider) return;
    setCreateModalOpen(false);
    setCreateRiderError("");
    setCreateUsername("");
    setCreateEmail("");
    setCreatePassword("");
  };

  const handleCreateRider = async (e) => {
    e.preventDefault();
    setCreateRiderError("");
    setCreateSuccessMessage("");

    const normalizedUsername = createUsername.trim();
    if (!normalizedUsername) {
      setCreateRiderError("Username is required.");
      return;
    }

    const normalizedEmail = createEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setCreateRiderError("Email is required.");
      return;
    }

    if (createPassword.length < 6) {
      setCreateRiderError("Password must be at least 6 characters.");
      return;
    }

    setCreatingRider(true);

    try {
      const { data: updatedRows, error: usersUpdateError } = await supabaseClient
        .from("users")
        .update({
          new_user: true,
          username: normalizedUsername,
          password: createPassword,
          doj: joinDateToday,
        })
        .eq("email", normalizedEmail)
        .select("email");

      if (usersUpdateError) {
        throw usersUpdateError;
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: usersInsertError } = await supabaseClient
          .from("users")
          .insert({
            username: normalizedUsername,
            email: normalizedEmail,
            password: createPassword,
            new_user: true,
            doj: joinDateToday,
          });

        if (usersInsertError) {
          throw usersInsertError;
        }
      }

      const { data: ridersData, error: ridersError } = await supabaseClient.from("users").select("username");
      if (!ridersError && ridersData) {
        setRiders(ridersData);
      }

      setCreateSuccessMessage("Rider created successfully.");
      setShowCreateSuccessModal(true);
      setCreateModalOpen(false);
      setCreateUsername("");
      setCreateEmail("");
      setCreatePassword("");
    } catch (err) {
      console.error("Failed to create rider account:", err);
      setCreateRiderError(err?.message || "Failed to create rider account.");
    } finally {
      setCreatingRider(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* ✅ No props needed - Sidebar gets everything from AuthContext */}
      <Sidebar currentPage="riders.html" />
      
      <div className="riders-page">
        {loading ? (
          <PageSpinner fullScreen label="Loading riders..." />
        ) : (
          <div className="riders-content-shell">
            <div className="rider-header-row">
              <h1 className="page-title">Rider Management</h1>
              <button
                type="button"
                className="add-rider-btn"
                onClick={openCreateModal}
              >
                Add Rider
              </button>
            </div>
            <div className="riders-split-layout">
              <div className="riders-table-wrapper">
                <table className="rider-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Name</th>
                      <th>Delivered</th>
                      <th>Ongoing</th>
                      <th>Delayed</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map((rider, idx) => (
                      <tr key={rider.username}>
                      <td>{idx + 1}</td>
                      <td>
                        <button
                          type="button"
                          className="rider-name-btn"
                          onClick={() => openInfoModal(rider.username)}
                        >
                          {rider.username}
                        </button>
                      </td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                        <td>
                          <button className="track-btn" onClick={() => openTrackModal(rider.username)}>
                            Track
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rider-map-card">
                <div className="rider-map-header">
                  <h2>Live Rider Map</h2>
                  <p>Showing all rider positions on the page map.</p>
                </div>
                <div className="rider-map-body">
                  <div ref={allMapRef} className="rider-live-map" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {trackModalOpen && (
        <div
          className="riders-modal-overlay"
          onClick={closeTrackModal}
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          <div
            className="riders-modal-content track-rider-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 700, maxWidth: "90%" }}
          >
            <div className="riders-modal-header">
              <h2>Track Rider</h2>
            </div>
            <div className="riders-modal-body track-rider-body">
              <p>
                Tracking the location of: <strong>{trackingRider}</strong>
              </p>
              {loadingMap && (
                <img 
                  src="/images/motor.gif" 
                  alt="Loading map..." 
                  style={{ width: 120, margin: "20px auto", display: "block" }} 
                />
              )}
              <div
                ref={mapRef}
                className="track-rider-map"
                style={{
                  display: loadingMap ? "none" : "block",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {infoModalOpen && (
        <div
          className="riders-modal-overlay"
          onClick={closeInfoModal}
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          <div
            className="riders-modal-content rider-info-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 620, maxWidth: "92%" }}
          >
            <div className="riders-modal-header">
              <h2>Rider Information</h2>
            </div>

            <div className="riders-modal-body rider-info-body">
              {loadingInfo ? (
                <PageSpinner label="Loading rider information..." />
              ) : infoError ? (
                <p className="rider-info-error">{infoError}</p>
              ) : (
                <>
                  <div className="rider-info-profile">
                    {selectedRiderInfo?.profile_url ? (
                      <button
                        type="button"
                        className="rider-avatar-btn"
                        onClick={() => setPhotoPreviewOpen(true)}
                        aria-label="View profile picture"
                      >
                        <img
                          src={selectedRiderInfo.profile_url}
                          alt={`${selectedRiderInfo?.username || "Rider"} profile`}
                          className="rider-info-avatar"
                        />
                      </button>
                    ) : (
                      <div className="rider-info-avatar rider-info-avatar-fallback">
                        {(selectedRiderInfo?.fname?.[0] || selectedRiderInfo?.username?.[0] || "R").toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="rider-info-grid">
                    <div className="rider-info-item"><span>Email</span><strong>{selectedRiderInfo?.email || "-"}</strong></div>
                    <div className="rider-info-item"><span>First Name</span><strong>{selectedRiderInfo?.fname || "-"}</strong></div>
                    <div className="rider-info-item"><span>Last Name</span><strong>{selectedRiderInfo?.lname || "-"}</strong></div>
                    <div className="rider-info-item"><span>Middle Name</span><strong>{selectedRiderInfo?.mname || "-"}</strong></div>
                    <div className="rider-info-item"><span>Gender</span><strong>{selectedRiderInfo?.gender || "-"}</strong></div>
                    <div className="rider-info-item"><span>Age</span><strong>{selectedRiderInfo?.age ?? "-"}</strong></div>
                    <div className="rider-info-item"><span>Status</span><strong>{selectedRiderInfo?.status || "-"}</strong></div>
                    <div className="rider-info-item"><span>Phone Number</span><strong>{selectedRiderInfo?.pnumber || "-"}</strong></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {photoPreviewOpen && selectedRiderInfo?.profile_url && (
        <div
          className="riders-modal-overlay"
          onClick={() => setPhotoPreviewOpen(false)}
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          <div
            className="riders-modal-content rider-photo-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 520, maxWidth: "92%" }}
          >
            <div className="riders-modal-header">
              <h2>Profile Picture</h2>
              <button
                className="riders-modal-close-btn"
                onClick={() => setPhotoPreviewOpen(false)}
                aria-label="Close preview"
              >
                &times;
              </button>
            </div>
            <div className="riders-modal-body rider-photo-body">
              <img
                src={selectedRiderInfo.profile_url}
                alt={`${selectedRiderInfo?.username || "Rider"} full profile`}
                className="rider-photo-preview"
              />
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div
          className="riders-modal-overlay"
          onClick={closeCreateModal}
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          <div
            className="riders-modal-content rider-create-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 560, maxWidth: "92%" }}
          >
            <div className="riders-modal-header">
              <h2>Create Rider Account</h2>
            </div>
            <div className="riders-modal-body rider-create-body">
              <form className="rider-create-form" onSubmit={handleCreateRider}>
                <div className="rider-create-field">
                  <label htmlFor="create-rider-date-join">Date of Join</label>
                  <input
                    id="create-rider-date-join"
                    type="date"
                    value={joinDateToday}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <div className="rider-create-field">
                  <label htmlFor="create-rider-username">Username</label>
                  <input
                    id="create-rider-username"
                    type="text"
                    value={createUsername}
                    onChange={(event) => setCreateUsername(event.target.value)}
                    placeholder="rider_username"
                    required
                    autoComplete="username"
                    disabled={creatingRider}
                  />
                </div>

                <div className="rider-create-field">
                  <label htmlFor="create-rider-email">Email</label>
                  <input
                    id="create-rider-email"
                    type="email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    placeholder="rider@email.com"
                    required
                    autoComplete="email"
                    disabled={creatingRider}
                  />
                </div>

                <div className="rider-create-field">
                  <label htmlFor="create-rider-password">Password</label>
                  <input
                    id="create-rider-password"
                    type="password"
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    disabled={creatingRider}
                  />
                </div>

                {createRiderError && <p className="rider-create-error">{createRiderError}</p>}

                <div className="rider-create-actions">
                  <button
                    type="button"
                    className="rider-create-cancel"
                    onClick={closeCreateModal}
                    disabled={creatingRider}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="rider-create-submit" disabled={creatingRider}>
                    {creatingRider ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCreateSuccessModal && (
        <div className="riders-modal-overlay" onClick={() => setShowCreateSuccessModal(false)}>
          <div className="riders-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="riders-success-header">
              <h3>Success</h3>
            </div>
            <div className="riders-success-body">
              <div className="riders-success-check" aria-hidden="true">
                <span className="riders-success-checkmark" />
              </div>
              <p>{createSuccessMessage}</p>
              <button
                type="button"
                className="riders-success-btn"
                onClick={() => setShowCreateSuccessModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


