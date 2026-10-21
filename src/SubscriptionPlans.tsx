import { useEffect, useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "./lib/supabase";
import QRCode from "qrcode";

const SUBSCRIPTION_UPI_ID = "8953852625@upi";
const SUBSCRIPTION_PAYEE_NAME = "LIC Saathi";

function createUpiPaymentLink(amount: number, planName: string) {
  const params = new URLSearchParams({
    pa: SUBSCRIPTION_UPI_ID,
    pn: SUBSCRIPTION_PAYEE_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `LIC Saathi ${planName} subscription`,
  });

  return `upi://pay?${params.toString()}`;
}
const plans = [
  {
    name: "Starter",
    price: 99,
    description: "Individual agents ke liye shuruaat",
    features: [
      "Customer records",
      "Policy management",
      "Basic premium reminders",
    ],
  },
  {
    name: "Standard",
    price: 199,
    description: "Daily insurance work ko manage karein",
    features: [
      "Starter ke sabhi features",
      "Application tracking",
      "Commission tracking",
      "Advanced reports",
      "CSV data export",
    ],
    popular: true,
  },
  {
    name: "Premium",
    price: 299,
    description: "Advanced tools ke saath",
    features: [
      "Standard ke sabhi features",
      "Customer-wise history",
      "Advanced collection reports",
      "WhatsApp reminder tools",
      "Priority feature access",
    ],
  },
] as const;

type Plan = (typeof plans)[number];

type Subscription = {
  id: string;
  plan_name: string;
  monthly_price: number;
  status: string;
  created_at: string;
};

export default function SubscriptionPlans() {
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [utrReference, setUtrReference] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error" | "info">("info");

  // Generate QR for the selected subscription plan
  useEffect(() => {
    let cancelled = false;

    async function generatePaymentQr() {
      if (
        subscription?.status !== "pending" ||
        !subscription.monthly_price ||
        !subscription.plan_name
      ) {
        setUpiQrDataUrl("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(
          createUpiPaymentLink(
            subscription.monthly_price,
            subscription.plan_name
          ),
          {
            errorCorrectionLevel: "M",
            margin: 3,
            width: 240,
          }
        );

        if (!cancelled) setUpiQrDataUrl(dataUrl);
      } catch (error) {
        console.error("Unable to generate UPI QR:", error);
        if (!cancelled) setUpiQrDataUrl("");
      }
    }

    void generatePaymentQr();

    return () => {
      cancelled = true;
    };
  }, [
    subscription?.status,
    subscription?.monthly_price,
    subscription?.plan_name,
  ]);
  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      setLoading(true);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {
          throw new Error("Please log in to select a subscription plan.");
        }

        const { data, error } = await supabase
          .from("agent_subscriptions")
          .select("id, plan_name, monthly_price, status, created_at")
          .eq("agent_id", authData.user.id)
          .maybeSingle();

        if (error) throw error;

        if (mounted) {
          setSubscription(data as Subscription | null);
        }
      } catch (error) {
        if (mounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Subscription load nahi ho saka."
          );
          setMessageType("error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  async function choosePlan(plan: Plan) {
    setMessage("");
    setSavingPlan(plan.name);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        throw new Error("Plan select karne ke liye pehle login karein.");
      }

      // Read the latest subscription before attempting a change.
      const { data: existing, error: readError } = await supabase
        .from("agent_subscriptions")
        .select("id, plan_name, monthly_price, status, created_at")
        .eq("agent_id", user.id)
        .maybeSingle();

      if (readError) throw readError;

      if (existing && existing.status !== "pending") {
        throw new Error(
          "Is account par subscription record pehle se hai. Plan change ke liye secure billing flow banana hoga."
        );
      }

      const { data, error } = await supabase
        .from("agent_subscriptions")
        .upsert(
          {
            agent_id: user.id,
            plan_name: plan.name,
            monthly_price: plan.price,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agent_id" }
        )
        .select("id, plan_name, monthly_price, status, created_at")
        .single();

      if (error) throw error;

      setSubscription(data as Subscription);
      setMessage(
        `${plan.name} plan request save ho gayi. Payment abhi nahi hua hai.`
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Plan save nahi ho saka. Dobara try karein."
      );
      setMessageType("error");
    } finally {
      setSavingPlan(null);
    }
  }

  async function submitPaymentRequest() {
    setMessage("");
    setSubmittingPayment(true);

    try {
      const selectedPlan = plans.find(
        (plan) => plan.name === subscription?.plan_name
      );

      if (!selectedPlan || subscription?.status !== "pending") {
        throw new Error("Pehle plan select karke save karein.");
      }

      const utr = utrReference.trim();

      if (!/^[A-Za-z0-9-]{6,40}$/.test(utr)) {
        throw new Error(
          "UTR mandatory hai. Valid reference number (6–40 characters) enter karein."
        );
      }

      if (
        !paymentDate ||
        paymentDate > new Date().toLocaleDateString("en-CA")
      ) {
        throw new Error("Valid payment date select karein.");
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const maxFileSize = 5 * 1024 * 1024;

      if (paymentScreenshot) {
        if (!allowedTypes.includes(paymentScreenshot.type)) {
          throw new Error("Screenshot JPG, PNG ya WebP format mein hona chahiye.");
        }

        if (paymentScreenshot.size > maxFileSize) {
          throw new Error("Screenshot ka maximum size 5 MB hai.");
        }
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Pehle login karein.");

      let screenshotPath: string | null = null;

      if (paymentScreenshot) {
        const safeName = paymentScreenshot.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        screenshotPath =
          `${authData.user.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("subscription-payment-proofs")
          .upload(screenshotPath, paymentScreenshot, {
            contentType: paymentScreenshot.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
      }

      const { error } = await supabase
        .from("subscription_payment_requests")
        .insert({
          agent_id: authData.user.id,
          plan_name: selectedPlan.name,
          amount: selectedPlan.price,
          utr_reference: utr,
          payment_date: paymentDate,
          screenshot_path: screenshotPath,
          status: "pending",
        });

      if (error) throw error;

      setMessage(
        "Payment request submit ho gayi. Verification pending hai; subscription abhi active nahi hui."
      );
      setMessageType("success");
      setUtrReference("");
      setPaymentScreenshot(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment request submit nahi ho saki."
      );
      setMessageType("error");
    } finally {
      setSubmittingPayment(false);
    }
  }
    return (
    <div className="subscription-page">
      <div className="subscription-heading">
        <div>
          <p className="eyebrow">LIC SAATHI MEMBERSHIP</p>
          <h1>Choose Your Plan</h1>
          <p className="subtitle">
            Apne insurance business ke hisaab se suitable plan chunein.
          </p>
        </div>
        <div className="subscription-heading-icon">
          <Sparkles size={25} />
        </div>
      </div>

      <div className="subscription-notice">
        <CreditCard size={19} />
        <span>
          Plan select karne par request save hogi. Abhi koi payment charge
          nahi hoga.
        </span>
      </div>

      {loading ? (
        <p>Subscription details load ho rahi hain...</p>
      ) : (
        <>
          {subscription && (
            <section className="subscription-selection">
              <div>
                <strong>
                  Saved plan: {subscription.plan_name} — ₹
                  {subscription.monthly_price}/month
                </strong>
                <p>
                  Status: {subscription.status}. Pending ka matlab payment
                  verify nahi hua hai; paid access activate nahi hai.
                </p>
              </div>
            </section>
          )}

          {subscription?.status === "pending" && (
            <section className="subscription-payment-form">
              <h2>Complete Your Payment</h2>
              <p>Selected plan: <strong>{subscription.plan_name}</strong></p>
              <p className="subscription-payment-amount">
                Amount to pay: ₹{subscription.monthly_price}/month
              </p>

              <div className="subscription-qr-wrap">
                {upiQrDataUrl ? (
                  <img
                    src={upiQrDataUrl}
                    alt={`UPI payment QR for ${subscription.plan_name}`}
                    className="subscription-qr-image"
                    width={240}
                    height={240}
                  />
                ) : (
                  <p>Payment QR generate ho raha hai...</p>
                )}
                <p>UPI ID: <strong>{SUBSCRIPTION_UPI_ID}</strong></p>
                <p>
                  Amount: <strong>₹{subscription.monthly_price}</strong>
                </p>
                <a
                  className="subscription-button subscription-button-primary"
                  href={createUpiPaymentLink(
                    subscription.monthly_price,
                    subscription.plan_name
                  )}
                >
                  Open UPI App to Pay ₹{subscription.monthly_price}
                </a>
                <p>
                  UPI app mein payee aur amount check karke payment khud confirm karein.
                </p>
              </div>

              <label className="subscription-field">
                UTR / Transaction Reference Number
                <input
                  type="text"
                  value={utrReference}
                  onChange={(event) => setUtrReference(event.target.value)}
                  placeholder="Enter UTR/reference number"
                  minLength={6}
                  maxLength={40}
                  required
                />
              </label>

              <label className="subscription-field">
                Payment Screenshot (Optional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setPaymentScreenshot(event.target.files?.[0] ?? null)
                  }
                />
                <small>Optional - JPG, PNG, WebP - Maximum 5 MB</small>
              </label>

              <label className="subscription-field">
                Payment Date
                <input
                  type="date"
                  value={paymentDate}
                  max={new Date().toLocaleDateString("en-CA")}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  required
                />
              </label>

              <button
                type="button"
                className="subscription-button subscription-button-primary"
                disabled={submittingPayment || loading}
                onClick={() => void submitPaymentRequest()}
              >
                {submittingPayment ? "Submitting..." : "Submit Payment for Verification"}
              </button>

              <p className="subscription-payment-note">
                Request submit karne se payment verify nahi hota. Verification
                complete hone tak subscription pending rahegi.
              </p>
            </section>
          )}
          <div className="subscription-grid">
            {plans.map((plan) => (
              <article
                className={`subscription-card ${
                  "popular" in plan && plan.popular ? "subscription-popular" : ""
                }`}
                key={plan.name}
              >
                {"popular" in plan && plan.popular && (
                  <span className="subscription-popular-label">
                    RECOMMENDED
                  </span>
                )}

                <h2>{plan.name}</h2>
                <p className="subscription-description">
                  {plan.description}
                </p>

                <div className="subscription-price">
                  <span className="subscription-rupee">₹</span>
                  <span className="subscription-amount">{plan.price}</span>
                  <span className="subscription-period">/ month</span>
                </div>

                <div className="subscription-divider" />

                <p className="subscription-feature-title">Plan includes</p>
                <ul className="subscription-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={17} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`subscription-button ${
                    "popular" in plan && plan.popular ? "subscription-button-primary" : ""
                  }`}
                  disabled={savingPlan !== null || loading}
                  onClick={() => void choosePlan(plan)}
                >
                  {savingPlan === plan.name
                    ? "Saving..."
                    : subscription?.plan_name === plan.name
                      ? "Selected Plan"
                      : `Choose ${plan.name}`}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {message && (
        <div
          className="subscription-selection"
          role="status"
          style={{
            borderColor: messageType === "error" ? "#e8b7b7" : "#dce6f8",
          }}
        >
          <div>
            <strong>
              {messageType === "error"
                ? "Something went wrong"
                : messageType === "success"
                  ? "Plan request saved"
                  : "Subscription"}
            </strong>
            <p>{message}</p>
          </div>
          <button type="button" onClick={() => setMessage("")}>
            Dismiss
          </button>
        </div>
      )}

      <p className="subscription-footer">
        Proposed prices only. Selecting a plan does not complete payment or
        activate paid features. Actual activation requires verified payment.
      </p>
    </div>
  );
}






