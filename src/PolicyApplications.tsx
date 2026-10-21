
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

type PolicyApplicationsProps = { onResumeDraft?: (applicationId: string) => void };

export default function PolicyApplications({ onResumeDraft }: PolicyApplicationsProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [detailNominees, setDetailNominees] = useState<
    {
      id: string;
      full_name: string;
      relationship: string;
      date_of_birth: string | null;
      share_percentage: number;
    }[]
  >([]);
  const [detailMedicalAnswers, setDetailMedicalAnswers] = useState<
    { id: string; question_label: string; answer: string }[]
  >([]);
    const [detailDocuments, setDetailDocuments] = useState<
    {
      id: string;
      document_type: string;
      status: string;
      original_file_name: string | null;
      storage_path: string | null;
      file_size_bytes: number | null;
    }[]
  >([]);
  const [documentType, setDocumentType] = useState("identity_proof");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);

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


  async function viewApplication(application: Application) {
    setSelectedApplication(application);
    setDetailNominees([]);
    setDetailMedicalAnswers([]);
    setDetailDocuments([]);
    setDetailsLoading(true);
    setError("");

    const [nomineeResult, medicalResult, documentResult] =
      await Promise.all([
        supabase
          .from("policy_nominees")
          .select(
            "id, full_name, relationship, date_of_birth, share_percentage"
          )
          .eq("application_id", application.id),
        supabase
          .from("application_medical_answers")
          .select("id, question_label, answer")
          .eq("application_id", application.id),
        supabase
          .from("application_documents")
          .select(
  "id, document_type, status, original_file_name, storage_path, file_size_bytes"
)
          .eq("application_id", application.id),
      ]);

    if (nomineeResult.error) {
      setError("Nominee details: " + nomineeResult.error.message);
    } else {
      setDetailNominees(nomineeResult.data ?? []);
    }

    if (medicalResult.error) {
      setError((previous) =>
        previous
          ? previous + " | Medical details: " + medicalResult.error.message
          : "Medical details: " + medicalResult.error.message
      );
    } else {
      setDetailMedicalAnswers(medicalResult.data ?? []);
    }

    if (documentResult.error) {
      setError((previous) =>
        previous
          ? previous + " | Documents: " + documentResult.error.message
          : "Documents: " + documentResult.error.message
      );
    } else {
      setDetailDocuments(documentResult.data ?? []);
    }

    setDetailsLoading(false);
  }

  async function uploadDocument() {
    if (!selectedApplication) {
      setError("Open an application first.");
      return;
    }

    if (!selectedFile) {
      setError("Please choose a PDF, JPG, or PNG file.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Only PDF, JPG, and PNG files are allowed.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must be 5 MB or less.");
      return;
    }

    setUploadingDocument(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const safeName = selectedFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const storagePath =
        `${user.id}/${selectedApplication.id}/` +
        `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("lic-customer-documents")
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("application_documents")
        .insert({
          agent_id: user.id,
          application_id: selectedApplication.id,
          document_type: documentType,
          status: "received",
          storage_path: storagePath,
          original_file_name: selectedFile.name,
          content_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
        });

      if (insertError) {
        await supabase.storage
          .from("lic-customer-documents")
          .remove([storagePath]);
        throw insertError;
      }

      const { data, error: listError } = await supabase
        .from("application_documents")
        .select(
          "id, document_type, status, original_file_name, storage_path, file_size_bytes"
        )
        .eq("application_id", selectedApplication.id)
        .order("created_at", { ascending: false });

      if (listError) throw listError;

      setDetailDocuments(data ?? []);
      setSelectedFile(null);
      setMessage("Document uploaded successfully.");
    } catch (err) {
      console.error("LIC Saathi document upload error:", err);

      const detail =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);

      setError("Document upload failed: " + detail);
    } finally {
      setUploadingDocument(false);
    }
  }

  async function downloadDocument(
    file: {
      id: string;
      document_type: string;
      status: string;
      original_file_name: string | null;
      storage_path: string | null;
      file_size_bytes: number | null;
    }
  ) {
    if (!file.storage_path) {
      setError("No stored file path is available.");
      return;
    }

    setDownloadingDocumentId(file.id);
    setError("");

    // Open a tab immediately to reduce popup-blocking risk.
    const downloadTab = window.open("about:blank", "_blank");

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("lic-customer-documents")
        .createSignedUrl(file.storage_path, 60);

      if (signedUrlError) throw signedUrlError;

      if (downloadTab) {
        downloadTab.location.href = data.signedUrl;
      } else {
        window.location.assign(data.signedUrl);
      }
    } catch (err) {
      downloadTab?.close();
      setError(
        "Document access failed: " +
          (err instanceof Error ? err.message : "Unknown error.")
      );
    } finally {
      setDownloadingDocumentId("");
    }
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
          <p className="eyebrow">LIC SAATHI Â· NEW BUSINESS</p>
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
                    {customer.phone ? ` â€” ${customer.phone}` : ""}
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
                        
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  {application.application_status === "draft" && onResumeDraft && (
    <button
      type="button"
      className="secondary-button"
      onClick={() => onResumeDraft(application.id)}
    >
      Resume Draft
    </button>
  )}
  <button
    type="button"
    className="secondary-button"
    onClick={() => void viewApplication(application)}
  >
    View Details
  </button>
  <button
    type="button"
    className="secondary-button"
    onClick={() => editApplication(application)}
  >
    Edit
  </button>
</div>

                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    
      {selectedApplication && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="application-details-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "white",
            }}
          >
            <div className="panel-heading">
              <div>
                <h3 id="application-details-title">
                  Application Details
                </h3>
                <p>
                  {selectedApplication.application_number ||
                    "Application reference not provided"}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedApplication(null)}
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <p>Loading saved details...</p>
            ) : (
              <>
                <h3>Policy Information</h3>
                <div className="form-grid">
                  <p>
                    <strong>Customer:</strong>{" "}
                    {customers.find(
                      (c) => c.id === selectedApplication.customer_id
                    )?.full_name ?? "Customer"}
                  </p>
                  <p>
                    <strong>Plan:</strong>{" "}
                    {selectedApplication.plan_name || "Not provided"}
                  </p>
                  <p>
                    <strong>Sum Assured:</strong>{" "}
                    ₹{Number(
                      selectedApplication.proposed_sum_assured ?? 0
                    ).toLocaleString("en-IN")}
                  </p>
                  <p>
                    <strong>Premium:</strong>{" "}
                    ₹{Number(
                      selectedApplication.proposed_premium ?? 0
                    ).toLocaleString("en-IN")}
                  </p>
                  <p>
                    <strong>Frequency:</strong>{" "}
                    {selectedApplication.premium_frequency || "Not provided"}
                  </p>
                  <p>
                    <strong>Policy Term:</strong>{" "}
                    {selectedApplication.policy_term_years ?? "â€”"} years
                  </p>
                  <p>
                    <strong>Payment Term:</strong>{" "}
                    {selectedApplication.premium_payment_term_years ?? "â€”"} years
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {statusLabels[selectedApplication.application_status] ??
                      selectedApplication.application_status}
                  </p>
                  <p>
                    <strong>Proposed Start:</strong>{" "}
                    {selectedApplication.proposed_start_date || "Not set"}
                  </p>
                </div>

                <h3>Notes</h3>
                <p>{selectedApplication.notes || "No notes added."}</p>

                <h3>Nominee Details</h3>
                {detailNominees.length === 0 ? (
                  <p>No nominee records found for this application.</p>
                ) : (
                  detailNominees.map((nominee) => (
                    <div
                      key={nominee.id}
                      style={{
                        padding: 12,
                        border: "1px solid #e5ebf2",
                        borderRadius: 8,
                        marginBottom: 8,
                      }}
                    >
                      <strong>{nominee.full_name}</strong>
                      <p>Relationship: {nominee.relationship}</p>
                      <p>
                        Date of birth: {nominee.date_of_birth || "Not provided"}
                      </p>
                      <p>Share: {nominee.share_percentage}%</p>
                    </div>
                  ))
                )}

                <h3>Medical Questionnaire</h3>
                {detailMedicalAnswers.length === 0 ? (
                  <p>No saved medical answers found.</p>
                ) : (
                  detailMedicalAnswers.map((answer) => (
                    <div
                      key={answer.id}
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #e5ebf2",
                      }}
                    >
                      <strong>{answer.question_label}</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {answer.answer}
                      </p>
                    </div>
                  ))
                )}

                <h3>Documents</h3>

              <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                <label>
                  Document type
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    style={{ display: "block", width: "100%", padding: 8 }}
                  >
                    <option value="identity_proof">Identity proof</option>
                    <option value="address_proof">Address proof</option>
                    <option value="age_proof">Age proof</option>
                    <option value="photo">Photograph</option>
                    <option value="signature">Signature</option>
                    <option value="income_proof">Income proof</option>
                    <option value="medical_report">Medical report</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />

                <p>Allowed: PDF, JPG, PNG. Maximum size: 5 MB.</p>

                <button
                  type="button"
                  disabled={uploadingDocument || !selectedFile}
                  onClick={() => void uploadDocument()}
                >
                  {uploadingDocument ? "Uploading..." : "Upload document"}
                </button>
              </div>

              {detailDocuments.length === 0 ? (
                <p>No documents uploaded for this application.</p>
              ) : (
                detailDocuments.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #e5ebf2",
                    }}
                  >
                    <strong>{file.original_file_name || file.document_type}</strong>
                    <p>Type: {file.document_type}</p>
                    <p>Status: {file.status}</p>
                    <p>
                      Size:{" "}
                      {file.file_size_bytes == null
                        ? "Unknown"
                        : `${(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`}
                    </p>
                    <button
                      type="button"
                      disabled={!file.storage_path || downloadingDocumentId === file.id}
                      onClick={() => void downloadDocument(file)}
                    >
                      {downloadingDocumentId === file.id
                        ? "Preparing..."
                        : "View / Download"}
                    </button>
                  </div>
                ))
              )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}




