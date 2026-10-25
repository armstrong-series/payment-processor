import { useEffect, useState } from "react";
import "./style.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "cancelled";

type Payment = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  description?: string;
  paymentMethod: "card" | "bank_transfer" | "mobile_money";
  status: PaymentStatus;
  checkoutUrl?: string;
};

type TestCard = {
  id: string;
  brand: string;
  number: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  outcome: "succeeded" | "failed";
};

type CheckoutDetails = {
  payment: Payment;
  testCards: TestCard[];
};

type ApiResponse<T> = {
  message?: string;
  status?: string;
  data: T;
  error?: {
    code?: string;
    details?: Array<{
      field?: string;
      message?: string;
    }>;
  };
};

function getPaymentId(): string | null {
  const segments = window.location.pathname.split("/").filter(Boolean);

  if (segments.length !== 2 || segments[0] !== "checkout" || !segments[1]) {
    return null;
  }

  try {
    return decodeURIComponent(segments[1]).trim() || null;
  } catch {
    return null;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const rawBody = await response.text();

  let result: ApiResponse<T> | null = null;

  if (rawBody) {
    try {
      result = JSON.parse(rawBody) as ApiResponse<T>;
    } catch {
      throw new Error(
        `The server returned a non-JSON response (HTTP ${response.status}). Check the API URL and server logs.`
      );
    }
  }

  if (!response.ok) {
    const validationDetails = result?.error?.details
      ?.map((detail) =>
        detail.field
          ? `${detail.field}: ${detail.message ?? "Invalid value"}`
          : detail.message
      )
      .filter(Boolean)
      .join("; ");

    throw new Error(
      validationDetails ||
        result?.message ||
        `Request failed with HTTP ${response.status} at ${path}.`
    );
  }

  if (!result) {
    throw new Error("The API returned an empty response.");
  }

  return result;
}

function getPaymentFromResult(data: Payment | { payment: Payment }): Payment {
  return "payment" in data ? data.payment : data;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function CheckoutApp() {
  const paymentId = getPaymentId();

  const [details, setDetails] = useState<CheckoutDetails | null>(null);
  const [email, setEmail] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [testCardId, setTestCardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!paymentId) {
      return;
    }

    const validPaymentId = paymentId;
    const controller = new AbortController();

    async function loadCheckout() {
      try {
        const response = await apiRequest<CheckoutDetails>(
          `/api/v1/checkout/${encodeURIComponent(validPaymentId)}`,
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        const checkout = response.data;

        if (!checkout?.payment) {
          throw new Error(
            "The API response does not contain payment information."
          );
        }

        setDetails(checkout);

        const firstCard = checkout.testCards?.[0];

        if (firstCard) {
          setTestCardId(firstCard.id);
        }

        setError("");
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Unable to load this checkout."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCheckout();

    return () => controller.abort();
  }, [paymentId]);

  async function copyCard(card: TestCard) {
    setCardNumber(card.number);
    setExpiry(
      `${String(card.expiryMonth).padStart(2, "0")}/${String(
        card.expiryYear
      ).slice(-2)}`
    );
    setTestCardId(card.id);
    setMessage(`${card.brand} test card selected.`);
    setError("");

    try {
      await navigator.clipboard.writeText(card.number);
    } catch {
      // Clipboard access is optional; the card is still selected.
    }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paymentId || !details) {
      setError("Payment information is unavailable.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest<Payment | { payment: Payment }>(
        `/api/v1/checkout/${encodeURIComponent(paymentId)}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            email,
            cardholderName,
            cardNumber: cardNumber.replace(/[\s-]/g, ""),
            expiry,
            cvv,
            testCardId,
          }),
        }
      );

      const updatedPayment = getPaymentFromResult(response.data);

      setDetails((current) =>
        current ? { ...current, payment: updatedPayment } : current
      );

      setMessage(response.message ?? "Payment processed.");
      setCvv("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment could not be processed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelPayment() {
    if (!paymentId || !details) {
      setError("Payment information is unavailable.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest<Payment | { payment: Payment }>(
        `/api/v1/checkout/${encodeURIComponent(paymentId)}/cancel`,
        { method: "POST" }
      );

      const updatedPayment = getPaymentFromResult(response.data);

      setDetails((current) =>
        current ? { ...current, payment: updatedPayment } : current
      );

      setMessage(response.message ?? "Payment canceled.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to cancel payment."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAlternativePayment() {
    if (!paymentId || !details) {
      setError("Payment information is unavailable.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest<Payment | { payment: Payment }>(
        `/api/v1/checkout/${encodeURIComponent(paymentId)}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      const updatedPayment = getPaymentFromResult(response.data);

      setDetails((current) =>
        current ? { ...current, payment: updatedPayment } : current
      );

      setMessage(response.message ?? "Payment processed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment could not be processed."
      );
    } finally {
      setBusy(false);
    }
  }

  // Derived validation: no state update is required in an effect.
  if (!paymentId) {
    return (
      <main className="checkout-shell">
        <p className="alert">
          Invalid checkout URL. Open the checkout link generated for a payment.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="checkout-shell">
        <p>Loading secure checkout…</p>
      </main>
    );
  }

  if (error && !details) {
    return (
      <main className="checkout-shell">
        <section className="checkout-card">
          <p className="alert" role="alert">
            {error}
          </p>
          <p className="muted">
            API endpoint: {API_BASE_URL}/api/v1/checkout/{paymentId}
          </p>
        </section>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="checkout-shell">
        <p className="alert">Checkout data was not returned by the API.</p>
      </main>
    );
  }

  const { payment, testCards = [] } = details;

  const terminal = ["succeeded", "failed", "canceled", "cancelled"].includes(
    payment.status
  );

  return (
    <main className="checkout-shell">
      <header className="brand">
        <div className="brand-mark">A</div>
        <div>
          <strong>Ataraxia Checkout</strong>
          <p>Test payment environment</p>
        </div>
        <span className="secure-label">Test mode</span>
      </header>

      <section className="checkout-card">
        <div className="order-summary">
          <p className="eyebrow">ORDER SUMMARY</p>

          <h1>{formatAmount(payment.amount, payment.currency)}</h1>

          <p>{payment.description || "Payment"}</p>

          <div className="order-meta">
            <span>Order reference</span>
            <code>{payment.orderId}</code>
          </div>

          <div className="order-meta">
            <span>Checkout URL</span>
            {payment.checkoutUrl ? (
              <a
                href={payment.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open checkout
              </a>
            ) : (
              <span>Not provided by API</span>
            )}
          </div>

          <div className="order-meta">
            <span>Payment status</span>
            <strong className={`status status-${payment.status}`}>
              {payment.status}
            </strong>
          </div>
        </div>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}

        {payment.paymentMethod === "card" && !terminal && (
          <form onSubmit={submitPayment} className="payment-form">
            <h2>Card details</h2>
            <p className="muted">
              Use one of the seeded test cards below. Do not enter real card
              details.
            </p>

            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
              />
            </label>

            <label>
              Cardholder name
              <input
                required
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                placeholder="Name on card"
              />
            </label>

            <label>
              Card number
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={cardNumber}
                onChange={(event) => {
                  setCardNumber(event.target.value);
                  setTestCardId("");
                }}
                placeholder="Enter test card number"
              />
            </label>

            <div className="form-row">
              <label>
                Expiry date
                <input
                  required
                  autoComplete="off"
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  placeholder="MM/YY"
                />
              </label>

              <label>
                CVV
                <input
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={cvv}
                  onChange={(event) => setCvv(event.target.value)}
                  placeholder="Test CVV"
                  maxLength={4}
                />
              </label>
            </div>

            <div className="test-cards">
              <h3>Seeded test cards</h3>

              {testCards.map((card) => (
                <div className="test-card" key={card.id}>
                  <div>
                    <strong>{card.brand}</strong>
                    <code>•••• •••• •••• {card.last4}</code>
                    <span className="muted">Simulates {card.outcome}</span>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void copyCard(card)}
                  >
                    Select card
                  </button>
                </div>
              ))}

              {testCards.length === 0 && (
                <p className="muted">No test cards are available.</p>
              )}
            </div>

            <button className="primary-button" disabled={busy} type="submit">
              {busy
                ? "Processing…"
                : `Pay ${formatAmount(payment.amount, payment.currency)}`}
            </button>
          </form>
        )}

        {payment.paymentMethod !== "card" && !terminal && (
          <div className="payment-form">
            <h2>Payment method</h2>
            <p>
              {payment.paymentMethod === "bank_transfer"
                ? "Simulated bank transfer"
                : "Simulated mobile money"}
            </p>

            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
              />
            </label>

            <button
              className="primary-button"
              disabled={busy || !email.trim()}
              onClick={() => void submitAlternativePayment()}
            >
              {busy ? "Processing…" : "Continue"}
            </button>
          </div>
        )}

        {terminal && (
          <div className="result-panel">
            <h2>
              {payment.status === "succeeded"
                ? "Payment successful"
                : payment.status === "failed"
                ? "Payment failed"
                : "Payment canceled"}
            </h2>
            <p>Final status: {payment.status}</p>
          </div>
        )}

        {!terminal && (
          <button
            className="cancel-button"
            type="button"
            disabled={busy}
            onClick={() => void cancelPayment()}
          >
            Cancel payment
          </button>
        )}
      </section>

      <footer>Demo checkout · No real money is charged</footer>
    </main>
  );
}

export default function App() {
  return <CheckoutApp />;
}
