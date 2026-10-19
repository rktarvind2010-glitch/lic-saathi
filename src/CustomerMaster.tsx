
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import { UserRound, Search, Save, Plus, RefreshCw } from "lucide-react";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type ProfileForm = {
  date_of_birth: string;
  gender: string;
  occupation: string;
  annual_income: string;
  education: string;
  marital_status: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const emptyProfile: ProfileForm = {
  date_of_birth: "",
  gender: "",
  occupation: "",
  annual_income: "",
  education: "",
  marital_status: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
};

export default function CustomerMaster() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [basic, setBasic] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const selectedCustomer = customers.find((c) => c.id === selectedId);

  async function loadCustomers() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("customers")
      .select("id, full_name, phone, email, address")
      .order("full_name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setCustomers([]);
    } else {
      setCustomers((data ?? []) as Customer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!selectedId) {
        setForm(emptyProfile);
        return;
      }

      setMessage("");
      setError("");

      const { data, error: profileError } = await supabase
        .from("customer_profiles")
        .select(
          "date_of_birth, gender, occupation, annual_income, education, marital_status, address_line_2, city, state, postal_code, country"
        )
        .eq("customer_id", selectedId)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setForm({
        date_of_birth: data?.date_of_birth ?? "",
        gender: data?.gender ?? "",
        occupation: data?.occupation ?? "",
        annual_income:
          data?.annual_income == null ? "" : String(data.annual_income),
        education: data?.education ?? "",
        marital_status: data?.marital_status ?? "",
        address_line_2: data?.address_line_2 ?? "",
        city: data?.city ?? "",
        state: data?.state ?? "",
        postal_code: data?.postal_code ?? "",
        country: data?.country ?? "India",
      });
    }

    void loadProfile();
  }, [selectedId]);

  function updateForm<K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    const user = authData.user;

    if (authError || !user) {
      setError("Please sign in again before adding a customer.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("customers")
      .insert({
        agent_id: user.id,
        full_name: basic.full_name.trim(),
        phone: basic.phone.trim() || null,
        email: basic.email.trim() || null,
        address: basic.address.trim() || null,
        notes: basic.notes.trim() || null,
      })
      .select("id, full_name, phone, email, address")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create customer.");
      setSaving(false);
      return;
    }

    setCustomers((previous) =>
      [...previous, data as Customer].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      )
    );
    setSelectedId(data.id);
    setCreating(false);
    setBasic({
      full_name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setMessage("Customer added. Now complete and save their profile.");
    setSaving(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCustomer) {
      setError("Please select a customer first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    const user = authData.user;

    if (authError || !user) {
      setError("Please sign in again before saving.");
      setSaving(false);
      return;
    }

    const income = form.annual_income.trim();

    if (income && (!Number.isFinite(Number(income)) || Number(income) < 0)) {
      setError("Annual income must be a valid non-negative number.");
      setSaving(false);
      return;
    }

    const profile = {
      agent_id: user.id,
      customer_id: selectedCustomer.id,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      occupation: form.occupation.trim() || null,
      annual_income: income ? Number(income) : null,
      education: form.education.trim() || null,
      marital_status: form.marital_status || null,
      address_line_2: form.address_line_2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim() || "India",
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = await supabase
      .from("customer_profiles")
      .upsert(profile, { onConflict: "customer_id" });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage("Customer profile saved successfully.");
    }

    setSaving(false);
  }

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();
    return (
      customer.full_name.toLowerCase().includes(term) ||
      (customer.phone ?? "").toLowerCase().includes(term) ||
      (customer.email ?? "").toLowerCase().includes(term)
    );
  });

  const inputClass = "form-input";

  return (
    <section className="customer-master">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Customer Master</h1>
          <p className="subtitle">
            Select an existing customer or add a new one, then maintain their
            detailed profile.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadCustomers()}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message && <div className="success-message" role="status">{message}</div>}
      {error && <div className="error-message" role="alert">{error}</div>}

      <div className="panel customer-master-selector">
        <div className="panel-heading">
          <div>
            <h3><UserRound size={18} /> Select Customer</h3>
            <p>Existing customer records are kept unchanged.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setCreating((value) => !value);
              setMessage("");
              setError("");
            }}
          >
            <Plus size={17} /> {creating ? "Cancel" : "New Customer"}
          </button>
        </div>

        {!creating && (
          <>
            <label htmlFor="customer-search">Search customers</label>
            <div className="search-box">
              <Search size={17} />
              <input
                id="customer-search"
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone or email"
              />
            </div>

            <label htmlFor="customer-select">Choose customer</label>
            <select
              id="customer-select"
              className={inputClass}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">-- Select a customer --</option>
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                  {customer.phone ? ` — ${customer.phone}` : ""}
                </option>
              ))}
            </select>

            {loading && <p>Loading customers...</p>}
            {!loading && customers.length === 0 && (
              <p>No customers found. Use New Customer to add one.</p>
            )}
          </>
        )}

        {creating && (
          <form onSubmit={createCustomer} className="customer-master-form">
            <h3>Basic Customer Details</h3>
            <div className="form-grid">
              <label>
                Full name *
                <input
                  className={inputClass}
                  required
                  maxLength={150}
                  value={basic.full_name}
                  onChange={(e) =>
                    setBasic({ ...basic, full_name: e.target.value })
                  }
                />
              </label>
              <label>
                Phone
                <input
                  className={inputClass}
                  type="tel"
                  maxLength={30}
                  value={basic.phone}
                  onChange={(e) =>
                    setBasic({ ...basic, phone: e.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  className={inputClass}
                  type="email"
                  maxLength={254}
                  value={basic.email}
                  onChange={(e) =>
                    setBasic({ ...basic, email: e.target.value })
                  }
                />
              </label>
              <label>
                Address
                <input
                  className={inputClass}
                  maxLength={500}
                  value={basic.address}
                  onChange={(e) =>
                    setBasic({ ...basic, address: e.target.value })
                  }
                />
              </label>
              <label className="form-full">
                Notes
                <textarea
                  className={inputClass}
                  maxLength={2000}
                  value={basic.notes}
                  onChange={(e) =>
                    setBasic({ ...basic, notes: e.target.value })
                  }
                />
              </label>
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              <Plus size={17} /> {saving ? "Adding..." : "Add Customer"}
            </button>
          </form>
        )}
      </div>

      {selectedCustomer && !creating && (
        <form onSubmit={saveProfile} className="panel customer-master-form">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DETAILED PROFILE</p>
              <h3>{selectedCustomer.full_name}</h3>
              <p>
                {selectedCustomer.phone || "No phone"}
                {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ""}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Date of Birth
              <input
                className={inputClass}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.date_of_birth}
                onChange={(e) => updateForm("date_of_birth", e.target.value)}
              />
            </label>

            <label>
              Gender
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => updateForm("gender", e.target.value)}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>

            <label>
              Occupation
              <input
                className={inputClass}
                maxLength={150}
                value={form.occupation}
                onChange={(e) => updateForm("occupation", e.target.value)}
              />
            </label>

            <label>
              Annual Income (₹)
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.annual_income}
                onChange={(e) => updateForm("annual_income", e.target.value)}
              />
            </label>

            <label>
              Education
              <input
                className={inputClass}
                maxLength={150}
                value={form.education}
                onChange={(e) => updateForm("education", e.target.value)}
              />
            </label>

            <label>
              Marital Status
              <select
                className={inputClass}
                value={form.marital_status}
                onChange={(e) =>
                  updateForm("marital_status", e.target.value)
                }
              >
                <option value="">Select</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="widowed">Widowed</option>
                <option value="divorced">Divorced</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Address Line 2
              <input
                className={inputClass}
                maxLength={300}
                value={form.address_line_2}
                onChange={(e) =>
                  updateForm("address_line_2", e.target.value)
                }
              />
            </label>

            <label>
              City
              <input
                className={inputClass}
                maxLength={100}
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
              />
            </label>

            <label>
              State
              <input
                className={inputClass}
                maxLength={100}
                value={form.state}
                onChange={(e) => updateForm("state", e.target.value)}
              />
            </label>

            <label>
              Postal Code
              <input
                className={inputClass}
                maxLength={20}
                value={form.postal_code}
                onChange={(e) => updateForm("postal_code", e.target.value)}
              />
            </label>

            <label>
              Country
              <input
                className={inputClass}
                maxLength={100}
                value={form.country}
                onChange={(e) => updateForm("country", e.target.value)}
              />
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={17} /> {saving ? "Saving..." : "Save Customer Profile"}
          </button>
        </form>
      )}
    </section>
  );
}
