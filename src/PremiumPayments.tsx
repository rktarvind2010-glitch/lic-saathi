
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Policy = {
  id: string;
  policy_number: string;
  premium_amount: number;
  customers: { full_name: string } | null;
};

type Payment = {
  id: string;
  policy_id: string;
  amount: number;
  paid_on: string;
  payment_method: string | null;
  receipt_reference: string | null;
  notes: string | null;
  policies: {
    policy_number: string;
    customers: { full_name: string } | null;
  } | null;
};

export default function PremiumPayments() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [policyId, setPolicyId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [method, setMethod] = useState("cash");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    const { data: policyData, error: policyError } = await supabase
      .from("policies")
      .select("id, policy_number, premium_amount, customers(full_name)")
      .order("created_at", { ascending: false });

    const { data: paymentData, error: paymentError } = await supabase
      .from("premium_payments")
      .select(
        "id, policy_id, amount, paid_on, payment_method, receipt_reference, notes, policies(policy_number, customers(full_name))"
      )
      .order("paid_on", { ascending: false });

    if (policyError || paymentError) {
      setMessage(
        "Data load nahi hua: " +
          (policyError?.message || paymentError?.message)
      );
    } else {
      setPolicies((policyData ?? []) as unknown as Policy[]);
      setPayments((paymentData ?? []) as unknown as Payment[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function addPayment(e: React.FormEvent<HTMLFormElement>) {
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

    const selectedPolicy = policies.find((p) => p.id === policyId);

    if (!selectedPolicy) {
      setMessage("Apni policy select karein.");
      setSaving(false);
      return;
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setMessage("Payment amount zero se zyada hona chahiye.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("premium_payments").insert({
      agent_id: authData.user.id,
      policy_id: policyId,
      amount: paymentAmount,
      paid_on: paidOn,
      payment_method: method,
      receipt_reference: receipt.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) {
      setMessage("Payment save nahi hui: " + error.message);
    } else {
      setMessage("Payment successfully save ho gayi!");
      setAmount("");
      setReceipt("");
      setNotes("");
      await loadData();
    }

    setSaving(false);
  }

  async function deletePayment(id: string) {
    if (!window.confirm("Kya aap is payment record ko delete karna chahte hain?")) {
      return;
    }

    const { error } = await supabase
      .from("premium_payments")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage("Payment delete nahi hui: " + error.message);
    } else {
      setMessage("Payment record delete ho gaya.");
      await loadData();
    }
  }

  const filteredPayments = payments.filter((p) => {
    const customer = p.policies?.customers?.full_name ?? "";
    const policyNumber = p.policies?.policy_number ?? "";
    return `${customer} ${policyNumber} ${p.receipt_reference ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const total = filteredPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return (
    <div className="policies-page">
      <div className="policies-heading">
        <div>
          <h1>Premium Payments</h1>
          <p>Record and track policy premium payments.</p>
        </div>
        <div className="policies-count">
          <strong>₹{total.toLocaleString("en-IN")}</strong>
          <span>Payments shown</span>
        </div>
      </div>

      {message && (
        <p role="status" className="policy-message">{message}</p>
      )}

      <section className="policy-form-card">
        <h2>Record New Payment</h2>

        {policies.length === 0 ? (
          <p>Pehle Policies page par apni policy add karein.</p>
        ) : (
          <form onSubmit={addPayment} className="policy-form">
            <label>
              Policy *
              <select
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                required
              >
                <option value="">Select policy</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.policy_number} — {p.customers?.full_name ?? "Customer"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Amount (₹) *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>

            <label>
              Payment Date *
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                required
              />
            </label>

            <label>
              Payment Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Receipt Reference
              <input
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                placeholder="Optional receipt reference"
              />
            </label>

            <label>
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </label>

            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </form>
        )}
      </section>

      <section className="policy-list-card">
        <div className="policy-list-heading">
          <h2>Payment History</h2>
          <input
            placeholder="Search customer, policy or receipt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading payments...</p>
        ) : filteredPayments.length === 0 ? (
          <p>No payment records found.</p>
        ) : (
          <div className="policy-table-wrap">
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Policy Number</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Receipt</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paid_on}</td>
                    <td>{p.policies?.customers?.full_name ?? "Customer"}</td>
                    <td>{p.policies?.policy_number ?? "—"}</td>
                    <td>₹{Number(p.amount).toLocaleString("en-IN")}</td>
                    <td>{p.payment_method || "—"}</td>
                    <td>{p.receipt_reference || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="policy-delete-button"
                        onClick={() => void deletePayment(p.id)}
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
