import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";

// chart pieces from the recharts toolbox
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// animation building blocks (see primitives.jsx)
import {
  AnimatedNumber,
  ScrambleText,
  SplitText,
  Magnetic,
  Tilt,
  Flashlight,
  MagnifierCursor,
  TextLoop,
  Marquee,
  Reveal,
  Stamp,
  SlidingTabs,
  ScrollProgress,
  Accordion,
  Modal,
} from "./primitives";

const API_URL = "http://localhost:5000/analyze"; // address of our Flask server
const WINDOW_DAYS = 7; // days compared before and after the drop

const STATUS_LINES = [
  "Reading the evidence...",
  "Dusting for fingerprints...",
  "Finding the scene of the drop...",
  "Questioning every segment...",
  "Cross-checking alibis...",
];

const COLUMNS = ["date", "region", "category", "revenue"];

const FAQ = [
  {
    q: "What does my Excel file need?",
    a: "One sheet, one header row, and four columns named date, region, category and revenue. Dates must be real dates, revenue must be numbers, and only .xlsx files work.",
  },
  {
    q: "How does it find the drop?",
    a: "For every day it compares the average of the 7 days before with the average of the 5 days from that day on. The day with the biggest lasting fall is the scene of the drop, so one bad day cannot fool it. Drops smaller than about 2% of total sales are ignored.",
  },
  {
    q: "What do High, Medium and Low mean?",
    a: "They describe a segment's share of the total drop. High is 50% or more, Medium is 20% or more, and Low is anything below 20%.",
  },
  {
    q: "Does this prove why sales fell?",
    a: "No. It shows where the change happened and which segments contributed most. Finding the real-world reason still needs a human investigation.",
  },
  {
    q: "Is my file saved anywhere?",
    a: "The app reads your file only to run the analysis and does not store it.",
  },
];

// makes numbers easier to read, e.g. 84025.4 becomes 84,025.4
function fmt(n) {
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

// turns a file name into a fake case number, e.g. WD-4821
function caseNo(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return "WD-" + (1000 + h);
}

// "Jaipur -> Vegetables" becomes "JV"
function initials(segment) {
  return segment
    .split(" -> ")
    .map((s) => s.trim()[0])
    .join("")
    .toUpperCase();
}

// builds a CSV file from the ranked causes and downloads it
function downloadCsv(result) {
  const header = ["segment", "before", "after", "change", "change_pct", "share_pct", "impact"];
  const rows = result.causes.map((c) =>
    [JSON.stringify(c.segment), c.before, c.after, c.change, c.change_pct, c.share_pct, c.impact].join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "whydrop_case_file.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// the small box that appears when you hover over the chart
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tip type">
      <div className="tip-date">{label}</div>
      <div className="tip-val display">{fmt(payload[0].value)}</div>
    </div>
  );
}

// one line of the tape that scrolls across the page
function TapeText({ words }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="tape-item display">
          {w} <i>✕</i>
        </span>
      ))}
    </>
  );
}

function App() {
  // the page's memory: each value and the function that changes it
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [analyzedAt, setAnalyzedAt] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState("area");
  const [replay, setReplay] = useState(0);
  const [toast, setToast] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("whydrop-theme") || "day";
    } catch {
      return "day";
    }
  });

  const inputRef = useRef(null);
  const toastTimer = useRef(null);

  const found = result && result.drop_found;

  // whenever the theme changes, tell the page so the CSS colors switch, and remember the choice
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("whydrop-theme", theme);
    } catch {
      /* storage not available, ignore */
    }
  }, [theme]);

  // the browser tab title follows what is on screen
  useEffect(() => {
    document.title = found
      ? "Case " + caseNo(fileName) + " | WhyDrop"
      : "WhyDrop | Find out why your numbers dropped";
  }, [found, fileName]);

  // show the back-to-top button after scrolling down a bit
  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 500);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // left and right arrow keys move between suspects
  useEffect(() => {
    if (!found) return;
    function onKey(e) {
      if (e.key === "ArrowRight") setSelected((s) => Math.min(s + 1, result.causes.length - 1));
      if (e.key === "ArrowLeft") setSelected((s) => Math.max(s - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [found, result]);

  // shows a small message at the bottom left for a few seconds
  function showToast(kind, text) {
    clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  // sends the chosen file to Flask and stores the answer
  async function analyzeFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are accepted as evidence.");
      setResult(null);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setFileName(file.name);
    setLoading(true);
    setError("");
    setResult(null);
    setSelected(0);

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data);
        setAnalyzedAt(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
        showToast("ok", data.drop_found ? "Evidence accepted. Case file ready." : "Evidence accepted. No drop detected.");
      }
    } catch {
      setError("Could not reach the server. Is Flask running on port 5000?");
    } finally {
      setLoading(false);
    }
  }

  // runs when a file is chosen with the browse dialog
  function handleInputChange(e) {
    const file = e.target.files[0];
    e.target.value = "";
    analyzeFile(file);
  }

  // runs when a file is dropped onto the evidence tray
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    analyzeFile(e.dataTransfer.files[0]);
  }

  // goes back to the upload screen
  function reset() {
    setResult(null);
    setError("");
    setFileName("");
    setSelected(0);
    setView("area");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // asks first when there is a finished case on screen
  function requestReset() {
    if (result) setConfirmOpen(true);
    else reset();
  }

  // copies a one-line summary of the case to the clipboard
  function copySummary() {
    const text =
      "WhyDrop case " +
      caseNo(fileName) +
      ": " +
      result.causes[0].segment +
      " is the prime suspect (" +
      result.causes[0].share_pct +
      "% of the drop). Sales fell " +
      Math.abs(result.total_change_pct) +
      "% starting " +
      result.drop_date +
      ".";
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast("ok", "Summary copied to clipboard."))
        .catch(() => showToast("err", "Copy failed."));
    } else {
      showToast("err", "Copy is not supported in this browser.");
    }
  }

  // ---------- numbers for the chart windows ----------
  let beforeStart = null;
  let beforeEnd = null;
  let afterEnd = null;
  let barData = [];
  if (found) {
    const dates = result.daily.map((d) => d.date);
    const idx = dates.indexOf(result.drop_date);
    if (idx > 0) {
      beforeStart = dates[Math.max(0, idx - WINDOW_DAYS)];
      beforeEnd = dates[idx - 1];
      afterEnd = dates[Math.min(dates.length - 1, idx + WINDOW_DAYS - 1)];
    }
    barData = result.daily.map((d) => {
      let tone = "other";
      if (afterEnd && d.date >= result.drop_date && d.date <= afterEnd) tone = "after";
      else if (beforeStart && d.date >= beforeStart && d.date <= beforeEnd) tone = "before";
      return { ...d, tone };
    });
  }

  const top = found && result.causes.length ? result.causes[0] : null; // the prime suspect
  const picked = top ? result.causes[Math.min(selected, result.causes.length - 1)] : null; // the suspect you clicked

  // the plain-English note for the picked suspect
  let noteText = "";
  if (picked) {
    const level =
      picked.impact === "High" ? "Strong lead." : picked.impact === "Medium" ? "Worth a closer look." : "Minor contributor.";
    noteText =
      picked.segment +
      " went from " +
      fmt(picked.before) +
      " to " +
      fmt(picked.after) +
      " (" +
      picked.change_pct +
      "%), losing " +
      fmt(Math.abs(picked.change)) +
      ". That is " +
      picked.share_pct +
      "% of the total drop of " +
      fmt(Math.abs(result.total_change)) +
      ". " +
      level;
  }

  const stats = top
    ? [
        { label: "Scene of the drop", tone: "yellow", node: <span className="display stat-val">{result.drop_date}</span> },
        {
          label: "Total change",
          tone: "red",
          node: <AnimatedNumber value={result.total_change_pct} suffix="%" className="display stat-val" />,
        },
        {
          label: "Before (" + WINDOW_DAYS + " days)",
          tone: "cyan",
          node: <AnimatedNumber value={result.before_total} decimals={0} className="display stat-val" />,
        },
        {
          label: "After (" + WINDOW_DAYS + " days)",
          tone: "paper",
          node: <AnimatedNumber value={result.after_total} decimals={0} className="display stat-val" />,
        },
      ]
    : [];

  const tilts = [-1.6, 1.2, -1, 1.7];

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip type" href="#main">
        Skip to content
      </a>
      <ScrollProgress />
      <MagnifierCursor />

      {/* ---------- top bar ---------- */}
      <header className="topbar">
        <button type="button" className="brand" data-hot onClick={requestReset} aria-label="WhyDrop home">
          <motion.span className="logo" whileHover={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 0.5 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 9 12 13 8 21 17" />
              <polyline points="15 17 21 17 21 11" />
            </svg>
          </motion.span>
          <span className="brand-text">
            <span className="brand-name display">
              Why<b>?</b>Drop
            </span>
            <span className="brand-tag type">KPI case file system</span>
          </span>
        </button>
        <div className="top-actions">
          <Magnetic>
            <button type="button" className="btn" data-hot onClick={() => setTheme(theme === "day" ? "night" : "day")}>
              {theme === "day" ? "Night shift" : "Day shift"}
            </button>
          </Magnetic>
          {result && (
            <Magnetic>
              <button type="button" className="btn btn-red" data-hot onClick={requestReset}>
                New case
              </button>
            </Magnetic>
          )}
        </div>
      </header>

      {/* ---------- crossing tape ---------- */}
      <div className="tapes" aria-hidden="true">
        <div className="tape tape-yellow">
          <Marquee speed={34}>
            <TapeText words={["KPI drop", "Do not cross", "Evidence", "Follow the numbers", "KPI drop", "Do not cross"]} />
          </Marquee>
        </div>
        <div className="tape tape-red">
          <Marquee speed={40} reverse>
            <TapeText words={["Case open", "Who did it", "Suspects", "Case open", "Who did it", "Suspects"]} />
          </Marquee>
        </div>
      </div>

      <main className="container" id="main" tabIndex={-1}>
        {/* hidden real file input, used by the evidence tray */}
        <input ref={inputRef} type="file" accept=".xlsx" onChange={handleInputChange} hidden />

        <AnimatePresence>
          {error && (
            <motion.div
              className="error type"
              role="alert"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: [0, -10, 10, -6, 6, 0] }}
              exit={{ opacity: 0 }}
            >
              <b className="display">Evidence rejected:</b> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- landing / upload ---------- */}
        {!result && !loading && (
          <>
            <Flashlight className="hero">
              <div className="deco-ring" aria-hidden="true" />
              <div className="deco-note type" aria-hidden="true">
                the average
                <br />
                is lying to you.
              </div>

              <motion.div className="case-tag type" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                CASE FILE / STATUS: OPEN
              </motion.div>
              <h1 className="hero-title display">
                <SplitText text="Something dropped." />
                <br />
                <span className="hl">
                  <SplitText text="Find who did it." delay={0.6} />
                </span>
              </h1>
              <motion.p className="hero-sub type" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
                Hand over an Excel sheet. WhyDrop finds the day your numbers fell, then questions every region and
                category until one stands out.
              </motion.p>
            </Flashlight>

            <motion.div
              className={"tray" + (dragging ? " over" : "")}
              data-hot
              role="button"
              tabIndex={0}
              aria-label="Upload an Excel file"
              onClick={() => inputRef.current.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              animate={dragging ? { scale: 1.03, rotate: -1.2 } : { scale: 1, rotate: 0 }}
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <div className="tray-tape" />
              <motion.div className="tray-icon" animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </motion.div>
              <div className="tray-title display">{dragging ? "Drop it. We're ready." : "Insert evidence"}</div>
              <div className="tray-sub type">Drag an .xlsx file here, or click to browse</div>
              <div className="tags">
                {COLUMNS.map((c, i) => (
                  <span key={c} className="tag type" style={{ transform: "rotate(" + [-3, 2, -1.5, 3][i] + "deg)" }}>
                    {c}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className="procedure">
              {[
                ["01", "Find the scene", "Scans the daily total for the largest lasting fall, so one bad day can't fool it."],
                ["02", "Compare timelines", "Sets the 7 days before the drop against the 7 days after it."],
                ["03", "Question suspects", "Splits the change across every region and category combination."],
                ["04", "Name the prime suspect", "Ranks segments by their share of the drop and ignores tiny, noisy ones."],
              ].map(([n, title, text], i) => (
                <Reveal key={n} delay={i * 0.08}>
                  <Tilt className="step card" style={{ rotate: tilts[i] }}>
                    <div className="step-num display">{n}</div>
                    <h4 className="display">{title}</h4>
                    <p className="type">{text}</p>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </>
        )}

        {/* ---------- loading ---------- */}
        {loading && (
          <motion.div className="card loading" role="status" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div
              className="lens"
              animate={{ x: [-70, 70, -70], y: [0, -20, 0], rotate: [-14, 14, -14] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="6.5" />
                <line x1="15" y1="15" x2="21" y2="21" />
              </svg>
            </motion.div>
            <div className="display load-title">Investigating {fileName}</div>
            <TextLoop items={STATUS_LINES} className="type status" />
            <div className="bar">
              <motion.div className="bar-fill" animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }} />
            </div>
          </motion.div>
        )}

        {/* ---------- no drop found ---------- */}
        {result && !found && (
          <motion.div className="card loading" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <div className="display load-title">Case closed: no drop detected</div>
            <p className="type status">{result.message}</p>
          </motion.div>
        )}

        {/* ---------- the case file ---------- */}
        {found && top && picked && (
          <>
            <div className="print-only type">
              WhyDrop case file {caseNo(fileName)} / {fileName} / analyzed {analyzedAt}
            </div>

            <Reveal>
              <div className="card casebar">
                <div>
                  <div className="type small">CASE #{caseNo(fileName)}</div>
                  <div className="display case-name">{fileName}</div>
                  <div className="type small">
                    {result.daily.length} days of evidence / analyzed {analyzedAt}
                  </div>
                </div>
                <div className="actions">
                  <Magnetic>
                    <button type="button" className="btn btn-sm" data-hot onClick={copySummary}>
                      Copy summary
                    </button>
                  </Magnetic>
                  <Magnetic>
                    <button type="button" className="btn btn-sm" data-hot onClick={() => downloadCsv(result)}>
                      Export CSV
                    </button>
                  </Magnetic>
                  <Magnetic>
                    <button type="button" className="btn btn-sm" data-hot onClick={() => window.print()}>
                      Print
                    </button>
                  </Magnetic>
                </div>
              </div>
            </Reveal>

            {/* prime suspect */}
            <Reveal>
              <section className="verdict">
                <div className="mug">
                  <div className="mug-frame">
                    <span className="display">{initials(top.segment)}</span>
                  </div>
                  <div className="type small">SUSPECT #1</div>
                </div>
                <div className="verdict-body">
                  <div className="type small">PRIME SUSPECT</div>
                  <h2 className="display verdict-name">
                    <ScrambleText text={top.segment} />
                  </h2>
                  <div className="verdict-share">
                    <AnimatedNumber value={top.share_pct} suffix="%" className="display big" />
                    <span className="type"> of the whole drop</span>
                  </div>
                  <div className="meter">
                    <motion.div
                      className="meter-fill"
                      initial={{ width: 0 }}
                      animate={{ width: Math.min(100, Math.max(0, top.share_pct)) + "%" }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    />
                  </div>
                  <p className="type">
                    Sales fell {Math.abs(result.total_change_pct)}% starting {result.drop_date}. This segment alone
                    accounts for {fmt(Math.abs(top.change))} of the {fmt(Math.abs(result.total_change))} lost.
                  </p>
                </div>
                <Stamp>Prime suspect</Stamp>
              </section>
            </Reveal>

            {/* stat notes */}
            <div className="stats">
              {stats.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.08}>
                  <Tilt className={"note note-" + s.tone} style={{ rotate: tilts[i] }}>
                    <div className="type small">{s.label}</div>
                    {s.node}
                  </Tilt>
                </Reveal>
              ))}
            </div>

            {/* timeline */}
            <Reveal>
              <section className="card timeline">
                <div className="card-head">
                  <div>
                    <h3 className="display h3">The timeline</h3>
                    <p className="type small">Hover the evidence. Cyan is the before window, red is the after window.</p>
                  </div>
                  <div className="head-actions">
                    <SlidingTabs
                      id="view"
                      value={view}
                      onChange={(v) => {
                        setView(v);
                        setReplay((r) => r + 1);
                      }}
                      options={[
                        { value: "area", label: "Area" },
                        { value: "line", label: "Line" },
                        { value: "bars", label: "Bars" },
                      ]}
                    />
                    <button type="button" className="btn btn-sm" data-hot onClick={() => setReplay((r) => r + 1)}>
                      Replay
                    </button>
                  </div>
                </div>

                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    {view === "area" ? (
                      <AreaChart key={"a" + replay} data={result.daily} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="inkFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--ink)", stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: "var(--ink)", stopOpacity: 0 }} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--grid)" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="date" minTickGap={44} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--ink)", strokeWidth: 2 }} />
                        <YAxis domain={["auto", "auto"]} width={56} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--ink)", strokeWidth: 2 }} />
                        {beforeStart && <ReferenceArea x1={beforeStart} x2={beforeEnd} fill="#17b6c7" fillOpacity={0.22} />}
                        {beforeStart && <ReferenceArea x1={result.drop_date} x2={afterEnd} fill="#e5252a" fillOpacity={0.2} />}
                        <ReferenceLine x={result.drop_date} stroke="#e5252a" strokeWidth={3} strokeDasharray="6 4" label={{ value: "SCENE", fill: "#e5252a", fontSize: 12, position: "top" }} />
                        <Area type="monotone" dataKey="value" stroke="var(--ink)" strokeWidth={3} fill="url(#inkFill)" />
                      </AreaChart>
                    ) : view === "line" ? (
                      <LineChart key={"l" + replay} data={result.daily} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--grid)" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="date" minTickGap={44} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--ink)", strokeWidth: 2 }} />
                        <YAxis domain={["auto", "auto"]} width={56} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--ink)", strokeWidth: 2 }} />
                        {beforeStart && <ReferenceArea x1={beforeStart} x2={beforeEnd} fill="#17b6c7" fillOpacity={0.22} />}
                        {beforeStart && <ReferenceArea x1={result.drop_date} x2={afterEnd} fill="#e5252a" fillOpacity={0.2} />}
                        <ReferenceLine x={result.drop_date} stroke="#e5252a" strokeWidth={3} strokeDasharray="6 4" label={{ value: "SCENE", fill: "#e5252a", fontSize: 12, position: "top" }} />
                        <Line type="monotone" dataKey="value" stroke="var(--ink)" strokeWidth={3} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart key={"b" + replay} data={barData} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--grid)" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="date" minTickGap={44} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--ink)", strokeWidth: 2 }} />
                        <YAxis domain={["auto", "auto"]} width={56} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--grid)" }} />
                        <Bar dataKey="value">
                          {barData.map((d, i) => (
                            <Cell key={i} fill={d.tone === "after" ? "#e5252a" : d.tone === "before" ? "#17b6c7" : "var(--ink)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </section>
            </Reveal>

            {/* suspect lineup */}
            <Reveal>
              <section className="section">
                <div className="section-head">
                  <h3 className="display h3">Suspect lineup</h3>
                  <p className="type small">Click a card, or use the left and right arrow keys.</p>
                </div>

                <div className="lineup">
                  {result.causes.map((c, i) => (
                    <Tilt
                      key={c.segment}
                      className={"suspect" + (i === selected ? " on" : "")}
                      role="button"
                      tabIndex={0}
                      aria-pressed={i === selected}
                      data-hot
                      onClick={() => setSelected(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(i);
                        }
                      }}
                    >
                      <div className="suspect-top">
                        <span className="display rank">#{i + 1}</span>
                        <span className={"tag-impact type impact-" + c.impact}>{c.impact}</span>
                      </div>
                      <div className="mug-sm display">{initials(c.segment)}</div>
                      <div className="suspect-name display">{c.segment}</div>
                      <div className="display suspect-share">
                        <AnimatedNumber value={c.share_pct} suffix="%" />
                      </div>
                      <div className="mini-meter">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: Math.min(100, Math.max(0, c.share_pct)) + "%" }}
                          transition={{ duration: 0.9, delay: 0.1 + i * 0.08 }}
                        />
                      </div>
                      <div className="suspect-nums type">
                        <span>{fmt(c.before)}</span>
                        <span>→</span>
                        <span>{fmt(c.after)}</span>
                      </div>
                    </Tilt>
                  ))}
                </div>

                <div className="card notes">
                  <div className="type small">INTERROGATION NOTES / SUSPECT #{Math.min(selected, result.causes.length - 1) + 1}</div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={selected}
                      className="type notes-text"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      {noteText}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </section>
            </Reveal>

            <Reveal>
              <div className="filenote type">
                FILE NOTE: a suspect is not a verdict. WhyDrop shows where the change happened and which segments
                contributed most. It cannot prove the real-world reason, so use this as the start of an investigation.
              </div>
            </Reveal>
          </>
        )}

        {/* ---------- FAQ ---------- */}
        {!loading && (
          <Reveal>
            <section className="section faq-section">
              <div className="section-head">
                <h3 className="display h3">Interrogation room: FAQ</h3>
              </div>
              <Accordion items={FAQ} />
            </section>
          </Reveal>
        )}
      </main>

      <footer className="footer">
        <div className="ticker" aria-hidden="true">
          <Marquee speed={45}>
            <TapeText words={["WhyDrop", "Python", "Pandas", "Flask", "React", "Motion", "Recharts", "No AI required"]} />
          </Marquee>
        </div>
        <div className="footer-row type">
          © {new Date().getFullYear()} WhyDrop. Built with Python, Pandas, Flask and React.
        </div>
      </footer>

      {/* ---------- floating bits ---------- */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            type="button"
            className="back-top"
            data-hot
            aria-label="Back to top"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ y: -4 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            className={"toast type toast-" + toast.kind}
            role="status"
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={confirmOpen} title="Close this case?" onClose={() => setConfirmOpen(false)}>
        <p className="type">The current results will be cleared. You can always upload the file again.</p>
        <div className="modal-actions">
          <button type="button" className="btn" data-hot onClick={() => setConfirmOpen(false)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-red"
            data-hot
            onClick={() => {
              setConfirmOpen(false);
              reset();
            }}
          >
            Close case
          </button>
        </div>
      </Modal>
    </MotionConfig>
  );
}

export default App;
