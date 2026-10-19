
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import { Users, UserPlus, RefreshCw, Save, Search } from "lucide-react";

type Application = {
  id: string;
  customer_id: string;
  plan_name: string | null;
  application_number: string | null;
  application_status: string;
  customers: { full_name: string } | null;
};

type Nominee = {
  id: string;
  application_id: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  share_percentage: number;
  appointee_name: string | null;
  appointee_relationship: string | null;
};

const initialForm = {
  application_id: "",
  full_name: "",
  relationship: "",
  date_of_birth: "",
  share_percentage: "100",
  appointee_name: "",
  appointee_relationship: "",
};

export default function Nominees() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [appResult, nomineeResult] = await Promise.all([
      supabase
        .from("policy_applications")
        .select(
          "id, customer_id, plan_name, application_number, application_status, customers(full_name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("policy_nominees")
        .select(
          "id, application_id, full_name, relationship, date_of_birth, share_percentage, appointee_name, appointee_relationship"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (appResult.error) {
      setError(appResult.error.message);
    } else {
      setApplications((appResult.data ?? []) as unknown as Application[]);
    }

    if (nomineeResult.error) {
      setError((previous) =>
        previous
          ? `${previous} | ${nomineeResult.error.message}`
          : nomineeResult.error!.message
      );
    } else {
      setNominees((nomineeResult.data ?? []) as Nominee[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function updateField(key: keyof typeof initialForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function saveNominee(event: FormEvent<HTMLFormElement>) {
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

    const share = Number(form.share_percentage);

    if (
      !form.application_id ||
      !form.full_name.trim() ||
      !form.relationship.trim() ||
      !Number.isFinite(share) ||
      share <= 0 ||
      share > 100
    ) {
      setError("Enter all required fields and a share percentage from 0 to 100.");
      setSaving(false);
      return;
    }

    const record = {
      agent_id: authData.user.id,
      application_id: form.application_id,
      full_name: form.full_name.trim(),
      relationship: form.relationship.trim(),
      date_of_birth: form.date_of_birth || null,
      share_percentage: share,
      appointee_name: form.appointee_name.trim() || null,
      appointee_relationship: form.appointee_relationship.trim() || null,
    };

    const result = editingId
      ? await supabase
          .from("policy_nominees")
          .update(record)
          .eq("id", editingId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("policy_nominees")
          .insert(record)
          .select("id")
          .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      setError("Nominee was not saved. Check your access and try again.");
      setSaving(false);
      return;
    }

    setMessage(editingId ? "Nominee updated successfully." : "Nominee saved successfully.");
    setForm(initialForm);
    setEditingId(null);
    await loadData();
    setSaving(false);
  }

  function editNominee(nominee: Nominee) {
    setEditingId(nominee.id);
    setForm({
      application_id: nominee.application_id,
      full_name: nominee.full_name,
      relationship: nominee.relationship,
      date_of_birth: nominee.date_of_birth ?? "",
      share_percentage: String(nominee.share_percentage),
      appointee_name: nominee.appointee_name ?? "",
      appointee_relationship: nominee.appointee_relationship ?? "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visibleNominees = nominees.filter((nominee) => {
    const application = applications.find(
      (item) => item.id === nominee.application_id
    );
    const query = search.trim().toLowerCase();

    return (
      nominee.full_name.toLowerCase().includes(query) ||
      nominee.relationship.toLowerCase().includes(query) ||
      (application?.customers?.full_name ?? "").toLowerCase().includes(query) ||
      (application?.plan_name ?? "").toLowerCase().includes(query)
    );
  });

  const inputClass = "form-input";

  return (
    <section className="customer-master policy-applications">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">LIC SAATHI · APPLICATION DETAILS</p>
          <h1>Nominee Details</h1>
          <p className="subtitle">
            Record and update nominees linked to policy applications.
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

      {message && <div className="success-message" role="status">{message}</div>}
      {error && <div className="error-message" role="alert">{error}</div>}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3><UserPlus size={19} /> {editingId ? "Edit Nominee" : "Add Nominee"}</h3>
            <p>Select the application to link this nominee.</p>
          </div>
          <Users size={25} color="#0d9488" />
        </div>

        <form onSubmit={saveNominee}>
          <div className="form-grid">
            <label className="form-full">
              Policy Application *
              <select
                className={inputClass}
                required
                value={form.application_id}
                onChange={(e) => updateField("application_id", e.target.value)}
              >
                <option value="">Select application</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {(application.customers?.full_name ?? "Customer") +
                      " — " +
                      (application.plan_name ?? "Plan") +
                      (application.application_number
                        ? ` (${application.application_number})`
                        : "")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Nominee Full Name *
              <input
                className={inputClass}
                required
                maxLength={200}
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="Enter nominee name"
              />
            </label>

            <label>
              Relationship to Customer *
              <select
                className={inputClass}
                required
                value={form.relationship}
                onChange={(e) => updateField("relationship", e.target.value)}
              >
                <option value="">Select relationship</option>
                <option value="Spouse">Spouse</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              Nominee Date of Birth
              <input
                className={inputClass}
                type="date"
                value={form.date_of_birth}
                onChange={(e) => updateField("date_of_birth", e.target.value)}
              />
            </label>

            <label>
              Share Percentage (%) *
              <input
                className={inputClass}
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                value={form.share_percentage}
                onChange={(e) => updateField("share_percentage", e.target.value)}
              />
            </label>

            <label>
              Appointee Name
              <input
                className={inputClass}
                maxLength={200}
                value={form.appointee_name}
                onChange={(e) => updateField("appointee_name", e.target.value)}
                placeholder="If applicable for a minor nominee"
              />
            </label>

            <label>
              Appointee Relationship
              <input
                className={inputClass}
                maxLength={100}
                value={form.appointee_relationship}
                onChange={(e) =>
                  updateField("appointee_relationship", e.target.value)
                }
                placeholder="Relationship to nominee"
              />
            </label>
          </div>

          <p className="subtitle">
            If there are multiple nominees, confirm that their combined share
            percentages meet the applicable LIC form requirements before submission.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="primary-button" disabled={saving}>
              <Save size={17} />
              {saving ? "Saving..." : editingId ? "Update Nominee" : "Save Nominee"}
            </button>
            {editingId && (
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>

          {!loading && applications.length === 0 && (
            <p className="subtitle">
              Create a Policy Application before adding its nominee.
            </p>
          )}
        </form>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3><Users size={19} /> Nominee Register</h3>
            <p>{nominees.length} saved nominee(s)</p>
          </div>
        </div>

        <div className="search-box">
          <Search size={17} />
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nominee, customer or plan"
          />
        </div>

        {loading ? (
          <p className="subtitle">Loading nominee records...</p>
        ) : visibleNominees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Users size={26} /></div>
            <h3>No nominees found</h3>
            <p>Add a nominee using the form above.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f5f8fc" }}>
                  <th style={{ padding: 12 }}>Nominee</th>
                  <th style={{ padding: 12 }}>Customer / Plan</th>
                  <th style={{ padding: 12 }}>Share</th>
                  <th style={{ padding: 12 }}>Appointee</th>
                  <th style={{ padding: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleNominees.map((nominee) => {
                  const application = applications.find(
                    (item) => item.id === nominee.application_id
                  );

                  return (
                    <tr key={nominee.id} style={{ borderTop: "1px solid #e5ebf2" }}>
                      <td style={{ padding: 12 }}>
                        <strong>{nominee.full_name}</strong>
                        <div style={{ fontSize: 12, color: "#708097", marginTop: 4 }}>
                          {nominee.relationship}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <div>{application?.customers?.full_name ?? "Customer"}</div>
                        <small style={{ color: "#708097" }}>
                          {application?.plan_name ?? "Plan"}
                        </small>
                      </td>
                      <td style={{ padding: 12 }}>{nominee.share_percentage}%</td>
                      <td style={{ padding: 12 }}>
                        {nominee.appointee_name || "—"}
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editNominee(nominee)}
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
