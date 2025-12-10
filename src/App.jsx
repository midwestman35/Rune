import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, FileText, Activity, AlertCircle, Settings, Search, Sun, Moon } from 'lucide-react';
import "./App.css";

const COLORS = {
  bg_app: "#0f111a",
  bg_card: "#1e212b",
  text_main: "#ffffff",
  text_dim: "#6b7280",
  accent_purple: "#7c4dff",
  accent_cyan: "#00e5ff",
  accent_pink: "#ff4081",
};

// Mock Data
const MOCK_LINE_DATA = Array.from({ length: 20 }, (_, i) => ({
  name: i,
  value: Math.floor(Math.random() * 80) + 10
}));

const MOCK_BAR_DATA = [
  { name: 'GET', value: 400 },
  { name: 'POST', value: 300 },
  { name: 'PUT', value: 300 },
  { name: 'DEL', value: 200 },
];

function App() {
  const [events, setEvents] = useState([]);
  const [chartData, setChartData] = useState({ line: [], bar: [] });
  const [stats, setStats] = useState({ total: 0, errors: 0 });

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const evs = await invoke("get_events");
      processEvents(evs);
    } catch (e) {
      console.warn("Backend not ready, using mock events");
      const mocks = [
        { time: "10:00:01", level: "ERROR", message: "Database connection failed unexpectedly." },
        { time: "10:05:23", level: "WARN", message: "High latency detected on node-3." },
        { time: "10:12:44", level: "INFO", message: "User login successful." },
        { time: "10:15:00", level: "ERROR", message: "Payment gateway timeout." }
      ];
      // Generate more mock data for visualization
      for (let i = 0; i < 50; i++) {
        mocks.push({
          time: `10:${16 + i}:00`,
          level: Math.random() > 0.8 ? "ERROR" : "INFO",
          message: "Regular system activity"
        });
      }
      processEvents(mocks);
    }
  }

  function processEvents(evs) {
    setEvents(evs);

    // 1. Calc Stats
    const errCount = evs.filter(e => e.level === 'ERROR' || e.level === 'ERR').length;
    setStats({ total: evs.length, errors: errCount });

    // 2. Prep Bar Data (Counts by Level)
    const levelCounts = evs.reduce((acc, curr) => {
      acc[curr.level] = (acc[curr.level] || 0) + 1;
      return acc;
    }, {});
    const barData = Object.keys(levelCounts).map(k => ({ name: k, value: levelCounts[k] }));

    // 3. Prep Line Data (Activity over time - simplified to index for now)
    const bucketSize = Math.ceil(evs.length / 20);
    const lineData = [];
    for (let i = 0; i < evs.length; i += bucketSize) {
      const chunk = evs.slice(i, i + bucketSize);
      const errorInChunk = chunk.filter(c => c.level === 'ERROR').length;
      lineData.push({ name: i, value: chunk.length, errors: errorInChunk });
    }

    setChartData({ line: lineData, bar: barData });
  }

  const scrollToIntoView = (index) => {
    const el = document.getElementById(`event-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="app-container">
      {/* 1. SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">RUNE v4</div>
        <nav>
          <div className="nav-item"><FileText size={18} /> Logs</div>
          <div className="nav-item"><Activity size={18} /> Live Tail</div>
          <div className="nav-item active"><LayoutDashboard size={18} /> Dashboards</div>
          <div className="nav-item"><AlertCircle size={18} /> Alerts</div>
          <div className="nav-item"><Settings size={18} /> Settings</div>
        </nav>
      </aside>

      {/* 2. MAIN DASHBOARD */}
      <main className="dashboard">
        <header className="top-bar">
          <h2>Dashboards &gt; <span>Log Analysis Overview</span></h2>
          <div className="controls">
            <button className="btn-time">Last Session ▼</button>
          </div>
        </header>

        <div className="grid-layout">
          {/* Row 1 */}
          <div className="card">
            <h3>Log Level Distribution</h3>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={chartData.bar}>
                  <XAxis dataKey="name" stroke={COLORS.text_dim} tick={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill={COLORS.accent_cyan} radius={[4, 4, 0, 0]} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: COLORS.bg_card, border: 'none' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Log Volume & Errors</h3>
            <div style={{ width: '100%', height: 150 }}>
              <ResponsiveContainer>
                <LineChart data={chartData.line}>
                  <Line type="monotone" dataKey="value" stroke={COLORS.accent_purple} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="errors" stroke={COLORS.accent_pink} strokeWidth={2} dot={false} />
                  <Tooltip contentStyle={{ backgroundColor: COLORS.bg_card, border: 'none' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2 */}
          <div className="stat-group">
            <div className="card stat">
              <h3>Total Events</h3>
              <div className="value" style={{ color: COLORS.accent_purple }}>{stats.total}</div>
            </div>
            <div className="card stat">
              <h3>Critical Errors</h3>
              <div className="value" style={{ color: COLORS.accent_pink }}>{stats.errors}</div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <h3>Timeline Scrubber</h3>
            <div className="scrubber-container">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className={`scrubber-rune ${ev.level}`}
                  onClick={() => scrollToIntoView(i)}
                  title={`${ev.time} - ${ev.level}`}
                  style={{
                    left: `${(i / events.length) * 100}%`,
                    backgroundColor: ev.level === 'ERROR' ? COLORS.accent_pink :
                      ev.level === 'WARN' ? '#ff9800' :
                        'rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* 3. RIGHT TIMELINE */}
      <aside className="timeline">
        <div className="timeline-header">Event Log</div>
        <div className="events-list">
          {events.map((ev, i) => (
            <div key={i} id={`event-${i}`} className="event-item">
              <div className="event-top">
                <span className="time">{ev.time}</span>
                <span className={`tag ${ev.level}`}>{ev.level}</span>
              </div>
              <div className="message">{ev.message}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default App;
