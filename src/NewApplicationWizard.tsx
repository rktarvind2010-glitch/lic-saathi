
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FileUp,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
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

type PlanForm = {
  plan_name: string;
  proposed_sum_assured: string;
  proposed_premium: string;
  premium_frequency: string;
  policy_term_years: string;
  premium_payment_term_years: string;
  proposed_start_date: string;
  notes: string;
};

type NomineeForm = {
  full_name: string;
  relationship: string;
  date_of_birth: string;
  share_percentage: string;
  appointee_name: string;
  appointee_relationship: string;
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

const emptyPlan: PlanForm = {
  plan_name: "",
  proposed_sum_assured: "",
  proposed_premium: "",
  premium_frequency: "yearly",
  policy_term_years: "",
  premium_payment_term_years: "",
  proposed_start_date: "",
  notes: "",
};

const emptyNominee: NomineeForm = {
  full_name: "",
  relationship: "",
  date_of_birth: "",
  share_percentage: "100",
  appointee_name: "",
  appointee_relationship: "",
};

const medicalQuestions = [
  { key: "health_history", label: "Relevant health history" },
  { key: "hospitalization", label: "Previous hospitalization" },
  { key: "current_treatment", label: "Current treatment or medication" },
  { key: "tobacco_alcohol", label: "Tobacco or alcohol disclosure" },
  { key: "family_history", label: "Relevant family medical history" },
  { key: "additional_information", label: "Additional information" },
];

const steps = [
  "Customer",
  "Plan & Proposal",
  "Nominee & Medical",
  "Documents",
  "Review",
];

type NewApplicationWizardProps = {
  initialApplicationId?: string | null;
  onResumeLoaded?: () => void;
};

export default function NewApplicationWizard({
  initialApplicationId,
  onResumeLoaded,
}: NewApplicationWizardProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [plan, setPlan] = useState<PlanForm>(emptyPlan);
  const [nominee, setNominee] = useState<NomineeForm>(emptyNominee);
  const [medical, setMedical] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("identity_proof");
  const [uploadedDocuments, setUploadedDocuments] = useState<
    { name: string; type: string; size: number }[]
  >([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .order("full_name");

      if (loadError) {
        setError("Could not load customers: " + loadError.message);
      } else {
        setCustomers((data ?? []) as Customer[]);
      }

      setLoading(false);
    }

    void loadCustomers();
  }, []);

  useEffect(() => {
    if (initialApplicationId) {
      void loadExistingDraft(initialApplicationId);
    }
  }, [initialApplicationId]);

  async function loadExistingDraft(id: string) {
    setSaving(true);
    clearNotice();

    try {
      const { data: app, error: appError } = await supabase
        .from("policy_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (appError) throw appError;
      if (!app) throw new Error("Application was not found.");
      if (app.application_status !== "draft") {
        throw new Error("Only draft applications can be resumed.");
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", app.customer_id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customer) throw new Error("Linked customer was not found.");

      const [profileResult, nomineeResult, medicalResult, documentResult] =
        await Promise.all([
          supabase.from("customer_profiles").select("*")
            .eq("customer_id", customer.id).maybeSingle(),
          supabase.from("policy_nominees").select("*")
            .eq("application_id", id).limit(1),
          supabase.from("application_medical_answers").select("question_key, answer")
            .eq("application_id", id),
          supabase.from("application_documents")
            .select("document_type, original_file_name, file_size_bytes")
            .eq("application_id", id),
        ]);

      if (profileResult.error) throw profileResult.error;
      if (nomineeResult.error) throw nomineeResult.error;
      if (medicalResult.error) throw medicalResult.error;
      if (documentResult.error) throw documentResult.error;

      const savedProfile = profileResult.data;
      const savedNominee = nomineeResult.data?.[0];

      setApplicationId(app.id);
      setApplicationNumber(app.application_number ?? "");
      setSelectedCustomerId(customer.id);
      setNewCustomer(false);
      setCustomerName(customer.full_name ?? "");
      setPhone(customer.phone ?? "");
      setEmail(customer.email ?? "");
      setAddress(customer.address ?? "");

      setProfile({
        date_of_birth: savedProfile?.date_of_birth ?? "",
        gender: savedProfile?.gender ?? "",
        occupation: savedProfile?.occupation ?? "",
        annual_income: savedProfile?.annual_income == null
          ? "" : String(savedProfile.annual_income),
        education: savedProfile?.education ?? "",
        marital_status: savedProfile?.marital_status ?? "",
        address_line_2: savedProfile?.address_line_2 ?? "",
        city: savedProfile?.city ?? "",
        state: savedProfile?.state ?? "",
        postal_code: savedProfile?.postal_code ?? "",
        country: savedProfile?.country ?? "India",
      });

      setPlan({
        plan_name: app.plan_name ?? "",
        proposed_sum_assured: app.proposed_sum_assured == null
          ? "" : String(app.proposed_sum_assured),
        proposed_premium: app.proposed_premium == null
          ? "" : String(app.proposed_premium),
        premium_frequency: app.premium_frequency ?? "yearly",
        policy_term_years: app.policy_term_years == null
          ? "" : String(app.policy_term_years),
        premium_payment_term_years: app.premium_payment_term_years == null
          ? "" : String(app.premium_payment_term_years),
        proposed_start_date: app.proposed_start_date ?? "",
        notes: app.notes ?? "",
      });

      setNominee(savedNominee ? {
        full_name: savedNominee.full_name ?? "",
        relationship: savedNominee.relationship ?? "",
        date_of_birth: savedNominee.date_of_birth ?? "",
        share_percentage: String(savedNominee.share_percentage ?? 100),
        appointee_name: savedNominee.appointee_name ?? "",
        appointee_relationship: savedNominee.appointee_relationship ?? "",
      } : emptyNominee);

      const medicalValues: Record<string, string> = {};
      for (const row of medicalResult.data ?? []) {
        medicalValues[row.question_key] = row.answer ?? "";
      }
      setMedical(medicalValues);

      setUploadedDocuments((documentResult.data ?? []).map((doc) => ({
        name: doc.original_file_name ?? "Uploaded document",
        type: doc.document_type ?? "other",
        size: Number(doc.file_size_bytes ?? 0),
      })));

      setStep(0);
      setFinished(false);
      setSelectedDocumentFile(null);
      setMessage("Saved draft loaded. Continue editing your application.");
      onResumeLoaded?.();
    } catch (cause) {
      console.error("Resume draft error:", cause);
      setError("Could not resume draft: " +
        (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setSaving(false);
    }
  }

  function updateProfile(key: keyof ProfileForm, value: string) {
    setProfile((previous) => ({ ...previous, [key]: value }));
  }

  function updatePlan(key: keyof PlanForm, value: string) {
    setPlan((previous) => ({ ...previous, [key]: value }));
  }

  function updateNominee(key: keyof NomineeForm, value: string) {
    setNominee((previous) => ({ ...previous, [key]: value }));
  }

  function clearNotice() {
    setError("");
    setMessage("");
  }

  async function getAgentId() {
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!data.user) throw new Error("Please sign in again.");

    return data.user.id;
  }

  async function saveCustomerAndCreateDraft() {
    const agentId = await getAgentId();
    let customerId = selectedCustomerId;

    if (newCustomer) {
      if (!customerName.trim()) {
        throw new Error("Enter the customer's full name.");
      }

      if (!customerId) {
        const { data, error: customerError } = await supabase
          .from("customers")
          .insert({
            agent_id: agentId,
            full_name: customerName.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
          })
          .select("id")
          .single();

        if (customerError) throw customerError;

        customerId = data.id;
        setSelectedCustomerId(customerId);
      }
    }

    if (!customerId) {
      throw new Error("Select an existing customer or enter a new customer.");
    }

    const hasProfile = Object.entries(profile).some(([key, value]) =>
      key === "country" ? value !== "India" : value.trim() !== ""
    );

    if (hasProfile) {
      const profileRecord = {
        agent_id: agentId,
        customer_id: customerId,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        occupation: profile.occupation.trim() || null,
        annual_income: profile.annual_income
          ? Number(profile.annual_income)
          : null,
        education: profile.education.trim() || null,
        marital_status: profile.marital_status || null,
        address_line_2: profile.address_line_2.trim() || null,
        city: profile.city.trim() || null,
        state: profile.state.trim() || null,
        postal_code: profile.postal_code.trim() || null,
        country: profile.country.trim() || "India",
        updated_at: new Date().toISOString(),
      };

      if (
        profileRecord.annual_income !== null &&
        (!Number.isFinite(profileRecord.annual_income) ||
          profileRecord.annual_income < 0)
      ) {
        throw new Error("Enter a valid annual income.");
      }

      const { error: profileError } = await supabase
        .from("customer_profiles")
        .upsert(profileRecord, { onConflict: "customer_id" });

      if (profileError) throw profileError;
    }

    if (!applicationId) {
      const internalNumber = `LS-${Date.now()}`;

      const { data, error: draftError } = await supabase
        .from("policy_applications")
        .insert({
          agent_id: agentId,
          customer_id: customerId,
          application_number: internalNumber,
          application_status: "draft",
        })
        .select("id, application_number")
        .single();

      if (draftError) throw draftError;

      setApplicationId(data.id);
      setApplicationNumber(data.application_number ?? internalNumber);
    }
  }

  async function savePlan() {
    if (!applicationId) {
      throw new Error("Save the customer step first.");
    }

    const sumAssured = Number(plan.proposed_sum_assured);
    const premium = Number(plan.proposed_premium);
    const term = Number(plan.policy_term_years);
    const paymentTerm = Number(plan.premium_payment_term_years);

    if (
      !plan.plan_name.trim() ||
      !plan.proposed_sum_assured ||
      !plan.proposed_premium ||
      !plan.policy_term_years ||
      !plan.premium_payment_term_years
    ) {
      throw new Error("Complete all required plan fields.");
    }

    if (
      !Number.isFinite(sumAssured) ||
      sumAssured <= 0 ||
      !Number.isFinite(premium) ||
      premium <= 0 ||
      !Number.isInteger(term) ||
      term <= 0 ||
      !Number.isInteger(paymentTerm) ||
      paymentTerm <= 0
    ) {
      throw new Error("Enter valid amounts and positive whole-number terms.");
    }

    if (paymentTerm > term) {
      throw new Error("Premium payment term cannot exceed policy term.");
    }

    const { error: updateError } = await supabase
      .from("policy_applications")
      .update({
        plan_name: plan.plan_name.trim(),
        proposed_sum_assured: sumAssured,
        proposed_premium: premium,
        premium_frequency: plan.premium_frequency,
        policy_term_years: term,
        premium_payment_term_years: paymentTerm,
        proposed_start_date: plan.proposed_start_date || null,
        notes: plan.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) throw updateError;
  }

  async function saveNomineeAndMedical() {
    if (!applicationId) {
      throw new Error("Application draft not found.");
    }

    const agentId = await getAgentId();
    const hasNomineeName = nominee.full_name.trim() !== "";
    const hasNomineeRelationship = nominee.relationship.trim() !== "";

    if (hasNomineeName !== hasNomineeRelationship) {
      throw new Error("For a nominee, enter both full name and relationship.");
    }

    if (hasNomineeName && hasNomineeRelationship) {
      const share = Number(nominee.share_percentage);

      if (!Number.isFinite(share) || share <= 0 || share > 100) {
        throw new Error("Nominee share must be more than 0 and at most 100%.");
      }

      const { data: existing, error: lookupError } = await supabase
        .from("policy_nominees")
        .select("id")
        .eq("application_id", applicationId)
        .limit(1);

      if (lookupError) throw lookupError;

      const nomineeRecord = {
        agent_id: agentId,
        application_id: applicationId,
        full_name: nominee.full_name.trim(),
        relationship: nominee.relationship.trim(),
        date_of_birth: nominee.date_of_birth || null,
        share_percentage: share,
        appointee_name: nominee.appointee_name.trim() || null,
        appointee_relationship:
          nominee.appointee_relationship.trim() || null,
      };

      const result = existing?.length
        ? await supabase
            .from("policy_nominees")
            .update(nomineeRecord)
            .eq("id", existing[0].id)
        : await supabase.from("policy_nominees").insert(nomineeRecord);

      if (result.error) throw result.error;
    }

    for (const question of medicalQuestions) {
      const answer = (medical[question.key] ?? "").trim();

      if (!answer) {
        const { error: deleteError } = await supabase
          .from("application_medical_answers")
          .delete()
          .eq("application_id", applicationId)
          .eq("question_key", question.key);

        if (deleteError) throw deleteError;
        continue;
      }

      const { error: answerError } = await supabase
        .from("application_medical_answers")
        .upsert(
          {
            agent_id: agentId,
            application_id: applicationId,
            question_key: question.key,
            question_label: question.label,
            answer,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "application_id,question_key" }
        );

      if (answerError) throw answerError;
    }
  }

  async function uploadWizardDocument() {
    if (!applicationId) {
      setError("Save the customer and application draft first.");
      return;
    }

    if (!selectedDocumentFile) {
      setError("Choose a document file first.");
      return;
    }

    const file = selectedDocumentFile;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, JPG, and PNG files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must not exceed 5 MB.");
      return;
    }

    setUploadingDocument(true);
    clearNotice();

    let storagePath = "";

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again.");

      const user = authData.user;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      storagePath =
        `${user.id}/${applicationId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("lic-customer-documents")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("application_documents")
        .insert({
          agent_id: user.id,
          application_id: applicationId,
          document_type: documentType,
          status: "received",
          storage_path: storagePath,
          original_file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
        });

      if (insertError) {
        await supabase.storage
          .from("lic-customer-documents")
          .remove([storagePath]);
        storagePath = "";
        throw insertError;
      }

      setUploadedDocuments((previous) => [
        ...previous,
        { name: file.name, type: documentType, size: file.size },
      ]);
      setSelectedDocumentFile(null);

      const fileInput = document.getElementById(
        "wizard-document-file"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      setMessage("Document uploaded successfully.");
    } catch (cause) {
      console.error("LIC Saathi wizard document upload error:", cause);
      setError(
        cause instanceof Error ? cause.message : "Document upload failed."
      );
    } finally {
      setUploadingDocument(false);
    }
  }

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    setSaving(true);

    try {
      if (step === 0) {
        await saveCustomerAndCreateDraft();
        setStep(1);
        setMessage("Customer and application draft saved.");
      } else if (step === 1) {
        await savePlan();
        setStep(2);
        setMessage("Plan details saved.");
      } else if (step === 2) {
        await saveNomineeAndMedical();
        setStep(3);
        setMessage("Nominee and medical details saved where provided.");
      } else if (step === 3) {
        setStep(4);
        setMessage("Documents step completed. Review your draft.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function startNewApplication() {
    setStep(0);
    setApplicationId("");
    setApplicationNumber("");
    setSelectedCustomerId("");
    setNewCustomer(true);
    setCustomerName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setProfile(emptyProfile);
    setPlan(emptyPlan);
    setNominee(emptyNominee);
    setMedical({});
    setSelectedDocumentFile(null);
    setDocumentType("identity_proof");
    setUploadedDocuments([]);
    setFinished(false);
    clearNotice();
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const inputClass = "form-input";

  return (
    <section className="customer-master new-application-wizard">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">LIC SAATHI · NEW BUSINESS</p>
          <h1>New Application</h1>
          <p className="subtitle">
            Create and save a policy application draft step by step.
          </p>
        </div>
        <ShieldCheck size={30} color="#0d9488" />
      </div>

      <div className="panel">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {steps.map((label, index) => (
            <div
              key={label}
              style={{
                padding: "12px 8px",
                borderRadius: 10,
                background: index === step ? "#e7f5f3" : "#f4f6f9",
                border: index === step ? "1px solid #0d9488" : "1px solid #e5eaf0",
                color: index === step ? "#087f76" : "#627084",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              <div>{index + 1}</div>
              <div>{label}</div>
            </div>
          ))}
        </div>

        {message && (
          <div className="success-message" role="status">{message}</div>
        )}
        {error && (
          <div className="error-message" role="alert">{error}</div>
        )}

        {finished ? (
          <div className="empty-state">
            <CheckCircle2 size={42} color="#0d9488" />
            <h2>Draft saved</h2>
            <p>
              Reference: <strong>{applicationNumber || "Saved draft"}</strong>
            </p>
            <p>
              This is an internal LIC Saathi reference, not an official LIC
              application or policy number.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={startNewApplication}
            >
              <FilePlus2 size={17} /> Start Another Application
            </button>
          </div>
        ) : (
          <form onSubmit={handleContinue} className="customer-master-form">
            {step === 0 && (
              <>
                <div className="panel-heading">
                  <div>
                    <h3><UserRound size={19} /> Customer Details</h3>
                    <p>Choose an existing customer or add a new one.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="form-full">
                    Customer option *
                    <select
                      className={inputClass}
                      value={newCustomer ? "new" : "existing"}
                      onChange={(event) => {
                        const isNew = event.target.value === "new";
                        setNewCustomer(isNew);
                        setSelectedCustomerId("");
                      }}
                    >
                      <option value="new">Add a new customer</option>
                      <option value="existing">Select existing customer</option>
                    </select>
                  </label>

                  {newCustomer ? (
                    <>
                      <label>
                        Full name *
                        <input
                          className={inputClass}
                          required
                          maxLength={150}
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                        />
                      </label>
                      <label>
                        Mobile number
                        <input
                          className={inputClass}
                          type="tel"
                          maxLength={20}
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          className={inputClass}
                          type="email"
                          maxLength={254}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </label>
                      <label>
                        Address
                        <textarea
                          className={inputClass}
                          maxLength={1000}
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="form-full">
                      Existing customer *
                      <select
                        className={inputClass}
                        required
                        value={selectedCustomerId}
                        onChange={(event) => setSelectedCustomerId(event.target.value)}
                        disabled={loading}
                      >
                        <option value="">
                          {loading ? "Loading customers..." : "Select a customer"}
                        </option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.full_name}
                            {customer.phone ? ` — ${customer.phone}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="panel-heading" style={{ marginTop: 24 }}>
                  <div>
                    <h3>Additional Profile (Optional)</h3>
                    <p>Enter only information you need for this application.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Date of birth
                    <input
                      className={inputClass}
                      type="date"
                      value={profile.date_of_birth}
                      onChange={(event) => updateProfile("date_of_birth", event.target.value)}
                    />
                  </label>
                  <label>
                    Gender
                    <select
                      className={inputClass}
                      value={profile.gender}
                      onChange={(event) => updateProfile("gender", event.target.value)}
                    >
                      <option value="">Not specified</option>
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
                      value={profile.occupation}
                      onChange={(event) => updateProfile("occupation", event.target.value)}
                    />
                  </label>
                  <label>
                    Annual income (₹)
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={profile.annual_income}
                      onChange={(event) => updateProfile("annual_income", event.target.value)}
                    />
                  </label>
                  <label>
                    Education
                    <input
                      className={inputClass}
                      value={profile.education}
                      onChange={(event) => updateProfile("education", event.target.value)}
                    />
                  </label>
                  <label>
                    Marital status
                    <select
                      className={inputClass}
                      value={profile.marital_status}
                      onChange={(event) => updateProfile("marital_status", event.target.value)}
                    >
                      <option value="">Not specified</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="widowed">Widowed</option>
                      <option value="divorced">Divorced</option>
                    </select>
                  </label>
                  <label>
                    City
                    <input
                      className={inputClass}
                      value={profile.city}
                      onChange={(event) => updateProfile("city", event.target.value)}
                    />
                  </label>
                  <label>
                    State
                    <input
                      className={inputClass}
                      value={profile.state}
                      onChange={(event) => updateProfile("state", event.target.value)}
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      className={inputClass}
                      maxLength={12}
                      value={profile.postal_code}
                      onChange={(event) => updateProfile("postal_code", event.target.value)}
                    />
                  </label>
                  <label>
                    Address line 2
                    <input
                      className={inputClass}
                      value={profile.address_line_2}
                      onChange={(event) => updateProfile("address_line_2", event.target.value)}
                    />
                  </label>
                  <label className="form-full">
                    Country
                    <input
                      className={inputClass}
                      value={profile.country}
                      onChange={(event) => updateProfile("country", event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="panel-heading">
                  <div>
                    <h3><ClipboardList size={19} /> Plan & Proposal</h3>
                    <p>These are proposed details for your internal draft.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="form-full">
                    Plan name *
                    <input
                      className={inputClass}
                      required
                      maxLength={200}
                      value={plan.plan_name}
                      onChange={(event) => updatePlan("plan_name", event.target.value)}
                    />
                  </label>
                  <label>
                    Proposed sum assured (₹) *
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={plan.proposed_sum_assured}
                      onChange={(event) => updatePlan("proposed_sum_assured", event.target.value)}
                    />
                  </label>
                  <label>
                    Proposed premium (₹) *
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={plan.proposed_premium}
                      onChange={(event) => updatePlan("proposed_premium", event.target.value)}
                    />
                  </label>
                  <label>
                    Premium frequency *
                    <select
                      className={inputClass}
                      value={plan.premium_frequency}
                      onChange={(event) => updatePlan("premium_frequency", event.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half-yearly</option>
                      <option value="yearly">Yearly</option>
                      <option value="single">Single premium</option>
                    </select>
                  </label>
                  <label>
                    Policy term (years) *
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={plan.policy_term_years}
                      onChange={(event) => updatePlan("policy_term_years", event.target.value)}
                    />
                  </label>
                  <label>
                    Premium payment term (years) *
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={plan.premium_payment_term_years}
                      onChange={(event) => updatePlan("premium_payment_term_years", event.target.value)}
                    />
                  </label>
                  <label>
                    Proposed start date
                    <input
                      className={inputClass}
                      type="date"
                      value={plan.proposed_start_date}
                      onChange={(event) => updatePlan("proposed_start_date", event.target.value)}
                    />
                  </label>
                  <label className="form-full">
                    Notes
                    <textarea
                      className={inputClass}
                      maxLength={3000}
                      value={plan.notes}
                      onChange={(event) => updatePlan("notes", event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="panel-heading">
                  <div>
                    <h3>Nominee Details</h3>
                    <p>Nominee details are optional for this draft step.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Nominee full name
                    <input
                      className={inputClass}
                      maxLength={150}
                      value={nominee.full_name}
                      onChange={(event) => updateNominee("full_name", event.target.value)}
                    />
                  </label>
                  <label>
                    Relationship
                    <input
                      className={inputClass}
                      maxLength={100}
                      value={nominee.relationship}
                      onChange={(event) => updateNominee("relationship", event.target.value)}
                    />
                  </label>
                  <label>
                    Nominee date of birth
                    <input
                      className={inputClass}
                      type="date"
                      value={nominee.date_of_birth}
                      onChange={(event) => updateNominee("date_of_birth", event.target.value)}
                    />
                  </label>
                  <label>
                    Share percentage
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={nominee.share_percentage}
                      onChange={(event) => updateNominee("share_percentage", event.target.value)}
                    />
                  </label>
                  <label>
                    Appointee name (if applicable)
                    <input
                      className={inputClass}
                      value={nominee.appointee_name}
                      onChange={(event) => updateNominee("appointee_name", event.target.value)}
                    />
                  </label>
                  <label>
                    Appointee relationship
                    <input
                      className={inputClass}
                      value={nominee.appointee_relationship}
                      onChange={(event) => updateNominee("appointee_relationship", event.target.value)}
                    />
                  </label>
                </div>

                <div className="panel-heading" style={{ marginTop: 28 }}>
                  <div>
                    <h3>Medical Questionnaire</h3>
                    <p>
                      Record only information provided and authorized by the customer.
                      This section does not replace official proposal questions.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  {medicalQuestions.map((question) => (
                    <label className="form-full" key={question.key}>
                      {question.label}
                      <textarea
                        className={inputClass}
                        maxLength={3000}
                        value={medical[question.key] ?? ""}
                        onChange={(event) =>
                          setMedical((previous) => ({
                            ...previous,
                            [question.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="panel-heading">
                  <div>
                    <h3><FileUp size={19} /> Application Documents</h3>
                    <p>
                      Upload supporting documents for this saved application.
                      Files remain in private storage.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Document type
                    <select
                      className={inputClass}
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value)}
                    >
                      <option value="identity_proof">Identity proof</option>
                      <option value="address_proof">Address proof</option>
                      <option value="age_proof">Age proof</option>
                      <option value="photo">Photograph</option>
                      <option value="income_proof">Income proof</option>
                      <option value="medical_document">Medical document</option>
                      <option value="other">Other document</option>
                    </select>
                  </label>

                  <label>
                    Choose file (PDF, JPG, PNG; max 5 MB)
                    <input
                      id="wizard-document-file"
                      className={inputClass}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) =>
                        setSelectedDocumentFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={uploadingDocument || saving || !selectedDocumentFile}
                  onClick={() => void uploadWizardDocument()}
                >
                  <FileUp size={17} />
                  {uploadingDocument ? "Uploading..." : "Upload Document"}
                </button>

                <div style={{ marginTop: 20 }}>
                  <h4>Uploaded in this session ({uploadedDocuments.length})</h4>
                  {uploadedDocuments.length === 0 ? (
                    <p>No documents uploaded in this session. This step is optional.</p>
                  ) : (
                    <ul>
                      {uploadedDocuments.map((document, index) => (
                        <li key={`${document.name}-${index}`}>
                          <strong>{document.name}</strong>
                          {" — "}{document.type.replace(/_/g, " ")}
                          {" — "}{(document.size / 1024).toFixed(1)} KB
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="subtitle" style={{ marginTop: 16 }}>
                  You can also manage and download uploaded documents from
                  Policy Applications. Uploaded files are not submitted to LIC
                  automatically.
                </p>
              </>
            )}

            {step === 4 && (
              <>
                <div className="panel-heading">
                  <div>
                    <h3><CheckCircle2 size={19} /> Review Application Draft</h3>
                    <p>Review your information before finishing.</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div>
                    <strong>Customer</strong>
                    <p>{newCustomer ? customerName : selectedCustomer?.full_name ?? "Selected customer"}</p>
                    <p>{newCustomer ? phone : selectedCustomer?.phone ?? ""}</p>
                  </div>
                  <div>
                    <strong>Internal reference</strong>
                    <p>{applicationNumber || "Draft saved"}</p>
                  </div>
                  <div>
                    <strong>Plan</strong>
                    <p>{plan.plan_name}</p>
                  </div>
                  <div>
                    <strong>Sum assured</strong>
                    <p>₹{Number(plan.proposed_sum_assured || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <strong>Proposed premium</strong>
                    <p>₹{Number(plan.proposed_premium || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <strong>Frequency</strong>
                    <p>{plan.premium_frequency.replace("_", " ")}</p>
                  </div>
                  <div>
                    <strong>Nominee</strong>
                    <p>{nominee.full_name || "Not entered"}</p>
                  </div>
                  <div>
                    <strong>Medical answers</strong>
                    <p>{medicalQuestions.filter((question) => (medical[question.key] ?? "").trim()).length} of {medicalQuestions.length} filled</p>
                  </div>
                </div>

                <div className="success-message" style={{ marginTop: 20 }}>
                  This application is saved as a draft. It has not been officially
                  submitted to LIC, and no verification, payment or policy issuance
                  has been performed.
                </div>
              </>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
                marginTop: 28,
              }}
            >
              <button
                type="button"
                className="secondary-button"
                disabled={saving || step === 0}
                onClick={() => {
                  clearNotice();
                  setStep((previous) => Math.max(0, previous - 1));
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>

              {step < 4 ? (
                <button type="submit" className="primary-button" disabled={saving || loading}>
                  <Save size={17} />
                  {saving ? "Saving..." : "Save & Continue"}
                  {!saving && <ArrowRight size={16} />}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving}
                  onClick={() => {
                    setFinished(true);
                    clearNotice();
                  }}
                >
                  <CheckCircle2 size={17} /> Finish Draft
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}





