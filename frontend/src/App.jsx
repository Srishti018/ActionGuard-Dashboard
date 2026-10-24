
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:8081";

const SEVERITIES = [
  { key: "CRITICAL", label: "Critical", color: "#ff4058" },
  { key: "HIGH", label: "High", color: "#ffb33f" },
  { key: "MEDIUM", label: "Medium", color: "#a8e05f" },
  { key: "LOW", label: "Low", color: "#369dff" },
];

function normalizeSeverity(value) {
  const severity = String(value ?? "INFO").toUpperCase();
  if (severity.includes("CRIT")) return "CRITICAL";
  if (severity.includes("HIGH")) return "HIGH";
  if (severity.includes("MED")) return "MEDIUM";
  if (severity.includes("LOW")) return "LOW";
  return "INFO";
}

function normalizeFinding(finding, index) {
  const severity = normalizeSeverity(
    finding.severity ?? finding.level ?? finding.risk
  );

  return {
    id: finding.id ?? finding.finding_id ?? `${severity}-${index}`,
    severity,
    name:
      finding.name ??
      finding.title ??
      finding.rule_name ??
      finding.rule ??
      "Security finding",
    reference:
      finding.reference ??
      finding.file ??
      finding.path ??
      finding.workflow ??
      finding.location ??
      "Workflow file",
    details:
      finding.details ??
      finding.message ??
      finding.description ??
      finding.recommendation ??
      "Review this workflow configuration.",
    line: finding.line ?? finding.line_number ?? null,
  };
}

function Icon({ name, size = 18 }) {
  const paths = {
    dashboard: "M3 3h7v7H3z M14 3h7v4h-7z M14 10h7v11h-7z M3 13h7v8H3z",
    repository: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z M4 4.5v16",
    findings: "m12 3 9 16H3z M12 9v4 M12 16h.01",
    search: "m20 20-4.5-4.5 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z M9 12l2 2 4-4",
    external: "M7 17 17 7 M7 7h10v10",
    filter: "M4 5h16l-6 7v5l-4 2v-7z",
    refresh: "M20 7v5h-5 M4 17v-5h5 M5.5 9A7 7 0 0 1 18 6l2 6 M4 12l2 6a7 7 0 0 0 12.5-3",
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.shield} />
    </svg>
  );
}

function MetricCard({ severity, count, active, onClick }) {
  const item = SEVERITIES.find((s) => s.key === severity);

  return (
    <button
      type="button"
      className={`severity-card ${active ? "selected" : ""}`}
      style={{ "--severity": item.color }}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="severity-card-top">
        <span className="severity-symbol">
          {severity === "CRITICAL"
            ? "✳"
            : severity === "HIGH"
              ? "▲"
              : severity === "MEDIUM"
                ? "◆"
                : "↗"}
        </span>
        <span className="severity-card-label">{item.label}</span>
        <span className="severity-card-arrow">↗</span>
      </div>
      <div className="severity-card-count">{count}</div>
      <div className="severity-card-bottom">
        <span className="severity-dot" />
        <span>
          {severity === "CRITICAL"
            ? "Urgent attention"
            : severity === "HIGH"
              ? "Prioritize fixes"
              : severity === "MEDIUM"
                ? "Review findings"
                : "Lower-priority items"}
        </span>
      </div>
    </button>
  );
}

function DonutChart({ counts, total }) {
  const segments = [
    ...SEVERITIES,
    { key: "INFO", label: "Info", color: "#a16bff" },
  ].map((item) => ({
    ...item,
    value: counts[item.key] ?? 0,
  }));

  let running = 0;
  const gradient = total
    ? segments
        .map((item) => {
          const start = (running / total) * 100;
          running += item.value;
          const end = (running / total) * 100;
          return `${item.color} ${start}% ${end}%`;
        })
        .join(", ")
    : "#292538 0% 100%";

  return (
    <section className="chart-panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">BREAKDOWN</p>
          <h2>Severity distribution</h2>
        </div>
        <span className="panel-kicker">ALL FINDINGS</span>
      </div>

      <div className="chart-content">
        <div
          className="donut-chart"
          style={{ "--donut-gradient": `conic-gradient(${gradient})` }}
          role="img"
          aria-label={`Severity distribution across ${total} findings`}
        >
          <div className="donut-hole">
            <strong>{total}</strong>
            <span>findings</span>
          </div>
        </div>

        <div className="chart-legend">
          {segments.map((item) => (
            <div className="legend-row" key={item.key}>
              <span
                className="legend-dot"
                style={{ background: item.color }}
              />
              <span className="legend-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [findings, setFindings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    fetch(`${API_URL}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json().catch(() => ({}));
      })
      .then(() => alive && setHealth("online"))
      .catch(() => alive && setHealth("offline"));

    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const result = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    findings.forEach((finding) => {
      result[finding.severity] = (result[finding.severity] ?? 0) + 1;
    });

    return result;
  }, [findings]);

  const filteredFindings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return findings
      .filter((finding) => filter === "ALL" || finding.severity === filter)
      .filter((finding) => {
        if (!query) return true;
        return [
          finding.name,
          finding.reference,
          finding.details,
          finding.severity,
        ].some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const order = {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
          INFO: 4,
        };
        return order[a.severity] - order[b.severity];
      });
  }, [findings, filter, search]);

  async function handleScan(event) {
    event.preventDefault();

    const url = repoUrl.trim();
    if (!url) {
      setError("Enter a public GitHub repository URL first.");
      return;
    }

    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url)) {
      setError("Use a repository URL like https://github.com/owner/repository");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setHasScanned(false);
    setFilter("ALL");
    setSearch("");

    try {
      const response = await fetch(`${API_URL}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url }),
      });

      const report = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          report.message ??
            report.error ??
            `Scan failed (${response.status}). Check the backend logs.`
        );
      }

      if (!Array.isArray(report.findings)) {
        throw new Error("The scan response did not contain a findings array.");
      }

      const normalized = report.findings.map(normalizeFinding);
      setFindings(normalized);
      setSummary(report.summary ?? null);
      setHasScanned(true);
      setNotice(
        `Scan complete · ${normalized.length} finding${normalized.length === 1 ? "" : "s"}`
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not complete the scan. Make sure the backend is running on port 8081."
      );
    } finally {
      setLoading(false);
    }
  }

  const total = findings.length;
  const repoName = repoUrl.trim().replace(/\/+$/, "").split("/").slice(-1)[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="ActionGuard overview">
          <span className="brand-mark">
            <Icon name="shield" size={23} />
          </span>
          <span className="brand-copy">
            <strong>ActionGuard</strong>
            <small>Workflow security</small>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#overview">
            <Icon name="dashboard" />
            <span>Dashboard</span>
          </a>
          <a className="nav-link" href="#scanner">
            <Icon name="repository" />
            <span>Repository scanner</span>
          </a>
          <a className="nav-link" href="#findings">
            <Icon name="findings" />
            <span>Security findings</span>
            <span className="nav-count">{total}</span>
          </a>
        </nav>

        <div className="sidebar-callout">
          <span className="callout-icon">
            <Icon name="shield" size={20} />
          </span>
          <strong>Protect your pipeline</strong>
          <p>Catch risky GitHub Actions configurations before deployment.</p>
          <a href="#scanner">
            Start a scan <span>↗</span>
          </a>
        </div>

        <div className="sidebar-bottom">
          <div className="api-status">
            <span className={`status-dot ${health}`} />
            <span>
              {health === "checking"
                ? "Checking scanner API"
                : health === "online"
                  ? "Scanner API online"
                  : "Scanner API offline"}
            </span>
          </div>
          <div className="sidebar-version">
            <span>ACTIONGUARD</span>
            <span>v1.1.0</span>
          </div>
        </div>
      </aside>

      <main className="main-area" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>Dashboard</strong>
          </div>
          <div className="topbar-right">
            <span className={`system-pill ${health}`}>
              <span className={`status-dot ${health}`} />
              {health === "online"
                ? "System operational"
                : health === "checking"
                  ? "Connecting"
                  : "API unavailable"}
            </span>
            <span className="avatar">AG</span>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="section-tag">
                <span /> SUPPLY CHAIN SECURITY
              </div>
              <h1>Security dashboard<span>.</span></h1>
              <p>
                Scan GitHub Actions workflows and find risky configurations.
              </p>
            </div>
            <div className="scan-status-card">
              <span className="scan-status-icon">
                <Icon name="shield" size={21} />
              </span>
              <div>
                <span>SCAN STATUS</span>
                <strong>
                  {loading
                    ? "Scanning repository"
                    : hasScanned
                      ? "Scan completed"
                      : "Ready to scan"}
                </strong>
              </div>
            </div>
          </section>

          <section className="repository-panel" id="scanner">
            <div className="repository-panel-heading">
              <div className="repository-icon">
                <Icon name="repository" size={21} />
              </div>
              <div className="repository-heading-copy">
                <h2>Repositories</h2>
                <p>Analyze a public GitHub repository for workflow risks.</p>
              </div>
              <span className="github-label">
                <span /> GITHUB ACTIONS
              </span>
            </div>

            <form className="scan-form" onSubmit={handleScan}>
              <label className="repo-input-wrap">
                <Icon name="external" size={17} />
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repository"
                  aria-label="GitHub repository URL"
                  required
                />
              </label>
              <button className="scan-button" type="submit" disabled={loading}>
                {loading ? "Scanning..." : "Run security scan"}
                {!loading && <Icon name="external" size={16} />}
              </button>
            </form>

            <div className="repository-panel-footer">
              <span>
                <span className={`status-dot ${health}`} />
                {health === "online" ? "Scanner ready" : "Scanner connection"}
              </span>
              <span>HTTPS <i /> Read-only scan</span>
            </div>

            {error && (
              <div className="feedback-message error-message" role="alert">
                {error}
              </div>
            )}
            {notice && !error && (
              <div className="feedback-message success-message" role="status">
                {notice}
              </div>
            )}
          </section>

          <section className="security-section" aria-labelledby="posture-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR SECURITY POSTURE</p>
                <h2 id="posture-title">Severity overview</h2>
              </div>
              <span className="result-count">
                {hasScanned ? `${total} FINDINGS` : "AWAITING SCAN"}
              </span>
            </div>

            <div className="overview-grid">
              <div className="severity-grid">
                {SEVERITIES.map((item) => (
                  <MetricCard
                    key={item.key}
                    severity={item.key}
                    count={counts[item.key]}
                    active={filter === item.key}
                    onClick={() =>
                      setFilter(filter === item.key ? "ALL" : item.key)
                    }
                  />
                ))}
              </div>
              <DonutChart counts={counts} total={total} />
            </div>
          </section>

          <section className="findings-panel" id="findings">
            <div className="findings-heading">
              <div>
                <p className="eyebrow">SCAN RESULTS</p>
                <h2>Repository findings</h2>
                <p className="findings-subtitle">
                  {hasScanned
                    ? `${repoName || "Repository"} · ${total} finding${total === 1 ? "" : "s"}`
                    : "Your workflow findings will appear here after a scan."}
                </p>
              </div>
              {hasScanned && (
                <button
                  type="button"
                  className="reset-filter"
                  onClick={() => {
                    setFilter("ALL");
                    setSearch("");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>

            <div className="table-toolbar">
              <div className="table-filter">
                <Icon name="filter" size={16} />
                <select
                  aria-label="Filter by severity"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="ALL">All severities</option>
                  {SEVERITIES.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                  <option value="INFO">Info</option>
                </select>
              </div>
              <label className="findings-search">
                <Icon name="search" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search findings..."
                  aria-label="Search findings"
                />
              </label>
            </div>

            <div className="table-scroll">
              <table className="findings-table">
                <thead>
                  <tr>
                    <th>SEVERITY</th>
                    <th>FINDING</th>
                    <th>WORKFLOW / LOCATION</th>
                    <th>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((finding) => (
                    <tr key={finding.id}>
                      <td>
                        <span
                          className={`severity-badge ${finding.severity.toLowerCase()}`}
                        >
                          <span />
                          {finding.severity}
                        </span>
                      </td>
                      <td>
                        <strong className="finding-name">{finding.name}</strong>
                        {finding.line != null && (
                          <span className="finding-line">
                            Line {finding.line}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="workflow-location">
                          {finding.reference}
                        </span>
                      </td>
                      <td>
                        <span className="finding-details">
                          {finding.details}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredFindings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        <span className="empty-icon">
                          <Icon name="search" size={22} />
                        </span>
                        <strong>
                          {hasScanned
                            ? "No matching findings"
                            : "No scan results yet"}
                        </strong>
                        <span>
                          {hasScanned
                            ? "Try another severity or search term."
                            : "Enter a GitHub repository above to start scanning."}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="findings-footer">
              <span>
                Showing <strong>{filteredFindings.length}</strong> of{" "}
                <strong>{total}</strong> findings
              </span>
              <span>Sorted by severity</span>
            </footer>
          </section>

          <footer className="page-footer">
            <span>ActionGuard <i /> Workflow supply-chain security</span>
            <span>Scan results reflect the repository at scan time.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
