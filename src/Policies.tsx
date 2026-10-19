
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Customer = {
  id: string;
  full_name: string;
};

type Policy = {
  id: string;
  customer_id: string;
  policy_number: string;
  plan_name: string | null;
  sum_assured: number | null;
  premium_amount: number;
  premium_frequency: string;
  start_date: string | null;
  next_due_date: string | null;
  status: string;
  notes: string | null;
  customers?: { full_name: string } | null;
};

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [planName, setPlanName] = useState("");
  const [sumAssured, setSumAssured] = useState("");
  const [premium, setPremium] = useState("");
  const [frequency, setFrequency] = useState("yearly");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("id, full_name")
      .order("full_name");

    const { data: policyData, error: policyError } = await supabase
      .from("policies")
      .select("id, customer_id, policy_number, plan_name, sum_assured, premium_amount, premium_frequency, start_date, next_due_date, status, notes, customers(full_name)")
      .order("created_at", { ascending: false });

    if (customerError || policyError) {
      setMessage(
        "Data load nahi hua. Database permissions aur customer relationship check karein."
      );
    } else {
      setCustomers(customerData ?? []);
      setPolicies((policyData ?? []) as unknown as Policy[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function addPolicy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Pehle login karein.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("policies").insert({
      agent_id: authData.user.id,
      customer_id: customerId,
      policy_number: policyNumber.trim(),
      plan_name: planName.trim() || null,
      sum_assured: sumAssured ? Number(sumAssured) : null,
      premium_amount: Number(premium),
      premium_frequency: frequency,
      start_date: startDate || null,
      next_due_date: dueDate || null,
      notes: notes.trim() || null,
    });

    if (error) {
      setMessage("Policy save nahi hui: " + error.message);
    } else {
      setMessage("Policy successfully add ho gayi!");
      setPolicyNumber("");
      setPlanName("");
      setSumAssured("");
      setPremium("");
      setStartDate("");
      setDueDate("");
      setNotes("");
      await loadData();
    }

    setSaving(false);
  }

  async function deletePolicy(id: string) {
    if (!window.confirm("Kya aap is policy ko delete karna chahte hain?")) {
      return;
    }

    const { error } = await supabase
      .from("policies")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage("Policy delete nahi hui: " + error.message);
    } else {
      setMessage("Policy delete ho gayi.");
      await loadData();
    }
  }

  const filteredPolicies = policies.filter((policy) => {
    const customerName = policy.customers?.full_name ?? "";
    const text = `${policy.policy_number} ${policy.plan_name ?? ""} ${customerName}`;
    return text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="policies-page">
      <div className="policies-heading">
        <div>
          <h1>Policies Management</h1>
          <p>Manage your customers' LIC policies in one place.</p>
        </div>
        <div className="policies-count">
          <strong>{policies.length}</strong>
          <span>Total Policies</span>
        </div>
      </div>

      {message && <p role="status" className="policy-message">{message}</p>}

      <section className="policy-form-card">
        <h2>Add New Policy</h2>

        {customers.length === 0 ? (
          <p>Pehle Customers page se ek customer add karein.</p>
        ) : (
          <form onSubmit={addPolicy} className="policy-form">
            <label>
              Customer *
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Policy Number *
              <input
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                required
              />
            </label>

            <label>
              Plan Name
              <input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </label>

            <label>
              Sum Assured (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={sumAssured}
                onChange={(e) => setSumAssured(e.target.value)}
              />
            </label>

            <label>
              Premium Amount (₹) *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                required
              />
            </label>

            <label>
              Premium Frequency *
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                required
              >
                <option value="yearly">Yearly</option>
                <option value="half_yearly">Half-yearly</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
                
              </select>
            </label>

            <label>
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label>
              Next Due Date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>

            <label className="policy-notes-field">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </label>

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Policy"}
            </button>
          </form>
        )}
      </section>

      <section className="policy-list-card">
        <div className="policy-list-heading">
          <h2>All Policies</h2>
          <input
            placeholder="Search policy or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading policies...</p>
        ) : filteredPolicies.length === 0 ? (
          <p>No policies found.</p>
        ) : (
          <div className="policy-table-wrap">
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Policy Number</th>
                  <th>Plan</th>
                  <th>Premium</th>
                  <th>Frequency</th>
                  <th>Next Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td>{policy.customers?.full_name ?? "Customer"}</td>
                    <td>{policy.policy_number}</td>
                    <td>{policy.plan_name || "—"}</td>
                    <td>₹{Number(policy.premium_amount).toLocaleString("en-IN")}</td>
                    <td>{policy.premium_frequency}</td>
                    <td>{policy.next_due_date || "—"}</td>
                    <td>
                      <span className="policy-status">{policy.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="policy-delete-button"
                        onClick={() => void deletePolicy(policy.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
