
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import {
  FilePlus2,
  Search,
  Save,
  RefreshCw,
  ClipboardList,
  UserRound,
} from "lucide-react";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
};

type Application = {
  id: string;
  customer_id: string;
  plan_name: string | null;
  application_number: string | null;
  proposed_sum_assured: number | null;
  proposed_premium: number | null;
  premium_frequency: string | null;
  policy_term_years: number | null;
  premium_payment_term_years: number | null;
  application_status: string;
  proposed_start_date: string | null;
  notes: string | null;
  created_at: string;
};

const emptyForm = {
  customer_id: "",
  plan_name: "",
  application_number: "",
  proposed_sum_assured: "",
  proposed_premium: "",
  premium_frequency: "yearly",
  policy_term_years: "",
  premium_payment_term_years: "",
  application_status: "draft",
  proposed_start_date: "",
  notes: "",
};

const statuses = [
  { value: "draft", label: "Draft" },
  { value: "documents_pending", label: "Documents Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "issued", label: "Issued" },
];

const statusLabels: Record<string, string> = Object.fromEntries(
  statuses.map((status) => [status.value, status.label])
);

export default function PolicyApplications() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");

    const [customerResult, applicationResult] = await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, phone")
        .order("full_name"),
      supabase
        .from("policy_applications")
        .select(
          "id, customer_id, plan_name, application_number, proposed_sum_assured, proposed_premium, premium_frequency, policy_term_years, premium_payment_term_years, application_status, proposed_start_date, notes, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (customerResult.error) {
      setError(customerResult.error.message);
    } else {
      setCustomers((customerResult.data ?? []) as Customer[]);
    }

    if (applicationResult.error) {
      setError((previous) =>
        previous
          ? `${previous} | ${applicationResult.error.message}`
          : applicationResult.error!.message
      );
    } else {
      setApplications((applicationResult.data ?? []) as Application[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function updateForm(key: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please sign in again before saving.");
      setSaving(false);
      return;
    }

    const sumAssured = Number(form.proposed_sum_assured);
    const premium = Number(form.proposed_premium);
    const term = Number(form.policy_term_years);
    const paymentTerm = Number(form.premium_payment_term_years);

    if (
      !form.customer_id ||
      !form.plan_name.trim() ||
      !form.proposed_sum_assured ||
      !form.proposed_premium ||
      !form.policy_term_years ||
      !form.premium_payment_term_years
    ) {
      setError("Please complete all required fields marked with *.");
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(sumAssured) ||
      sumAssured < 0 ||
      !Number.isFinite(premium) ||
      premium < 0 ||
      !Number.isInteger(term) ||
      term <= 0 ||
      !Number.isInteger(paymentTerm) ||
      paymentTerm <= 0
    ) {
      setError(
        "Enter valid non-negative amounts and positive whole-number terms."
      );
      setSaving(false);
      return;
    }

    if (paymentTerm > term) {
      setError("Premium payment term cannot exceed the policy term.");
      setSaving(false);
      return;
    }

    const record = {
      agent_id: authData.user.id,
      customer_id: form.customer_id,
      plan_name: form.plan_name.trim(),
      application_number: form.application_number.trim() || null,
      proposed_sum_assured: sumAssured,
      proposed_premium: premium,
      premium_frequency: form.premium_frequency,
      policy_term_years: term,
      premium_payment_term_years: paymentTerm,
      application_status: form.application_status,
      proposed_start_date: form.proposed_start_date || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from("policy_applications")
          .update(record)
          .eq("id", editingId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("policy_applications")
          .insert(record)
          .select("id")
          .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      setError("The application was not saved. Check your access and try again.");
      setSaving(false);
      return;
    }

    setMessage(editingId ? "Application updated." : "Application saved.");
    setForm(emptyForm);
    setEditingId(null);
    await loadData();
    setSaving(false);
  }

  function editApplication(application: Application) {
    setEditingId(application.id);
    setForm({
      customer_id: application.customer_id,
      plan_name: application.plan_name ?? "",
      application_number: application.application_number ?? "",
      proposed_sum_assured:
        application.proposed_sum_assured == null
          ? ""
          : String(application.proposed_sum_assured),
      proposed_premium:
        application.proposed_premium == null
          ? ""
          : String(application.proposed_premium),
      premium_frequency: application.premium_frequency ?? "yearly",
      policy_term_years:
        application.policy_term_years == null
          ? ""
          : String(application.policy_term_years),
      premium_payment_term_years:
        application.premium_payment_term_years == null
          ? ""
          : String(application.premium_payment_term_years),
      application_status: application.application_status,
      proposed_start_date: application.proposed_start_date ?? "",
      notes: application.notes ?? "",
    });

    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filteredApplications = applications.filter((application) => {
    const customer = customers.find(
      (item) => item.id === application.customer_id
    );
    const query = search.trim().toLowerCase();

    return (
      (application.plan_name ?? "").toLowerCase().includes(query) ||
      (application.application_number ?? "").toLowerCase().includes(query) ||
      (customer?.full_name ?? "").toLowerCase().includes(query) ||
      application.application_status.toLowerCase().includes(query)
    );
  });

  const inputClass = "form-input";

  return (
    <section className="customer-master policy-applications">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">LIC SAATHI · NEW BUSINESS</p>
          <h1>Policy Applications</h1>
          <p className="subtitle">
            Prepare, track and update proposed policy applications for your
            customers.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && (
        <div className="success-message" role="status">{message}</div>
      )}
      {error && (
        <div className="error-message" role="alert">{error}</div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              <FilePlus2 size={19} />
              {editingId ? "Edit Application" : "Create Application"}
            </h3>
            <p>Fields marked with * are required.</p>
          </div>
          <ClipboardList size={25} color="#0d9488" />
        </div>

        <form onSubmit={saveApplication} className="customer-master-form">
          <div className="form-grid">
            <label>
              Customer *
              <select
                className={inputClass}
                required
                value={form.customer_id}
                onChange={(e) => updateForm("customer_id", e.target.value)}
              >
                <option value="">Select existing customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                    {customer.phone ? ` — ${customer.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              LIC Plan Name *
              <input
                className={inputClass}
                required
                maxLength={200}
                placeholder="Enter plan name"
                value={form.plan_name}
                onChange={(e) => updateForm("plan_name", e.target.value)}
              />
            </label>

            <label>
              Application Number
              <input
                className={inputClass}
                maxLength={100}
                placeholder="Optional reference number"
                value={form.application_number}
                onChange={(e) =>
                  updateForm("application_number", e.target.value)
                }
              />
            </label>

            <label>
              Proposed Sum Assured (₹) *
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                required
                value={form.proposed_sum_assured}
                onChange={(e) =>
                  updateForm("proposed_sum_assured", e.target.value)
                }
              />
            </label>

            <label>
              Proposed Premium (₹) *
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                required
                value={form.proposed_premium}
                onChange={(e) =>
                  updateForm("proposed_premium", e.target.value)
                }
              />
            </label>

            <label>
              Premium Frequency *
              <select
                className={inputClass}
                required
                value={form.premium_frequency}
                onChange={(e) =>
                  updateForm("premium_frequency", e.target.value)
                }
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half-yearly</option>
                <option value="yearly">Yearly</option>
                <option value="single">Single Premium</option>
              </select>
            </label>

            <label>
              Policy Term (Years) *
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                required
                value={form.policy_term_years}
                onChange={(e) =>
                  updateForm("policy_term_years", e.target.value)
                }
              />
            </label>

            <label>
              Premium Payment Term (Years) *
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                required
                value={form.premium_payment_term_years}
                onChange={(e) =>
                  updateForm("premium_payment_term_years", e.target.value)
                }
              />
            </label>

            <label>
              Application Status *
              <select
                className={inputClass}
                required
                value={form.application_status}
                onChange={(e) =>
                  updateForm("application_status", e.target.value)
                }
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Proposed Start Date
              <input
                className={inputClass}
                type="date"
                value={form.proposed_start_date}
                onChange={(e) =>
                  updateForm("proposed_start_date", e.target.value)
                }
              />
            </label>

            <label className="form-full">
              Notes
              <textarea
                className={inputClass}
                maxLength={3000}
                placeholder="Additional application notes"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              <Save size={17} />
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Application"
                  : "Save Application"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>

          {customers.length === 0 && !loading && (
            <p className="subtitle">
              Add a customer in Customer Master before creating an application.
            </p>
          )}
        </form>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              <ClipboardList size={19} /> Application Register
            </h3>
            <p>{applications.length} saved application(s)</p>
          </div>
        </div>

        <div className="search-box">
          <Search size={17} />
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, plan, reference or status"
          />
        </div>

        {loading ? (
          <p className="subtitle">Loading applications...</p>
        ) : filteredApplications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FilePlus2 size={26} />
            </div>
            <h3>No applications found</h3>
            <p>Create an application using the form above.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f5f8fc" }}>
                  <th style={{ padding: 12 }}>Customer / Plan</th>
                  <th style={{ padding: 12 }}>Sum Assured</th>
                  <th style={{ padding: 12 }}>Premium</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => {
                  const customer = customers.find(
                    (item) => item.id === application.customer_id
                  );

                  return (
                    <tr key={application.id} style={{ borderTop: "1px solid #e5ebf2" }}>
                      <td style={{ padding: 12 }}>
                        <strong style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <UserRound size={15} />
                          {customer?.full_name ?? "Customer"}
                        </strong>
                        <div style={{ fontSize: 12, color: "#708097", marginTop: 5 }}>
                          {application.plan_name || "Unnamed plan"}
                        </div>
                        {application.application_number && (
                          <div style={{ fontSize: 11, color: "#708097", marginTop: 3 }}>
                            Ref: {application.application_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                        ₹{Number(application.proposed_sum_assured ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: 12 }}>
                        <div>₹{Number(application.proposed_premium ?? 0).toLocaleString("en-IN")}</div>
                        <small style={{ color: "#708097" }}>
                          {application.premium_frequency?.replace("_", " ")}
                        </small>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{
                          display: "inline-block",
                          padding: "6px 9px",
                          borderRadius: 7,
                          background: application.application_status === "issued" ? "#e6f8ef" :
                            application.application_status === "rejected" ? "#fff0f0" : "#edf4fc",
                          color: application.application_status === "issued" ? "#18764c" :
                            application.application_status === "rejected" ? "#b4232d" : "#214d7e",
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {statusLabels[application.application_status] ?? application.application_status}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editApplication(application)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
