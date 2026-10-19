
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Search, Trash2, Users, X } from "lucide-react";
import { supabase } from "./lib/supabase";

type Customer = {
  id: string;
  agent_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("customers")
      .select("id, agent_id, full_name, phone, email, address, notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("ग्राहक लोड नहीं हुए: " + error.message);
    } else {
      setCustomers((data ?? []) as Customer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        throw new Error("पहले अपने खाते में लॉग इन करें।");
      }

      const { error } = await supabase.from("customers").insert({
        agent_id: user.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });

      if (error) throw error;

      setForm(emptyForm);
      setShowForm(false);
      setMessage("ग्राहक सफलतापूर्वक सेव हो गया।");
      await loadCustomers();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ग्राहक सेव नहीं हो पाया।"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `क्या "${customer.full_name}" का रिकॉर्ड हटाना चाहते हैं?`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      setMessage("रिकॉर्ड नहीं हटा: " + error.message);
      return;
    }

    setMessage("ग्राहक का रिकॉर्ड हटा दिया गया।");
    await loadCustomers();
  }

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();

    return (
      customer.full_name.toLowerCase().includes(term) ||
      (customer.phone ?? "").includes(term) ||
      (customer.email ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <section className="customer-page">
      <div className="customer-toolbar">
        <div>
          <h2>Customers</h2>
          <p>ग्राहकों के रिकॉर्ड व्यवस्थित रखें।</p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setMessage("");
            setShowForm(!showForm);
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "बंद करें" : "Add Customer"}
        </button>
      </div>

      {message && (
        <p className="customer-message" role="status">
          {message}
        </p>
      )}

      {showForm && (
        <form className="customer-form" onSubmit={addCustomer}>
          <label>
            पूरा नाम *
            <input
              required
              maxLength={150}
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              placeholder="ग्राहक का नाम"
            />
          </label>

          <label>
            मोबाइल नंबर
            <input
              type="tel"
              maxLength={20}
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              placeholder="मोबाइल नंबर"
            />
          </label>

          <label>
            ईमेल
            <input
              type="email"
              maxLength={254}
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              placeholder="name@example.com"
            />
          </label>

          <label>
            पता
            <textarea
              maxLength={1000}
              value={form.address}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
              placeholder="ग्राहक का पता"
            />
          </label>

          <label>
            नोट्स
            <textarea
              maxLength={2000}
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              placeholder="ज़रूरी जानकारी"
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "सेव हो रहा है..." : "Save Customer"}
          </button>
        </form>
      )}

      <div className="customer-search">
        <Search size={19} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="नाम, मोबाइल या ईमेल से खोजें..."
          aria-label="ग्राहक खोजें"
        />
      </div>

      {loading ? (
        <p>ग्राहक लोड हो रहे हैं...</p>
      ) : filteredCustomers.length === 0 ? (
        <div className="customer-empty">
          <Users size={32} />
          <h3>{search ? "कोई ग्राहक नहीं मिला" : "अभी कोई ग्राहक नहीं है"}</h3>
          <p>
            {search
              ? "दूसरा नाम या मोबाइल नंबर खोजकर देखें।"
              : "पहला ग्राहक जोड़ने के लिए Add Customer दबाएँ।"}
          </p>
        </div>
      ) : (
        <div className="customer-list">
          {filteredCustomers.map((customer) => (
            <article className="customer-card" key={customer.id}>
              <div className="customer-avatar">
                {customer.full_name.charAt(0).toUpperCase()}
              </div>

              <div className="customer-details">
                <h3>{customer.full_name}</h3>
                <p>{customer.phone || "मोबाइल नंबर नहीं दिया गया"}</p>
                {customer.email && <p>{customer.email}</p>}
                {customer.address && <p>{customer.address}</p>}
              </div>

              <button
                className="customer-delete"
                type="button"
                aria-label={`${customer.full_name} का रिकॉर्ड हटाएँ`}
                title="रिकॉर्ड हटाएँ"
                onClick={() => void deleteCustomer(customer)}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="customer-count">
        कुल दिखाई दे रहे ग्राहक: {filteredCustomers.length}
      </p>
    </section>
  );
}
