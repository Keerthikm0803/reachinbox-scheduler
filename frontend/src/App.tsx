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

  const [recipients, setRecipients] = useState<string[]>([
    "keerthikm0803@gmail.com",
  ]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [delayBetweenEmails, setDelayBetweenEmails] =
    useState("2000");

  const [hourlyLimit, setHourlyLimit] = useState("200");

  const [senderId, setSenderId] = useState(
    "cmsyixamd0002u64wv75fkjsq"
  );

  const [fileName, setFileName] = useState("");
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
      console.error(
        "Authentication check error:",
        error
      );
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

      const data: EmailResponse =
        await response.json();

      setStats(data.stats);
      setEmails(data.emails);
    } catch (error) {
      console.error(
        "Fetch emails error:",
        error
      );
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

    const interval = setInterval(
      fetchEmails,
      3000
    );

    return () => clearInterval(interval);
  }, [user]);

  /*
   * Extract email addresses from CSV/TXT content.
   * This works whether the file contains:
   *
   * email
   * john@gmail.com
   * jane@gmail.com
   *
   * or:
   *
   * name,email
   * John,john@gmail.com
   * Jane,jane@gmail.com
   */
  function extractEmails(text: string) {
    const emailRegex =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const matches =
      text.match(emailRegex) || [];

    return Array.from(
      new Set(
        matches.map((email) =>
          email.trim().toLowerCase()
        )
      )
    );
  }

  async function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");

    const allowedTypes = [
      "text/csv",
      "text/plain",
      "application/vnd.ms-excel",
    ];

    const extension =
      file.name.split(".").pop()?.toLowerCase();

    if (
      !allowedTypes.includes(file.type) &&
      extension !== "csv" &&
      extension !== "txt"
    ) {
      setMessage(
        "Please upload a CSV or TXT file."
      );
      return;
    }

    try {
      const text = await file.text();

      const detectedEmails =
        extractEmails(text);

      setFileName(file.name);
      setRecipients(detectedEmails);

      if (detectedEmails.length === 0) {
        setMessage(
          "No valid email addresses were found."
        );
        return;
      }

      setMessage(
        `${detectedEmails.length} email address${
          detectedEmails.length === 1
            ? ""
            : "es"
        } detected successfully.`
      );
    } catch (error) {
      console.error(
        "File reading error:",
        error
      );

      setMessage(
        "Failed to read the uploaded file."
      );
    }
  }

  function removeRecipient(email: string) {
    setRecipients((current) =>
      current.filter(
        (item) => item !== email
      )
    );
  }

  async function scheduleEmail() {
    setMessage("");

    if (recipients.length === 0) {
      setMessage(
        "Please upload a CSV/TXT file containing email addresses."
      );
      return;
    }

    if (!subject || !body || !scheduledAt) {
      setMessage(
        "Please fill all required fields."
      );
      return;
    }

    const selectedDate =
      new Date(scheduledAt);

    if (
      selectedDate.getTime() <= Date.now()
    ) {
      setMessage(
        "Please select a future date and time."
      );
      return;
    }

    const delay =
      Number(delayBetweenEmails);

    const limit = Number(hourlyLimit);

    if (
      !Number.isFinite(delay) ||
      delay < 0
    ) {
      setMessage(
        "Please enter a valid delay."
      );
      return;
    }

    if (
      !Number.isFinite(limit) ||
      limit <= 0
    ) {
      setMessage(
        "Please enter a valid hourly limit."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * Schedule each recipient separately.
       *
       * The backend already creates one persistent
       * BullMQ delayed job for every email.
       */
      let successful = 0;

      for (
        let index = 0;
        index < recipients.length;
        index++
      ) {
        const recipient =
          recipients[index];

        /*
         * Add the requested delay between emails
         * to their scheduled start time.
         *
         * The Redis rate limiter in the worker
         * remains the final protection.
         */
        const recipientScheduledTime =
          new Date(
            selectedDate.getTime() +
              index * delay
          );

        /*
         * Respect the configured hourly limit
         * when creating the schedule.
         *
         * Example:
         * 200 emails/hour
         *
         * After 200 emails, the next batch
         * starts in the following hour.
         */
        const hourNumber =
          Math.floor(index / limit);

        const hourlyOffset =
          hourNumber * 60 * 60 * 1000;

        const finalScheduledTime =
          new Date(
            recipientScheduledTime.getTime() +
              hourlyOffset
          );

        const response = await fetch(
          `${API_URL}/api/emails/schedule`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              recipient,
              subject,
              body,
              scheduledAt:
                finalScheduledTime.toISOString(),
              senderId,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Failed to schedule ${recipient}`
          );
        }

        successful++;
      }

      setMessage(
        `${successful} email${
          successful === 1 ? "" : "s"
        } scheduled successfully!`
      );

      setRecipients([]);

      setFileName("");

      setSubject("");

      setBody("");

      setScheduledAt("");

      await fetchEmails();
    } catch (error) {
      console.error(
        "Schedule emails error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while scheduling emails."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    return new Date(
      date
    ).toLocaleString();
  }

  if (checkingAuth) {
    return (
      <div className="app">
        <div className="empty-state">
          <h2>
            Loading ReachInbox Scheduler...
          </h2>
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
              <div
                style={{ width: "100%" }}
              >
                <h1>
                  ReachInbox Scheduler
                </h1>

                <p>
                  Sign in to access your
                  email scheduling
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
                Secure authentication
                powered by Google
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
          <h1>
            ReachInbox Scheduler
          </h1>

          <p>
            Email scheduling dashboard
          </p>
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
            <strong>
              {user.name}
            </strong>

            <br />

            <small>
              {user.email}
            </small>
          </div>

          <button
            onClick={logout}
          >
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
            <span>
              Total Emails
            </span>

            <strong>
              {stats.total}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Scheduled
            </span>

            <strong>
              {stats.scheduled}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Sent
            </span>

            <strong>
              {stats.sent}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Failed
            </span>

            <strong>
              {stats.failed}
            </strong>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2>
                Schedule New Emails
              </h2>

              <p>
                Upload your leads and
                schedule email delivery.
              </p>
            </div>
          </div>

          <div className="form">
            <label>
              Upload CSV / TXT File

              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={
                  handleFileUpload
                }
              />
            </label>

            {fileName && (
              <div className="message">
                File:{" "}
                <strong>
                  {fileName}
                </strong>
              </div>
            )}

            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background:
                  "#f4f4f5",
                marginBottom: "15px",
              }}
            >
              <strong>
                Detected email addresses:
              </strong>{" "}
              {recipients.length}
            </div>

            {recipients.length > 0 && (
              <div
                style={{
                  marginBottom: "15px",
                }}
              >
                <strong>
                  Recipients
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    flexWrap:
                      "wrap",
                    gap: "8px",
                  }}
                >
                  {recipients.map(
                    (email) => (
                      <span
                        key={email}
                        style={{
                          padding:
                            "6px 10px",
                          border:
                            "1px solid #ddd",
                          borderRadius:
                            "20px",
                          fontSize:
                            "13px",
                        }}
                      >
                        {email}

                        <button
                          type="button"
                          onClick={() =>
                            removeRecipient(
                              email
                            )
                          }
                          style={{
                            marginLeft:
                              "6px",
                            border:
                              "none",
                            background:
                              "transparent",
                            cursor:
                              "pointer",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            <label>
              Subject

              <input
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
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
                  setBody(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Start Time

              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) =>
                  setScheduledAt(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Delay Between Emails
              <small>
                Minimum delay in
                milliseconds.
              </small>

              <input
                type="number"
                min="0"
                value={
                  delayBetweenEmails
                }
                onChange={(e) =>
                  setDelayBetweenEmails(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Emails Per Hour

              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) =>
                  setHourlyLimit(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Sender ID

              <input
                type="text"
                value={senderId}
                onChange={(e) =>
                  setSenderId(
                    e.target.value
                  )
                }
              />
            </label>

            <button
              onClick={
                scheduleEmail
              }
              disabled={loading}
            >
              {loading
                ? "Scheduling..."
                : `Schedule ${recipients.length} Email${
                    recipients.length ===
                    1
                      ? ""
                      : "s"
                  }`}
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
              <h2>
                Recent Email Jobs
              </h2>

              <p>
                Your latest scheduled
                email activity.
              </p>
            </div>
          </div>

          {fetching ? (
            <div className="empty-state">
              <h3>
                Loading emails...
              </h3>
            </div>
          ) : emails.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ✉
              </div>

              <h3>
                No email jobs yet
              </h3>

              <p>
                Upload a CSV and
                schedule your first
                email campaign.
              </p>
            </div>
          ) : (
            <div className="email-list">
              {emails.map(
                (email) => (
                  <div
                    className="email-item"
                    key={email.id}
                  >
                    <div className="email-main">
                      <div className="email-top">
                        <strong>
                          {email.subject}
                        </strong>

                        <span
                          className={`status ${email.status.toLowerCase()}`}
                        >
                          {email.status}
                        </span>
                      </div>

                      <p>
                        <strong>
                          To:
                        </strong>{" "}
                        {email.recipient}
                      </p>

                      <p className="email-body">
                        {email.body}
                      </p>

                      <small>
                        Scheduled:{" "}
                        {formatDate(
                          email.scheduledAt
                        )}
                      </small>

                      {email.sentAt && (
                        <small>
                          {" "}
                          • Sent:{" "}
                          {formatDate(
                            email.sentAt
                          )}
                        </small>
                      )}

                      {email.error && (
                        <p className="error-text">
                          Error:{" "}
                          {email.error}
                        </p>
                      )}

                      {email.previewUrl && (
                        <p>
                          <a
                            href={
                              email.previewUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Email
                            Preview
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;