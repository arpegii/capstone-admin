import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/sidebar";
import { supabaseClient } from "../App";
import Chart from "chart.js/auto";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/global.css";
import "../styles/dashboard.css";
import PageSpinner from "../components/PageSpinner";

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    delivered: "--",
    cancelled: "--",
    topMonth: "--",
    topMonthCount: "--",
    topYear: "--",
    topYearCount: "--",
    topRider: "--",
    topRiderCount: "--",
    riders: [],
    years: [],
    yearGrowth: [],
  });
  const [loading, setLoading] = useState(true);
  const [violationMapModalOpen, setViolationMapModalOpen] = useState(false);
  const growthChartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const violationMapRef = useRef(null);
  const violationLeafletMapRef = useRef(null);
  const violationFullMapRef = useRef(null);
  const violationFullLeafletMapRef = useRef(null);
  const todayLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const { data: parcels } = await supabaseClient.from("parcels").select("*");
        const { data: riders } = await supabaseClient
          .from("users")
          .select("username")
          .order("created_at", { ascending: false });

        if (!parcels || !riders) {
          setLoading(false);
          return;
        }

        const delivered = parcels.filter(
          (p) => p.status?.toLowerCase() === "successfully delivered"
        ).length;
        const cancelled = parcels.filter((p) => p.status?.toLowerCase() === "cancelled").length;
        const months = {};
        const yearsCount = {};
        const riderCounts = {};
        let topMonth = "";
        let topMonthCount = 0;
        let topYear = "";
        let topYearCount = 0;
        let topRider = "";
        let topRiderCount = 0;

        parcels.forEach((p) => {
          if (p.status?.toLowerCase() === "successfully delivered") {
            const date = new Date(p.created_at);
            const monthStr = date.toLocaleString("default", { month: "long" });
            const yearStr = date.getFullYear();

            months[monthStr] = (months[monthStr] || 0) + 1;
            if (months[monthStr] > topMonthCount) {
              topMonth = monthStr;
              topMonthCount = months[monthStr];
            }

            yearsCount[yearStr] = (yearsCount[yearStr] || 0) + 1;
            if (yearsCount[yearStr] > topYearCount) {
              topYear = yearStr;
              topYearCount = yearsCount[yearStr];
            }

            if (p.assigned_rider) {
              riderCounts[p.assigned_rider] = (riderCounts[p.assigned_rider] || 0) + 1;
              if (riderCounts[p.assigned_rider] > topRiderCount) {
                topRider = p.assigned_rider;
                topRiderCount = riderCounts[p.assigned_rider];
              }
            }
          }
        });

        const sortedYears = Object.keys(yearsCount).sort((a, b) => a - b);
        const yearGrowthData = sortedYears.map((y) => yearsCount[y]);

        setDashboardData({
          delivered,
          cancelled,
          topMonth,
          topMonthCount,
          topYear,
          topYearCount,
          topRider,
          topRiderCount,
          riders: riders.slice(0, 5),
          years: sortedYears,
          yearGrowth: yearGrowthData,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  useEffect(() => {
    if (!growthChartRef.current || !dashboardData.years.length) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    chartInstanceRef.current = new Chart(growthChartRef.current, {
      type: "line",
      data: {
        labels: dashboardData.years,
        datasets: [
          {
            data: dashboardData.yearGrowth,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.16)",
            fill: true,
            tension: 0.35,
            pointRadius: 2.6,
            pointHoverRadius: 4,
            pointBackgroundColor: "#ef4444",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(148, 163, 184, 0.2)",
            },
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });
  }, [dashboardData.years, dashboardData.yearGrowth]);

  useEffect(() => {
    if (loading || !violationMapRef.current) return;

    if (!violationLeafletMapRef.current) {
      const map = L.map(violationMapRef.current).setView([14.676, 121.0437], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      // Placeholder hotspots until violation coordinates are available in DB.
      const hotspotStyle = {
        color: "#dc2626",
        fillColor: "#ef4444",
        fillOpacity: 0.25,
        weight: 1,
      };
      L.circle([14.6785, 121.041], { ...hotspotStyle, radius: 260 }).addTo(map).bindPopup("Violation hotspot placeholder");
      L.circle([14.6715, 121.0485], { ...hotspotStyle, radius: 180 }).addTo(map).bindPopup("Violation hotspot placeholder");

      violationLeafletMapRef.current = map;
    }

    setTimeout(() => {
      violationLeafletMapRef.current?.invalidateSize();
    }, 120);
  }, [loading]);

  useEffect(() => {
    if (!violationMapModalOpen) {
      if (violationFullLeafletMapRef.current) {
        violationFullLeafletMapRef.current.remove();
        violationFullLeafletMapRef.current = null;
      }
      return;
    }

    if (!violationFullMapRef.current) return;

    if (!violationFullLeafletMapRef.current) {
      const map = L.map(violationFullMapRef.current).setView([14.676, 121.0437], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const hotspotStyle = {
        color: "#dc2626",
        fillColor: "#ef4444",
        fillOpacity: 0.25,
        weight: 1,
      };
      L.circle([14.6785, 121.041], { ...hotspotStyle, radius: 260 }).addTo(map).bindPopup("Violation hotspot placeholder");
      L.circle([14.6715, 121.0485], { ...hotspotStyle, radius: 180 }).addTo(map).bindPopup("Violation hotspot placeholder");
      violationFullLeafletMapRef.current = map;
    }

    setTimeout(() => {
      violationFullLeafletMapRef.current?.invalidateSize();
    }, 120);
  }, [violationMapModalOpen]);

  useEffect(() => {
    return () => {
      if (violationLeafletMapRef.current) {
        violationLeafletMapRef.current.remove();
        violationLeafletMapRef.current = null;
      }
      if (violationFullLeafletMapRef.current) {
        violationFullLeafletMapRef.current.remove();
        violationFullLeafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar />

      <div className="dashboard-page">
        {loading ? (
          <PageSpinner fullScreen label="Loading dashboard..." />
        ) : (
          <>
            <div className="dash-header">
              <div className="dash-header-copy">
                <h1 className="page-title">Dashboard</h1>
              </div>
              <span className="date-range">{todayLabel}</span>
            </div>

            <div className="dash-grid two-rows">
              <div className="dash-card top-card metric-card delivered-card">
                <div className="metric-pill success">Delivered</div>
                <div className="card-value delivered">{dashboardData.delivered}</div>
                <div className="card-desc">Successful deliveries completed</div>
              </div>

              <div className="dash-card top-card metric-card cancelled-card">
                <div className="metric-pill warning">Cancelled</div>
                <div className="card-value delayed">{dashboardData.cancelled}</div>
                <div className="card-desc">Orders cancelled by customer/system</div>
              </div>

              <div className="dash-card bottom-card growth">
                <div className="card-label">Delivery Growth by Year</div>
                <div className="growth-canvas-shell">
                  <canvas ref={growthChartRef}></canvas>
                </div>
              </div>

              <div className="dash-card bottom-card small-card top-month">
                <div className="card-label">Top Month</div>
                <div className="card-value">{dashboardData.topMonth}</div>
                <div className="card-desc">{dashboardData.topMonthCount} deliveries</div>
              </div>

              <div className="dash-card bottom-card small-card top-year">
                <div className="card-label">Top Year</div>
                <div className="card-value">{dashboardData.topYear}</div>
                <div className="card-desc">{dashboardData.topYearCount} deliveries</div>
              </div>

              <div className="dash-card bottom-card top-rider-card">
                <div className="card-label">Top Rider</div>
                <div className="card-value">{dashboardData.topRider || "--"}</div>
                <div className="card-desc">{dashboardData.topRiderCount} deliveries</div>
              </div>

              <div className="dash-card bottom-card violation-map-card">
                <div className="violation-map-header">
                  <div className="violation-map-header-top">
                    <h2>Violation Heat Map</h2>
                    <button
                      type="button"
                      className="violation-map-size-btn"
                      onClick={() => setViolationMapModalOpen(true)}
                    >
                      View Fullscreen Map
                    </button>
                  </div>
                  <p>Showing hotspot placeholders where rider violations can appear.</p>
                </div>
                <div className="violation-map-body">
                  <div ref={violationMapRef} className="violation-map-canvas" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {violationMapModalOpen && (
        <div className="dashboard-modal-overlay" onClick={() => setViolationMapModalOpen(false)}>
          <div className="dashboard-modal-content violation-full-map-modal" onClick={(event) => event.stopPropagation()}>
            <div className="violation-full-map-header">
              <h2>Violation Heat Map</h2>
              <button type="button" className="violation-full-map-close" onClick={() => setViolationMapModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="violation-full-map-body">
              <div ref={violationFullMapRef} className="violation-full-map-canvas" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
