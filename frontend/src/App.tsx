import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: "SCHEDULED" | "SENT" | "FAILED";
  error: string | null;
  previewUrl: string | null;
}

interface EmailResponse {
  stats: {
    total: number;
    scheduled: number;
    sent: number;
    failed: number;
  };
  emails: Email[];
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [recipient, setRecipient] = useState(
    "keerthikm0803@gmail.com"
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [senderId, setSenderId] = useState(
    "cmsyixamd0002u64wv75fkjsq"
  );

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    sent: 0,
    failed: 0,
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [fetching, setFetching] = useState(true);

  async function checkAuth() {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/me`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Authentication check error:", error);
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async function fetchEmails() {
    try {
      const response = await fetch(
        `${API_URL}/api/emails`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data: EmailResponse = await response.json();

      setStats(data.stats);
      setEmails(data.emails);
    } catch (error) {
      console.error("Fetch emails error:", error);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchEmails();

    const interval = setInterval(fetchEmails, 3000);

    return () => clearInterval(interval);
  }, [user]);

  async function scheduleEmail() {
    setMessage("");

    if (!recipient || !subject || !body || !scheduledAt) {
      setMessage("Please fill all fields.");
      return;
    }

    const selectedDate = new Date(scheduledAt);

    if (selectedDate.getTime() <= Date.now()) {
      setMessage("Please select a future date and time.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/emails/schedule`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient,
            subject,
            body,
            scheduledAt: selectedDate.toISOString(),
            senderId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to schedule email"
        );
      }

      setMessage("Email scheduled successfully!");

      setRecipient("keerthikm0803@gmail.com");
      setSubject("");
      setBody("");
      setScheduledAt("");

      await fetchEmails();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  if (checkingAuth) {
    return (
      <div className="app">
        <div className="empty-state">
          <h2>Loading ReachInbox Scheduler...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <main
          className="dashboard"
          style={{
            maxWidth: "500px",
            margin: "100px auto",
          }}
        >
          <section className="card">
            <div
              className="card-header"
              style={{
                textAlign: "center",
              }}
            >
              <div style={{ width: "100%" }}>
                <h1>ReachInbox Scheduler</h1>

                <p>
                  Sign in to access your email scheduling
                  dashboard.
                </p>
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                padding: "30px 10px",
              }}
            >
              <button
                onClick={() => {
                  window.location.href =
                    `${API_URL}/api/auth/google`;
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue with Google
              </button>

              <p
                style={{
                  marginTop: "18px",
                  fontSize: "13px",
                  opacity: 0.7,
                }}
              >
                Secure authentication powered by Google
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>ReachInbox Scheduler</h1>
          <p>Email scheduling dashboard</p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
              }}
            />
          )}

          <div>
            <strong>{user.name}</strong>
            <br />
            <small>{user.email}</small>
          </div>

          <button onClick={logout}>
            Logout
          </button>

          <div className="server-status">
            <span></span>
            Backend Connected
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="stats">
          <div className="stat-card">
            <span>Total Emails</span>
            <strong>{stats.total}</strong>
          </div>

          <div className="stat-card">
            <span>Scheduled</span>
            <strong>{stats.scheduled}</strong>
          </div>

          <div className="stat-card">
            <span>Sent</span>
            <strong>{stats.sent}</strong>
          </div>

          <div className="stat-card">
            <span>Failed</span>
            <strong>{stats.failed}</strong>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>Schedule an Email</h2>
              <p>Create a new scheduled email job.</p>
            </div>
          </div>

          <div className="form">
            <label>
              Recipient

              <small className="testing-note">
                For the deployed demo, please use{" "}
                <strong>
                  keerthikm0803@gmail.com
                </strong>
                .
                <br />
                Resend's testing environment currently
                restricts email delivery to the account
                owner's email.
              </small>

              <input
                type="email"
                placeholder="keerthikm0803@gmail.com"
                value={recipient}
                onChange={(e) =>
                  setRecipient(e.target.value)
                }
              />
            </label>

            <label>
              Subject
              <input
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
              />
            </label>

            <label>
              Message
              <textarea
                placeholder="Write your email..."
                rows={6}
                value={body}
                onChange={(e) =>
                  setBody(e.target.value)
                }
              />
            </label>

            <label>
              Scheduled Time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) =>
                  setScheduledAt(e.target.value)
                }
              />
            </label>

            <label>
              Sender ID
              <input
                type="text"
                value={senderId}
                onChange={(e) =>
                  setSenderId(e.target.value)
                }
              />
            </label>

            <button
              onClick={scheduleEmail}
              disabled={loading}
            >
              {loading
                ? "Scheduling..."
                : "Schedule Email"}
            </button>

            {message && (
              <div className="message">
                {message}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>Recent Email Jobs</h2>
              <p>
                Your latest scheduled email activity.
              </p>
            </div>
          </div>

          {fetching ? (
            <div className="empty-state">
              <h3>Loading emails...</h3>
            </div>
          ) : emails.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✉</div>
              <h3>No email jobs yet</h3>
              <p>
                Schedule your first email using the
                form above.
              </p>
            </div>
          ) : (
            <div className="email-list">
              {emails.map((email) => (
                <div
                  className="email-item"
                  key={email.id}
                >
                  <div className="email-main">
                    <div className="email-top">
                      <strong>{email.subject}</strong>

                      <span
                        className={`status ${email.status.toLowerCase()}`}
                      >
                        {email.status}
                      </span>
                    </div>

                    <p>
                      <strong>To:</strong>{" "}
                      {email.recipient}
                    </p>

                    <p className="email-body">
                      {email.body}
                    </p>

                    <small>
                      Scheduled:{" "}
                      {formatDate(email.scheduledAt)}
                    </small>

                    {email.sentAt && (
                      <small>
                        {" "}
                        • Sent:{" "}
                        {formatDate(email.sentAt)}
                      </small>
                    )}

                    {email.error && (
                      <p className="error-text">
                        Error: {email.error}
                      </p>
                    )}

                    {email.previewUrl && (
                      <p>
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Email Preview
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;