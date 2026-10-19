import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { AlertCircle, CalendarDays, Clock, RefreshCw, Search } from "lucide-react";

type Reminder = {
  id: string;
  policy_number: string;
  plan_name: string;
  premium_amount: number | string;
  premium_frequency: string;
  next_due_date: string | null;
  status: string;
  customers: { full_name: string; phone: string | null } | null;
};

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateText(value: string) {
  return localDate(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysFromToday(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = localDate(value);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function money(value: number | string) {
  return "₹" + Number(value).toLocaleString("en-IN");
}

export default function Reminders() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadReminders() {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("policies")
      .select(
        "id, policy_number, plan_name, premium_amount, premium_frequency, next_due_date, status, customers(full_name, phone)"
      )
      .eq("status", "active")
      .not("next_due_date", "is", null)
      .order("next_due_date", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as Reminder[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadReminders();
  }, []);

  const categorized = useMemo(() => {
    return items.map((item) => {
      const days = item.next_due_date
        ? daysFromToday(item.next_due_date)
        : 99999;

      const category =
        days < 0 ? "overdue" :
        days <= 7 ? "soon" :
        days <= 30 ? "upcoming" : "later";

      return { ...item, days, category };
    });
  }, [items]);

  const overdueCount = categorized.filter((x) => x.category === "overdue").length;
  const soonCount = categorized.filter((x) => x.category === "soon").length;
  const upcomingCount = categorized.filter((x) => x.category === "upcoming").length;

  const visible = categorized.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.policy_number.toLowerCase().includes(term) ||
      item.plan_name.toLowerCase().includes(term) ||
      (item.customers?.full_name ?? "").toLowerCase().includes(term) ||
      (item.customers?.phone ?? "").includes(term);

    const matchesFilter =
      filter === "all" ||
      item.category === filter;

    return matchesSearch && matchesFilter;
  });

  const selectStyle = {
    padding: "10px 12px",
    border: "1px solid var(--border, #d1d5db)",
    borderRadius: "9px",
    background: "var(--card, white)",
    color: "inherit",
    fontSize: "14px",
  } as const;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>Premium Reminders</h2>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>Track overdue and upcoming policy premiums.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadReminders()}
          style={{ ...selectStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "14px" }}>
        <div style={{ border: "1px solid #fecaca", borderRadius: "12px", padding: "16px" }}>
          <AlertCircle size={22} color="#dc2626" />
          <div style={{ fontSize: "26px", fontWeight: 700, marginTop: "8px" }}>{overdueCount}</div>
          <div style={{ fontSize: "14px" }}>Overdue</div>
        </div>
        <div style={{ border: "1px solid #fde68a", borderRadius: "12px", padding: "16px" }}>
          <Clock size={22} color="#b45309" />
          <div style={{ fontSize: "26px", fontWeight: 700, marginTop: "8px" }}>{soonCount}</div>
          <div style={{ fontSize: "14px" }}>Due in 7 days</div>
        </div>
        <div style={{ border: "1px solid #bfdbfe", borderRadius: "12px", padding: "16px" }}>
          <CalendarDays size={22} color="#2563eb" />
          <div style={{ fontSize: "26px", fontWeight: 700, marginTop: "8px" }}>{upcomingCount}</div>
          <div style={{ fontSize: "14px" }}>Due in 8–30 days</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={17} style={{ position: "absolute", left: "12px", top: "13px", opacity: 0.6 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or policy..."
            style={{ ...selectStyle, width: "100%", boxSizing: "border-box", paddingLeft: "38px" }}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectStyle}>
          <option value="all">All reminders</option>
          <option value="overdue">Overdue</option>
          <option value="soon">Due in 7 days</option>
          <option value="upcoming">Due in 8–30 days</option>
          <option value="later">Due after 30 days</option>
        </select>
      </div>

      {loading ? (
        <p>Loading premium reminders...</p>
      ) : error ? (
        <div style={{ padding: "16px", border: "1px solid #fecaca", borderRadius: "10px", color: "#b91c1c" }}>
          Could not load reminders: {error}
          <p style={{ marginBottom: 0 }}>Check the policies table and its customer relationship.</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center", border: "1px dashed var(--border, #d1d5db)", borderRadius: "12px" }}>
          <CalendarDays size={30} style={{ margin: "0 auto 10px", opacity: 0.6 }} />
          <p style={{ fontWeight: 600 }}>No matching reminders</p>
          <p style={{ opacity: 0.7, fontSize: "14px" }}>
            Active policies with a next due date will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {visible.map((item) => {
            const overdue = item.category === "overdue";
            const soon = item.category === "soon";
            const label = overdue
              ? `${Math.abs(item.days)} day(s) overdue`
              : item.days === 0
              ? "Due today"
              : `Due in ${item.days} day(s)`;

            return (
              <article key={item.id} style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "12px", padding: "16px", display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "17px" }}>
                      {item.customers?.full_name ?? "Customer name unavailable"}
                    </div>
                    <div style={{ fontSize: "13px", opacity: 0.7, marginTop: "4px" }}>
                      Policy: {item.policy_number} · {item.plan_name}
                    </div>
                    {item.customers?.phone && (
                      <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        Phone: {item.customers.phone}
                      </div>
                    )}
                  </div>
                  <span style={{
                    alignSelf: "flex-start",
                    padding: "6px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: overdue ? "#fee2e2" : soon ? "#fef3c7" : item.category === "upcoming" ? "#dbeafe" : "#f3f4f6",
                    color: overdue ? "#991b1b" : soon ? "#92400e" : item.category === "upcoming" ? "#1e40af" : "#374151",
                  }}>
                    {label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "14px" }}>
                  <div>
                    <div style={{ opacity: 0.65, fontSize: "12px" }}>Premium amount</div>
                    <strong>{money(item.premium_amount)}</strong>
                  </div>
                  <div>
                    <div style={{ opacity: 0.65, fontSize: "12px" }}>Frequency</div>
                    <strong>{item.premium_frequency.replace("_", " ")}</strong>
                  </div>
                  <div>
                    <div style={{ opacity: 0.65, fontSize: "12px" }}>Next due date</div>
                    <strong>{item.next_due_date ? dateText(item.next_due_date) : "Not set"}</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
