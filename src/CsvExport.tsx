
import { useState } from "react";
import { supabase } from "./lib/supabase";
import {
  Download,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  CreditCard,
  ArrowDownToLine,
  Database,
  LockKeyhole,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

type ExportType = "customers" | "policies" | "premium_payments";

function csvValue(value: unknown) {
  let text = value == null ? "" : String(value);

  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[]
) {
  if (!rows.length) {
    alert("Export karne ke liye koi data nahi mila.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const csvRows = [
    headers.map(csvValue).join(","),
    ...rows.map((row) =>
      headers.map((key) => csvValue(row[key])).join(",")
    ),
  ];

  const csv = ["sep=,", ...csvRows].join("\r\n") + "\r\n";

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const exports = [
  {
    type: "customers" as const,
    title: "Customer Records",
    description: "Customer names, contact details, addresses and notes.",
    icon: Users,
    number: "01",
    file: "customers.csv",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  {
    type: "policies" as const,
    title: "Policy Records",
    description: "Policy numbers, plan details, premiums and due dates.",
    icon: ShieldCheck,
    number: "02",
    file: "policies.csv",
    color: "#0f9f83",
    bg: "#e9fbf5",
  },
  {
    type: "premium_payments" as const,
    title: "Premium Payments",
    description: "Payment history, dates, methods and receipt references.",
    icon: CreditCard,
    number: "03",
    file: "premium-payments.csv",
    color: "#7c3aed",
    bg: "#f3edff",
  },
];

export default function CsvExport() {
  const [loading, setLoading] = useState<ExportType | null>(null);

  async function exportData(type: ExportType) {
    setLoading(type);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("Pehle login karein.");
        return;
      }

      if (type === "customers") {
        const { data, error } = await supabase
          .from("customers")
          .select(
            "full_name, phone, email, address, notes, created_at"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        downloadCsv(
          "lic-saathi-customers.csv",
          (data ?? []) as unknown as Record<string, unknown>[]
        );
      }

      if (type === "policies") {
        const { data, error } = await supabase
          .from("policies")
          .select(
            "policy_number, plan_name, sum_assured, premium_amount, premium_frequency, start_date, next_due_date, status, notes, customers(full_name)"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data ?? []).map((p: any) => ({
          policy_number: p.policy_number,
          customer_name: p.customers?.full_name ?? "",
          plan_name: p.plan_name,
          sum_assured: p.sum_assured,
          premium_amount: p.premium_amount,
          premium_frequency: p.premium_frequency,
          start_date: p.start_date,
          next_due_date: p.next_due_date,
          status: p.status,
          notes: p.notes,
        }));

        downloadCsv("lic-saathi-policies.csv", rows);
      }

      if (type === "premium_payments") {
        const { data, error } = await supabase
          .from("premium_payments")
          .select(
            "amount, paid_on, payment_method, receipt_reference, notes, policies(policy_number)"
          )
          .order("paid_on", { ascending: false });

        if (error) throw error;

        const rows = (data ?? []).map((p: any) => ({
          policy_number: p.policies?.policy_number ?? "",
          amount: p.amount,
          paid_on: p.paid_on,
          payment_method: p.payment_method,
          receipt_reference: p.receipt_reference,
          notes: p.notes,
        }));

        downloadCsv("lic-saathi-premium-payments.csv", rows);
      }
    } catch (error) {
      console.error("CSV export failed:", error);
      alert(
        "Export nahi hua. Connection, database permissions aur table relationships check karein."
      );
    } finally {
      setLoading(null);
    }
  }

  const pageStyle = {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    color: "#172033",
  } as const;

  return (
    <div style={pageStyle}>
      <style>{`
        .csv-export-card {
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .csv-export-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 32px rgba(25, 42, 70, .09);
          border-color: #cbd5e1 !important;
        }
        .csv-download-btn {
          transition: background .18s ease, transform .18s ease;
        }
        .csv-download-btn:hover:not(:disabled) {
          background: #173b73 !important;
          transform: translateY(-1px);
        }
        .csv-download-btn:disabled {
          cursor: wait;
          opacity: .7;
        }
        @media (max-width: 600px) {
          .csv-hero {
            padding: 24px !important;
          }
          .csv-hero-title {
            font-size: 25px !important;
          }
          .csv-export-grid {
            grid-template-columns: 1fr !important;
          }
          .csv-security {
            align-items: flex-start !important;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 26,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#64748b",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.5,
              marginBottom: 9,
            }}
          >
            <Database size={15} />
            DATA MANAGEMENT
          </div>
          <h1
            style={{
              fontSize: 29,
              letterSpacing: "-.8px",
              margin: "0 0 8px",
              fontWeight: 800,
              color: "#172033",
            }}
          >
            Export & Backup
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>
            Manage and download your LIC Saathi records.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #bbf7d0",
            color: "#15803d",
            background: "#f0fdf4",
            borderRadius: 999,
            padding: "9px 13px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={16} />
          Data Export Centre
        </div>
      </div>

      <section
        className="csv-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          padding: "32px 34px",
          background:
            "linear-gradient(120deg, #102746 0%, #173b73 58%, #2455a1 100%)",
          color: "#ffffff",
          marginBottom: 28,
          boxShadow: "0 12px 28px rgba(20, 49, 88, .15)",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -35,
            top: -70,
            width: 230,
            height: 230,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 30,
            bottom: -100,
            width: 210,
            height: 210,
            borderRadius: "50%",
            background: "rgba(255,255,255,.045)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 570,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#dbeafe",
              background: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              marginBottom: 18,
            }}
          >
            <FileSpreadsheet size={15} />
            CSV DOWNLOADS
          </div>

          <h2
            className="csv-hero-title"
            style={{
              fontSize: 31,
              lineHeight: 1.25,
              letterSpacing: "-.8px",
              margin: "0 0 12px",
              fontWeight: 800,
            }}
          >
            Your data, always in your control.
          </h2>

          <p
            style={{
              color: "#d6e3f5",
              fontSize: 14,
              lineHeight: 1.8,
              margin: "0 0 23px",
              maxWidth: 500,
            }}
          >
            Export your customer directory, policy records and payment history
            into spreadsheet-ready CSV files whenever you need them.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "#e0ecff",
            }}
          >
            <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <CheckCircle2 size={15} /> Excel compatible
            </span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <CheckCircle2 size={15} /> Easy to store
            </span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <CheckCircle2 size={15} /> Separate data files
            </span>
          </div>
        </div>
      </section>

      <div style={{ marginBottom: 17 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-.3px",
            margin: "0 0 6px",
          }}
        >
          Choose what to export
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
          Select a category to create a downloadable CSV file.
        </p>
      </div>

      <div
        className="csv-export-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
          gap: 18,
          marginBottom: 25,
        }}
      >
        {exports.map((item) => {
          const Icon = item.icon;
          const isLoading = loading === item.type;

          return (
            <article
              key={item.type}
              className="csv-export-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e5eaf1",
                borderRadius: 17,
                padding: 22,
                boxShadow: "0 3px 10px rgba(25,42,70,.025)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    width: 47,
                    height: 47,
                    borderRadius: 13,
                    display: "grid",
                    placeItems: "center",
                    color: item.color,
                    background: item.bg,
                  }}
                >
                  <Icon size={23} strokeWidth={2} />
                </div>

                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1,
                  }}
                >
                  {item.number}
                </span>
              </div>

              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  margin: "0 0 9px",
                  letterSpacing: "-.3px",
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.75,
                  minHeight: 46,
                  margin: "0 0 18px",
                }}
              >
                {item.description}
              </p>

              <div
                style={{
                  borderTop: "1px solid #edf0f5",
                  paddingTop: 15,
                  marginBottom: 15,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  CSV SPREADSHEET
                </span>
                <FileSpreadsheet size={17} color="#94a3b8" />
              </div>

              <button
                className="csv-download-btn"
                disabled={loading !== null}
                onClick={() => void exportData(item.type)}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 10,
                  background: "#1d467f",
                  color: "#ffffff",
                  padding: "12px 14px",
                  fontSize: 13,
                  fontWeight: 750,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  cursor: loading !== null ? "wait" : "pointer",
                }}
              >
                {isLoading ? (
                  <RefreshCw size={17} />
                ) : (
                  <ArrowDownToLine size={18} />
                )}
                {isLoading ? "Preparing file..." : "Download CSV"}
              </button>
            </article>
          );
        })}
      </div>

      <section
        className="csv-security"
        style={{
          display: "flex",
          gap: 15,
          alignItems: "center",
          padding: "19px 21px",
          border: "1px solid #e5eaf1",
          background: "#f8fafc",
          borderRadius: 15,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 43,
            height: 43,
            flexShrink: 0,
            borderRadius: 12,
            background: "#e8eef8",
            color: "#244a7e",
            display: "grid",
            placeItems: "center",
          }}
        >
          <LockKeyhole size={21} />
        </div>

        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 800,
              margin: "0 0 5px",
              color: "#243247",
            }}
          >
            Keep your data secure
          </h3>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.7,
              color: "#64748b",
              margin: 0,
            }}
          >
            CSV files may contain personal customer and policy information.
            Store backups in a private, protected location and avoid sharing
            them publicly.
          </p>
        </div>
      </section>

      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: "#94a3b8",
          fontSize: 11,
          margin: "0 0 5px",
        }}
      >
        <Download size={13} />
        Export creates a local copy of the records returned by your database
        permissions. It does not delete or modify the original records.
      </p>
    </div>
  );
}
