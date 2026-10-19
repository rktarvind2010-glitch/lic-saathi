
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import {
  ClipboardList,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";

type Application = {
  id: string;
  customer_id: string;
  plan_name: string | null;
  application_number: string | null;
  application_status: string;
  customers: { full_name: string } | null;
};

type MedicalAnswer = {
  question_key: string;
  question_label: string;
  answer: string;
};

const questions = [
  {
    key: "health_history",
    label:
      "Has the applicant ever been diagnosed with a medical condition?",
  },
  {
    key: "hospitalization",
    label:
      "Has the applicant ever been admitted to a hospital or undergone surgery?",
  },
  {
    key: "current_treatment",
    label:
      "Is the applicant currently taking prescribed medication or receiving treatment?",
  },
  {
    key: "tobacco_alcohol",
    label:
      "Does the applicant use tobacco or consume alcohol?",
  },
  {
    key: "family_history",
    label:
      "Is there any relevant family medical history to disclose?",
  },
  {
    key: "additional_information",
    label:
      "Is there any other health information the applicant needs to disclose?",
  },
];

export default function MedicalQuestionnaire() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadApplications() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("policy_applications")
      .select(
        "id, customer_id, plan_name, application_number, application_status, customers(full_name)"
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setApplications([]);
    } else {
      const records = (data ?? []) as unknown as Application[];
      setApplications(records);

      if (selectedId && !records.some((item) => item.id === selectedId)) {
        setSelectedId("");
        setAnswers({});
      }
    }

    setLoading(false);
  }

  async function loadAnswers(applicationId: string) {
    setError("");
    setMessage("");
    setAnswers({});

    if (!applicationId) return;

    const { data, error: loadError } = await supabase
      .from("application_medical_answers")
      .select("question_key, question_label, answer")
      .eq("application_id", applicationId);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const saved: Record<string, string> = {};

    for (const item of (data ?? []) as MedicalAnswer[]) {
      saved[item.question_key] = item.answer;
    }

    setAnswers(saved);
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  function selectApplication(id: string) {
    setSelectedId(id);
    void loadAnswers(id);
  }

  function updateAnswer(key: string, value: string) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
    setMessage("");
  }

  async function saveAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedId) {
      setError("Please select a policy application first.");
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const records = questions
      .filter((question) => (answers[question.key] ?? "").trim() !== "")
      .map((question) => ({
        agent_id: authData.user.id,
        application_id: selectedId,
        question_key: question.key,
        question_label: question.label,
        answer: answers[question.key].trim(),
        updated_at: new Date().toISOString(),
      }));

    setSaving(true);

    try {
      if (records.length > 0) {
        const { error: saveError } = await supabase
          .from("application_medical_answers")
          .upsert(records, {
            onConflict: "application_id,question_key",
          });

        if (saveError) {
          setError(saveError.message);
          return;
        }
      }

      const { data: savedRows, error: verifyError } = await supabase
        .from("application_medical_answers")
        .select("question_key")
        .eq("application_id", selectedId);

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      const savedKeys = new Set(
        (savedRows ?? []).map((item) => item.question_key)
      );

      const clearedKeys = questions
        .filter(
          (question) =>
            !((answers[question.key] ?? "").trim()) &&
            savedKeys.has(question.key)
        )
        .map((question) => question.key);

      if (clearedKeys.length > 0) {
        const { error: deleteError } = await supabase
          .from("application_medical_answers")
          .delete()
          .eq("application_id", selectedId)
          .in("question_key", clearedKeys);

        if (deleteError) {
          setError(deleteError.message);
          return;
        }
      }

      setMessage("Medical questionnaire saved successfully.");
    } finally {
      setSaving(false);
    }
  }

  const visibleApplications = applications.filter((application) => {
    const query = search.trim().toLowerCase();
    const customerName = application.customers?.full_name ?? "";

    return (
      customerName.toLowerCase().includes(query) ||
      (application.plan_name ?? "").toLowerCase().includes(query) ||
      (application.application_number ?? "").toLowerCase().includes(query)
    );
  });

  const selectedApplication = applications.find(
    (application) => application.id === selectedId
  );

  return (
    <section className="customer-master policy-applications">
      <div className="welcome-row">
        <div>
          <h2>Medical Questionnaire</h2>
          <p>
            Record and manage applicant-provided medical disclosures for each
            policy application.
          </p>
        </div>
        <div className="panel">
          <ShieldCheck size={24} />
          <span>Private agent records</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <ClipboardList size={20} />
          <h3>Select Policy Application</h3>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadApplications()}
            disabled={loading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <label htmlFor="medical-search">Search applications</label>
        <div className="form-input" style={{ display: "flex", gap: 8 }}>
          <Search size={18} />
          <input
            id="medical-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, plan or application number"
            style={{
              border: 0,
              outline: 0,
              background: "transparent",
              width: "100%",
            }}
          />
        </div>

        <label htmlFor="medical-application">Policy application</label>
        <select
          id="medical-application"
          className="form-input"
          value={selectedId}
          onChange={(event) => selectApplication(event.target.value)}
        >
          <option value="">Select an application</option>
          {visibleApplications.map((application) => (
            <option key={application.id} value={application.id}>
              {(application.customers?.full_name ?? "Unknown customer") +
                " — " +
                (application.plan_name ?? "Plan not specified") +
                (application.application_number
                  ? " — " + application.application_number
                  : "")}
            </option>
          ))}
        </select>

        {loading && <p>Loading applications...</p>}

        {!loading && applications.length === 0 && (
          <p>No policy applications found. Create an application first.</p>
        )}

        {selectedApplication && (
          <p>
            Status: <strong>{selectedApplication.application_status}</strong>
          </p>
        )}
      </div>

      {selectedId && (
        <form className="panel" onSubmit={saveAnswers}>
          <div className="panel-heading">
            <ClipboardList size={20} />
            <h3>Applicant Health Disclosures</h3>
          </div>

          <p>
            Enter answers based on the applicant's own disclosures and the
            insurer's official requirements. These questions are a general
            recordkeeping aid, not an official LIC medical questionnaire.
          </p>

          {questions.map((question) => (
            <div
              className="form-full"
              key={question.key}
              style={{ marginBottom: 20 }}
            >
              <label htmlFor={question.key}>{question.label}</label>
              <textarea
                id={question.key}
                className="form-input"
                rows={3}
                value={answers[question.key] ?? ""}
                onChange={(event) =>
                  updateAnswer(question.key, event.target.value)
                }
                placeholder="Enter the applicant's answer, or leave blank if not answered"
              />
            </div>
          ))}

          {message && <p className="success-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save Medical Answers"}
          </button>
        </form>
      )}

      {error && !selectedId && (
        <p className="error-message">{error}</p>
      )}
    </section>
  );
}
