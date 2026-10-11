import { useState } from "react";

// chart pieces from the recharts toolbox
import {LineChart,Line, XAxis,YAxis,Tooltip,ReferenceLine, ResponsiveContainer,} from "recharts";  

function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the server. Is Flask running?");
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>WhyDrop</h1>
      <p>Upload an Excel sales file to find why sales dropped.</p>

      <input type="file" accept=".xlsx" onChange={handleUpload} />

       {loading && <p>Analyzing...</p>} {/*if loading receives something then show analyzing text */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && !result.drop_found && <p>{result.message}</p>}

      {result && result.drop_found && (
        <div>
          <h2>{result.summary}</h2>
          <p>
            Drop started on: <b>{result.drop_date}</b>
          </p>
          <p>
            Sales fell from {result.before_total} to {result.after_total} (
            {result.total_change_pct}%)
          </p>

          <div style={{ width: "100%", height: 300, margin: "20px 0" }}>
            <ResponsiveContainer>
              <LineChart data={result.daily}>
                <XAxis dataKey="date" minTickGap={30} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip />
                <ReferenceLine x={result.drop_date} stroke="red" label="Drop" />
                <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table
            border="1"
            cellPadding="8"
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr>
                <th>Segment</th>
                <th>Before</th>
                <th>After</th>
                <th>Change</th>
                <th>Share of drop</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {result.causes.map((c) => (
                <tr key={c.segment}>
                  <td>{c.segment}</td>
                  <td>{c.before}</td>
                  <td>{c.after}</td>
                  <td>{c.change}</td>
                  <td>{c.share_pct}%</td>
                  <td>{c.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;