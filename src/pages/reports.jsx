// Reports.jsx
import React, { useState, useEffect } from "react";
import Sidebar from "../components/sidebar";
import { supabaseClient } from "../App"; // ✅ Import from App.jsx
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/global.css";
import "../styles/reports.css";

// ================= HELPER =================
const humanizeLabel = (label) => {
  if (!label) return "";
  if (label === "All") return "All";
  return label
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// ================= COMPONENT =================
const Reports = () => {
  const [reportType, setReportType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [column, setColumn] = useState("All");
  const [columnsOptions, setColumnsOptions] = useState([]);
  const [format, setFormat] = useState("pdf");
  const [showValidation, setShowValidation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const parcelColumns = [
    { value: "All", label: "All" },
    { value: "recipient_name", label: "Recipient name" },
    { value: "recipient_phone", label: "Recipient phone" },
    { value: "address", label: "Address" },
    { value: "assigned_rider", label: "Assigned rider" },
    { value: "status", label: "Status" },
    { value: "created_at", label: "Created at" },
  ];

  const riderColumns = [
    { value: "All", label: "All" },
    { value: "email", label: "Email" },
    { value: "type_of_user", label: "Type of user" },
    { value: "created_at", label: "Created at" },
  ];

  // ================= DYNAMIC COLUMNS =================
  useEffect(() => {
    if (reportType === "riders") setColumnsOptions(riderColumns);
    else setColumnsOptions(parcelColumns);
    setColumn("All");
  }, [reportType]);

  // ================= VALIDATION MODAL =================
  const showValidationModal = () => setShowValidation(true);
  const hideValidationModal = () => setShowValidation(false);

  // ================= FETCH DATA =================
  const fetchReportData = async (reportType, startDate, endDate, column) => {
    let data = [];
    let columns = [];

    if (reportType === "parcels") {
      let query = supabaseClient
        .from("parcels")
        .select("*")
        .order("parcel_id", { ascending: true });
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);
      const { data: parcels, error } = await query;
      if (error) throw error;
      data = parcels;
      columns =
        column === "All"
          ? ["recipient_name", "recipient_phone", "address", "assigned_rider", "status", "created_at"]
          : [column];

    } else if (reportType === "riders") {
      const { data: riders, error } = await supabaseClient
        .from("users")
        .select("*")
        .order("username", { ascending: true });
      if (error) throw error;
      data = riders;
      columns = column === "All" ? ["email", "type_of_user", "created_at"] : [column];

    } else if (reportType === "overall") {
      let parcelQuery = supabaseClient.from("parcels").select("*").order("parcel_id", { ascending: true });
      let riderQuery = supabaseClient.from("users").select("*").order("username", { ascending: true });
      if (startDate) parcelQuery = parcelQuery.gte("created_at", startDate);
      if (endDate) parcelQuery = parcelQuery.lte("created_at", `${endDate}T23:59:59`);

      const [parcelsRes, ridersRes] = await Promise.all([parcelQuery, riderQuery]);
      if (parcelsRes.error) throw parcelsRes.error;
      if (ridersRes.error) throw ridersRes.error;

      data = [
        { section: "Riders", data: ridersRes.data },
        { section: "Parcels", data: parcelsRes.data },
      ];
      columns = null;
    }

    return { data, columns };
  };

  // ================= PDF GENERATION =================
  const generatePdfReport = async (reportType, startDate, endDate, column) => {
    const { data, columns } = await fetchReportData(reportType, startDate, endDate, column);
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const headerHeight = 35;

    // Header background
    doc.setFillColor(163, 0, 0);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    // Logo
    const logo = new Image();
    logo.src = "/images/logo.png";

    function finalizePDF() {
      doc.setFontSize(12);

      // Side by side text under the logo
      const infoTexts = [
        `Report Type: ${humanizeLabel(reportType)}`,
        `Start: ${startDate || "-"}`,
        `End: ${endDate || "-"}`,
        `Column: ${humanizeLabel(column)}`
      ];

      // Calculate total width of all texts including spacing
      const spacing = 20;
      let totalWidth = infoTexts.reduce((sum, text) => sum + doc.getTextWidth(text), 0);
      totalWidth += spacing * (infoTexts.length - 1);

      // Starting X to center all texts
      let startX = (pageWidth - totalWidth) / 2;
      const infoY = headerHeight + 12;

      infoTexts.forEach((text, idx) => {
        doc.text(text, startX, infoY);
        startX += doc.getTextWidth(text) + spacing;
      });

      // Generate table content
      if (reportType === "overall") {
        let yOffset = infoY + 10;
        data.forEach(section => {
          doc.setFontSize(12);
          doc.text(section.section, 10, yOffset);
          const head = section.section === "Riders"
            ? ["Username", "Email", "Type Of User", "Created At"]
            : ["Parcel ID", "Recipient Name", "Phone", "Address", "Rider", "Status", "Created At"];
          const body = section.data.map(row => section.section === "Riders"
            ? [row.username, row.email, row.type_of_user, row.created_at]
            : [row.parcel_id, row.recipient_name, row.recipient_phone, row.address, row.assigned_rider, row.status, row.created_at]
          );
          autoTable(doc, { startY: yOffset + 4, head: [head], body, styles: { fontSize: 9 } });
          yOffset = doc.lastAutoTable.finalY + 10;
        });
      } else {
        const head = columns.map(humanizeLabel);
        const body = data.map(row => columns.map(c => row[c] || "-"));
        autoTable(doc, { startY: infoY + 10, head: [head], body, styles: { fontSize: 9 } });
      }

      doc.save(`${reportType}_report.pdf`);
    }

    logo.onload = () => {
      const logoWidth = 40;
      const logoHeight = 40;
      const logoX = pageWidth / 2 - logoWidth / 2;
      const logoY = 3;
      doc.addImage(logo, "PNG", logoX, logoY, logoWidth, logoHeight);
      finalizePDF();
    };
    logo.onerror = finalizePDF;
  };

  // ================= CSV GENERATION =================
  const generateCsvReport = async (reportType, startDate, endDate, column) => {
    const { data, columns } = await fetchReportData(reportType, startDate, endDate, column);
    let csv = "";

    if (reportType === "overall") {
      data.forEach(section => {
        csv += `\n## ${section.section}\n`;
        const cols = section.section === "Riders"
          ? ["username", "email", "type_of_user", "created_at"]
          : column === "All"
            ? ["parcel_id", "recipient_name", "recipient_phone", "address", "assigned_rider", "status", "created_at"]
            : ["parcel_id", column];
        csv += cols.join(",") + "\n";
        section.data.forEach(row => {
          csv += cols.map(c => `"${(row[c] ?? "").toString().replace(/"/g, '""')}"`).join(",") + "\n";
        });
      });
    } else {
      const reportCols = column === "All"
        ? reportType === "riders"
          ? ["username", "email", "type_of_user", "created_at"]
          : ["parcel_id", "recipient_name", "recipient_phone", "address", "assigned_rider", "status", "created_at"]
        : [column];
      csv += reportCols.join(",") + "\n";
      data.forEach(row => {
        csv += reportCols.map(c => `"${(row[c] ?? "").toString().replace(/"/g, '""')}"`).join(",") + "\n";
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ================= GENERATE BUTTON =================
  const handleGenerateReport = async () => {
    const needsDate = reportType !== "riders";
    if (!reportType || !column || !format || (needsDate && (!startDate || !endDate))) {
      showValidationModal();
      return;
    }

    try {
      setIsGenerating(true);
      if (format === "pdf") await generatePdfReport(reportType, startDate, endDate, column);
      else await generateCsvReport(reportType, startDate, endDate, column);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ================= RENDER =================
  return (
    <div className="dashboard-container">
      {/* ✅ No props needed - Sidebar gets everything from AuthContext */}
      <Sidebar currentPage="reports.html" />

      <div className="reports-page">
        <div className="reports-card reports-card-modern">
          <div className="reports-header"><h1 className="reports-page-title">Generate Reports</h1></div>
          <div className="reports-form">
            <div className="reports-form-row full">
              <label>Report Type</label>
              <select id="reportType" value={reportType} onChange={e => setReportType(e.target.value)}>
                <option value="">-- Select Report Type --</option>
                <option value="parcels">Parcels</option>
                <option value="riders">Riders</option>
                <option value="overall">Overall Reports</option>
              </select>
            </div>

            {reportType !== "riders" && (
              <>
                <div className="reports-form-row">
                  <label>Start Date</label>
                  <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="reports-form-row">
                  <label>End Date</label>
                  <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            <div className="reports-form-row">
              <label>Column</label>
              <select id="column" value={column} onChange={e => setColumn(e.target.value)}>
                {columnsOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="reports-form-row">
              <label>Format</label>
              <select id="reportFormat" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <div className="reports-form-buttons">
              <button className="reports-btn-generate" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <span className="inline-spinner" aria-hidden="true" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showValidation && (
        <div className="reports-validation-modal">
          <div className="reports-validation-content">
            <p>All fields are required.</p>
            <button onClick={hideValidationModal}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

