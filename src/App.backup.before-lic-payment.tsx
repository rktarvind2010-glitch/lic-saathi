import Policies from "./Policies";
import Customers from "./Customers";
import PremiumPayments from "./PremiumPayments";
import Reminders from "./Reminders";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import CsvExport from "./CsvExport";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Bell,
  Settings,
  Plus,
  Menu,
  IndianRupee,
  CalendarDays,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Customers", icon: Users },
  { label: "Policies", icon: FileText },
  { label: "Premium Payments", icon: CreditCard },
  { label: "Reminders", icon: Bell },
  { label: "Settings", icon: Settings },
];

function App() {
  const [active, setActive] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
const [activePolicyCount, setActivePolicyCount] = useState(0);
const [collectedTotal, setCollectedTotal] = useState(0);
const [upcomingPremiumCount, setUpcomingPremiumCount] = useState(0);
  const [recentCustomers, setRecentCustomers] = useState<
    { id: string; full_name: string; phone: string | null }[]
  >([]);

  useEffect(() => {
    async function loadDashboardCustomers() {
      const { count, error: countError } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });

      if (!countError) {
        setCustomerCount(count ?? 0);
      }

      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error) {
        setRecentCustomers(data ?? []);
      }
const { count: policyCount, error: policyError } = await supabase
  .from("policies")
  .select("*", { count: "exact", head: true })
  .eq("status", "active");

if (!policyError) {
  setActivePolicyCount(policyCount ?? 0);
}
const today = new Date();
today.setHours(0, 0, 0, 0);

const next30Days = new Date(today);
next30Days.setDate(next30Days.getDate() + 30);

const { data: upcomingPolicies, error: upcomingError } = await supabase
  .from("policies")
  .select("next_due_date")
  .eq("status", "active")
  .not("next_due_date", "is", null)
  .gte("next_due_date", today.toISOString().slice(0, 10))
  .lte("next_due_date", next30Days.toISOString().slice(0, 10));

if (!upcomingError) {
  setUpcomingPremiumCount(upcomingPolicies?.length ?? 0);
}
const { data: paymentData, error: paymentError } = await supabase
  .from("premium_payments")
  .select("amount");

if (!paymentError) {
  const total = (paymentData ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  setCollectedTotal(total);
}
    }
    void loadDashboardCustomers();
  }, []);

  const stats = [
    { title: "Total Customers", value: String(customerCount), note: "Registered customers", icon: Users },
    { title: "Active Policies", value: String(activePolicyCount), note: "Active policies recorded", icon: ShieldCheck },
    { title: "Premium Collected", value: `₹${collectedTotal.toLocaleString("en-IN")}`, note: "Payments recorded", icon: IndianRupee },
    { title: "Upcoming Premiums", value: String(upcomingPremiumCount), note: "Due in the next 30 days", icon: CalendarDays },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={25} /></div>
          <div>
            <h2>LIC Saathi</h2>
            <p>AGENT MANAGEMENT</p>
          </div>
        </div>

        <div className="menu-heading">WORKSPACE</div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? "active" : ""}`}
              onClick={() => {
                setActive(item.label);
                setMenuOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {active === item.label && <ChevronRight size={16} />}
            </button>
          );
        })}

        <div className="sidebar-bottom">
          <div className="secure-badge">
            <ShieldCheck size={20} />
            <div><strong>Your workspace</strong><p>Secure setup in progress</p></div>
          </div>
          <div className="profile">
            <div className="avatar">A</div>
            <div><strong>LIC Agent</strong><p>Workspace preview</p></div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <Menu size={22} />
          </button>
          <div className="breadcrumb">Workspace <span>/</span> {active}</div>
          <div className="top-actions">
            <span className="preview-label">DEMO PREVIEW</span>
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /></button>
          </div>
        </header>

        <div className="page-content">
  
{active === "Customers" ? (
  <Customers />
) : active === "Policies" ? (
  <Policies />
) : active === "Premium Payments" ? (
  <PremiumPayments />
) : active === "Reminders" ? (
  <Reminders />
) : active === "Settings" ? (
  <CsvExport />
) : (

    <>
    <section className="welcome-row">
      <div>
        <p className="eyebrow">YOUR INSURANCE WORKSPACE</p>
        <h1>{active === "Dashboard" ? "Welcome to LIC Saathi" : active}</h1>
        <p className="subtitle">
          {active === "Dashboard"
            ? "Manage customers, policies and premium records in one place."
            : `Your ${active.toLowerCase()} workspace. Features will be connected step by step.`}
        </p>
      </div>
      <button className="primary-button" onClick={() => setActive("Customers")}>
        <Plus size={18} /> Add Customer
      </button>
    </section>

    <section className="stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <article className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <div className="stat-icon"><Icon size={20} /></div>
            </div>
            <h2>{stat.value}</h2>
            <p>{stat.note}</p>
          </article>
        );
      })}
    </section>

    <section className="content-grid">
      <article className="panel">
        <div className="panel-heading">
          <div><h3>Recent Customers</h3><p>Your latest customer records</p></div>
          <button className="text-button" onClick={() => setActive("Customers")}>
            View all <ChevronRight size={15} />
          </button>
        </div>
        {recentCustomers.length === 0 ? (
  <div className="empty-state">
    <div className="empty-icon"><Users size={27} /></div>
    <h3>No customers yet</h3>
    <p>Your customer records will appear here when you add a customer.</p>
    <button
      className="secondary-button"
      onClick={() => setActive("Customers")}
    >
      <Plus size={17} /> Explore Customers
    </button>
  </div>
) : (
  <div className="recent-customer-list">
    {recentCustomers.map((customer) => (
      <div className="recent-customer-item" key={customer.id}>
        <div className="customer-avatar">
          {customer.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <strong>{customer.full_name}</strong>
          <p>{customer.phone || "No phone number"}</p>
        </div>
      </div>
    ))}
  </div>
)}
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div><h3>Quick Actions</h3><p>Shortcuts for daily work</p></div>
        </div>
        <div className="quick-list">
          <button onClick={() => setActive("Customers")}><span className="quick-icon"><Users size={19} /></span><span><strong>Add a customer</strong><small>Maintain customer details</small></span><ChevronRight size={17} /></button>
          <button onClick={() => setActive("Policies")}><span className="quick-icon"><FileText size={19} /></span><span><strong>Record a policy</strong><small>Organize policy information</small></span><ChevronRight size={17} /></button>
          <button onClick={() => setActive("Premium Payments")}><span className="quick-icon"><CreditCard size={19} /></span><span><strong>Track a premium</strong><small>Manage payment records</small></span><ChevronRight size={17} /></button>
          <button onClick={() => setActive("Reminders")}><span className="quick-icon"><Bell size={19} /></span><span><strong>Review reminders</strong><small>Keep upcoming dues in view</small></span><ChevronRight size={17} /></button>
        </div>
      </article>
    </section>

    <section className="bottom-note">
      <TrendingUp size={19} />
      <p><strong>One workspace, organized records.</strong> The dashboard is currently a visual preview. Database, authentication and access controls will be configured next.</p>
    </section>

    <footer>LIC Saathi Â· Independent record-management workspace Â· Demo preview</footer>
  </>
)}
              </div>
      </main>
    </div>
  );
}

export default App;



