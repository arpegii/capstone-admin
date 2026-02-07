import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/sidebar";
import { supabaseClient } from "../App";
import Chart from "chart.js/auto";
import "../styles/global.css";
import "../styles/dashboard.css";
import PageSpinner from "../components/PageSpinner";

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    delivered: "--",
    cancelled: "--",
    dailyQuota: 0,
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
  const growthChartRef = useRef(null);
  const chartInstanceRef = useRef(null);

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
        const dailyQuota = Math.min(Math.round((delivered / 150) * 100), 100);

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
          dailyQuota,
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
            borderColor: "#e11d48",
            backgroundColor: "rgba(225,29,72,0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } } },
      },
    });
  }, [dashboardData.years, dashboardData.yearGrowth]);

  return (
    <div className="dashboard-container">
      <Sidebar />

      <div className="dashboard-page">
        {loading ? (
          <PageSpinner fullScreen label="Loading dashboard..." />
        ) : (
          <>
            <div className="dash-header">
              <h1 className="page-title">Dashboard</h1>
              <span className="date-range">November 2025</span>
            </div>

            <div className="dash-grid two-rows">
              <div className="dash-card top-card">
                <div className="card-icon success" aria-hidden="true">OK</div>
                <div className="card-label">Delivered</div>
                <div className="card-value delivered">{dashboardData.delivered}</div>
              </div>

              <div className="dash-card top-card">
                <div className="card-icon warning" aria-hidden="true">NO</div>
                <div className="card-label">Cancelled</div>
                <div className="card-value delayed">{dashboardData.cancelled}</div>
              </div>

              <div className="dash-card top-card quota">
                <div className="quota-progress">
                  <svg viewBox="0 0 120 120" className="quota-ring">
                    <circle className="quota-ring-bg" cx="60" cy="60" r="48" />
                    <circle
                      className="quota-ring-fg"
                      cx="60"
                      cy="60"
                      r="48"
                      strokeDasharray={`${dashboardData.dailyQuota * 3} 302`}
                    />
                  </svg>
                  <span className="quota-ring-label">{dashboardData.dailyQuota}%</span>
                </div>
                <div className="card-label">Daily Quota</div>
                <div className="card-desc">of 150 parcels</div>
              </div>

              <div className="dash-card top-card riders-card">
                <div className="card-label">Top Riders</div>
                <ul className="modern-riders-list">
                  {dashboardData.riders.map((r, i) => (
                    <li key={i}>{r.username}</li>
                  ))}
                </ul>
              </div>

              <div className="dash-card bottom-card growth">
                <div className="card-label">Delivery Growth</div>
                <canvas ref={growthChartRef}></canvas>
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

              <div className="dash-card bottom-card small-card top-rider">
                <div className="card-label">Top Rider</div>
                <div className="card-value">{dashboardData.topRider}</div>
                <div className="card-desc">{dashboardData.topRiderCount} deliveries</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

