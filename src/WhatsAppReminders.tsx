
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  MessageCircle,
  Search,
  RefreshCw,
  ExternalLink,
  Users,
  Clock3,
  AlertTriangle,
  CalendarCheck,
  ShieldCheck,
  Phone,
  Languages,
  IndianRupee,
} from "lucide-react";

type Reminder = {
  id: string;
  customer_id: string;
  policy_number: string;
  plan_name: string;
  premium_amount: number;
  premium_frequency: string;
  next_due_date: string;
  status: string;
  customers:
    | { full_name: string; phone: string | null }
    | { full_name: string; phone: string | null }[]
    | null;
};

function getCustomer(item: Reminder) {
  return Array.isArray(item.customers)
    ? item.customers[0]
    : item.customers;
}

function getDaysUntilDue(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${date}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function WhatsAppReminders() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReminders() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("policies")
      .select(`
        id,
        customer_id,
        policy_number,
        plan_name,
        premium_amount,
        premium_frequency,
        next_due_date,
        status,
        customers(full_name, phone)
      `)
      .eq("status", "active")
      .not("next_due_date", "is", null)
      .order("next_due_date", { ascending: true });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as Reminder[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadReminders();
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const customer = getCustomer(item);
      const days = getDaysUntilDue(item.next_due_date);

      const matchesSearch =
        !query ||
        customer?.full_name?.toLowerCase().includes(query) ||
        item.policy_number?.toLowerCase().includes(query) ||
        item.plan_name?.toLowerCase().includes(query) ||
        customer?.phone?.includes(search.trim());

      const matchesFilter =
        filter === "all" ||
        (filter === "overdue" && days < 0) ||
        (filter === "today" && days === 0) ||
        (filter === "upcoming" && days > 0);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const overdueCount = items.filter(
    (item) => getDaysUntilDue(item.next_due_date) < 0
  ).length;

  const todayCount = items.filter(
    (item) => getDaysUntilDue(item.next_due_date) === 0
  ).length;

  const upcomingCount = items.filter(
    (item) => getDaysUntilDue(item.next_due_date) > 0
  ).length;

  const totalPremium = items.reduce(
    (sum, item) => sum + Number(item.premium_amount || 0),
    0
  );

  function makeMessage(item: Reminder) {
    const customer = getCustomer(item);
    const name = customer?.full_name || "Customer";
    const dueDate = formatDate(item.next_due_date);
    const amount = formatMoney(item.premium_amount);

    if (language === "hi") {
      return `नमस्ते ${name} जी,

आपकी LIC पॉलिसी ${item.policy_number} (${item.plan_name || "LIC Policy"}) के प्रीमियम की अगली देय तिथि ${dueDate} है।
प्रीमियम राशि: ${amount}

कृपया भुगतान से पहले अपनी आधिकारिक पॉलिसी में देय तिथि और राशि की पुष्टि कर लें।

धन्यवाद।`;
    }

    return `Dear ${name},

This is a friendly reminder that the next premium for your LIC policy ${item.policy_number} (${item.plan_name || "LIC Policy"}) is due on ${dueDate}.
Premium amount: ${amount}

Please verify the due date and amount against your official policy details before making payment.

Thank you.`;
  }

  function openWhatsApp(item: Reminder) {
    const customer = getCustomer(item);
    const rawPhone = customer?.phone?.trim() || "";
    const digits = rawPhone.replace(/\D/g, "");

    if (!digits) {
      window.alert(
        "इस ग्राहक का phone number उपलब्ध नहीं है। पहले Customer details में नंबर जोड़ें।"
      );
      return;
    }

    const phone = digits.length === 10 ? `91${digits}` : digits;

    if (phone.length < 11 || phone.length > 15) {
      window.alert(
        "Phone number का format सही नहीं लग रहा। Customer details में country code सहित नंबर जाँचें।"
      );
      return;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(
      makeMessage(item)
    )}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function dueStatus(date: string) {
    const days = getDaysUntilDue(date);

    if (days < 0) {
      return {
        label: `${Math.abs(days)} दिन overdue`,
        className: "wa-status-overdue",
        icon: AlertTriangle,
      };
    }

    if (days === 0) {
      return {
        label: "आज देय",
        className: "wa-status-today",
        icon: Clock3,
      };
    }

    if (days <= 7) {
      return {
        label: `${days} दिन में देय`,
        className: "wa-status-soon",
        icon: Clock3,
      };
    }

    return {
      label: "Upcoming",
      className: "wa-status-upcoming",
      icon: CalendarCheck,
    };
  }

  return (
    <main className="whatsapp-reminders">
      <section className="wa-hero">
        <div className="wa-hero-top">
          <div className="wa-brand-mark">
            <MessageCircle size={27} />
          </div>

          <button
            type="button"
            className="wa-refresh"
            onClick={() => void loadReminders()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "wa-spin" : ""} />
            Refresh
          </button>
        </div>

        <p className="wa-eyebrow">
          <ShieldCheck size={14} /> LIC SAATHI WORKSPACE
        </p>

        <h1>Premium Reminders</h1>

        <p className="wa-hero-description">
          ग्राहकों के premium due reminders तैयार करें और WhatsApp पर
          व्यक्तिगत संदेश खोलें।
        </p>

        <div className="wa-hero-footer">
          <span>
            <Languages size={15} /> WhatsApp message assistant
          </span>
          <span className="wa-live-indicator">
            <span /> Active policies
          </span>
        </div>
      </section>

      <section className="wa-stats-grid">
        <article className="wa-stat-card">
          <div className="wa-stat-top">
            <span>Overdue</span>
            <span className="wa-stat-icon wa-icon-red">
              <AlertTriangle size={19} />
            </span>
          </div>
          <strong>{overdueCount}</strong>
          <p>पिछली देय तिथि निकल चुकी है</p>
        </article>

        <article className="wa-stat-card">
          <div className="wa-stat-top">
            <span>Due Today</span>
            <span className="wa-stat-icon wa-icon-amber">
              <Clock3 size={19} />
            </span>
          </div>
          <strong>{todayCount}</strong>
          <p>आज देय प्रीमियम</p>
        </article>

        <article className="wa-stat-card">
          <div className="wa-stat-top">
            <span>Upcoming</span>
            <span className="wa-stat-icon wa-icon-teal">
              <CalendarCheck size={19} />
            </span>
          </div>
          <strong>{upcomingCount}</strong>
          <p>आगे की देय तिथियाँ</p>
        </article>

        <article className="wa-stat-card">
          <div className="wa-stat-top">
            <span>Premium Total</span>
            <span className="wa-stat-icon wa-icon-blue">
              <IndianRupee size={19} />
            </span>
          </div>
          <strong className="wa-stat-money">{formatMoney(totalPremium)}</strong>
          <p>दिखाई गई active policies की कुल राशि</p>
        </article>
      </section>

      <section className="wa-workspace">
        <div className="wa-section-heading">
          <div>
            <p className="wa-section-kicker">CUSTOMER FOLLOW-UP</p>
            <h2>Premium due list</h2>
            <p>पॉलिसी की जानकारी जाँचकर reminder तैयार करें।</p>
          </div>

          <div className="wa-record-count">
            <Users size={16} />
            {filteredItems.length} records
          </div>
        </div>

        <div className="wa-toolbar">
          <label className="wa-search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ग्राहक, फोन या policy number खोजें..."
            />
          </label>

          <label className="wa-language-select">
            <Languages size={17} />
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as "hi" | "en")
              }
              aria-label="Reminder language"
            >
              <option value="hi">हिंदी संदेश</option>
              <option value="en">English message</option>
            </select>
          </label>
        </div>

        <div className="wa-filter-row">
          {[
            { key: "all", label: "सभी", count: items.length },
            { key: "overdue", label: "Overdue", count: overdueCount },
            { key: "today", label: "आज देय", count: todayCount },
            { key: "upcoming", label: "Upcoming", count: upcomingCount },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              className={`wa-filter-chip ${
                filter === option.key ? "wa-filter-active" : ""
              }`}
              onClick={() =>
                setFilter(
                  option.key as "all" | "overdue" | "today" | "upcoming"
                )
              }
            >
              {option.label}
              <span>{option.count}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="wa-state-panel">
            <RefreshCw size={24} className="wa-spin" />
            <h3>Policies लोड हो रही हैं</h3>
            <p>कृपया कुछ क्षण प्रतीक्षा करें।</p>
          </div>
        )}

        {!loading && error && (
          <div className="wa-state-panel wa-state-error">
            <AlertTriangle size={25} />
            <h3>Policies लोड नहीं हो सकीं</h3>
            <p>{error}</p>
            <button
              type="button"
              className="wa-secondary-button"
              onClick={() => void loadReminders()}
            >
              फिर से कोशिश करें
            </button>
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="wa-state-panel">
            <CalendarCheck size={28} />
            <h3>कोई policy नहीं मिली</h3>
            <p>Search या filter बदलकर फिर से देखें।</p>
            <button
              type="button"
              className="wa-secondary-button"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              सभी policies दिखाएँ
            </button>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <div className="wa-policy-list">
            {filteredItems.map((item) => {
              const customer = getCustomer(item);
              const status = dueStatus(item.next_due_date);
              const StatusIcon = status.icon;

              return (
                <article className="wa-policy-card" key={item.id}>
                  <div className="wa-card-main">
                    <div className="wa-customer-avatar">
                      {(customer?.full_name || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="wa-customer-details">
                      <div className="wa-customer-title">
                        <h3>{customer?.full_name || "Unknown customer"}</h3>
                        <span className={`wa-status ${status.className}`}>
                          <StatusIcon size={13} />
                          {status.label}
                        </span>
                      </div>

                      <p className="wa-policy-plan">
                        {item.plan_name || "LIC Policy"}
                      </p>

                      <div className="wa-policy-meta">
                        <span>
                          Policy: <strong>{item.policy_number || "N/A"}</strong>
                        </span>
                        <span>
                          <Phone size={13} />
                          {customer?.phone || "Phone unavailable"}
                        </span>
                      </div>
                    </div>

                    <div className="wa-premium-box">
                      <span>Premium amount</span>
                      <strong>{formatMoney(item.premium_amount)}</strong>
                      <small>Due {formatDate(item.next_due_date)}</small>
                    </div>
                  </div>

                  <div className="wa-card-footer">
                    <span className="wa-frequency">
                      <CalendarCheck size={14} />
                      Frequency: {item.premium_frequency || "Not specified"}
                    </span>

                    <button
                      type="button"
                      className="wa-send-button"
                      onClick={() => openWhatsApp(item)}
                    >
                      <MessageCircle size={18} />
                      Prepare WhatsApp Reminder
                      <ExternalLink size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="wa-privacy-note">
          <ShieldCheck size={18} />
          <p>
            <strong>Review before sending.</strong> WhatsApp opens with a
            pre-filled message. Verify the policy details and recipient before
            sending. No message is sent automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
