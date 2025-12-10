import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, FileText, Activity, AlertCircle, Settings } from 'lucide-react';
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

function App() {
  const [events, setEvents] = useState([]);
  const [totalLines, setTotalLines] = useState(0);
  const [chartData, setChartData] = useState({ line: [], bar: [] });
  const [stats, setStats] = useState({ total: 0, errors: 0 });
  const [currentFile, setCurrentFile] = useState("");
  const [activeTab, setActiveTab] = useState("dashboards");
  const [scrubPercent, setScrubPercent] = useState(0);

  useEffect(() => {
    // Initial load
    fetchEvents("");
  }, []);

  async function handleOpenLog() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Log Files',
          extensions: ['log', 'txt']
        }]
      });

      if (selected) {
        console.log("Selected file:", selected);
        setCurrentFile(selected);
        fetchEvents(selected);
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }

  async function fetchEvents(path) {
    try {
      const data = await invoke("get_events", { filePath: path || "" });
      processEvents(data);
    } catch (e) {
      console.warn("Backend error or not ready:", e);
      // Fallback mocks
      const mockEvents = [];
      for (let i = 0; i < 50; i++) {
        mockEvents.push({
          line_number: i * 20,
          time: `10:${16 + i}:00`,
          level: Math.random() > 0.8 ? "ERROR" : "INFO",
          message: "Regular system activity"
        });
      }
      processEvents({
        total_lines: 1200,
        events: mockEvents
      });
    }
  }

  function processEvents(data) {
    const evs = data.events || [];
    const total = data.total_lines || 1000;

    setEvents(evs);
    setTotalLines(total);

    // 1. Calc Stats
    const errCount = evs.filter(e => e.level === 'ERROR' || e.level === 'ERR').length;
    setStats({ total: evs.length, errors: errCount });

    // 2. Prep Bar Data
    const levelCounts = evs.reduce((acc, curr) => {
      acc[curr.level] = (acc[curr.level] || 0) + 1;
      return acc;
    }, {});
    const barData = Object.keys(levelCounts).map(k => ({ name: k, value: levelCounts[k] }));

    // 3. Prep Line Data
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

  const handleScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));

    setScrubPercent(percent);

    const targetLine = Math.floor(percent * totalLines);

    let closestIndex = -1;
    let minDiff = Infinity;

    events.forEach((ev, i) => {
      const diff = Math.abs(ev.line_number - targetLine);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    });

    if (closestIndex !== -1) {
      scrollToIntoView(closestIndex);
    }
  };

  const handleMouseMove = (e) => {
    if (e.buttons === 1) {
      handleScrub(e);
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboards":
        return (
          <div className="grid-layout">
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
              <div
                className="scrubber-container"
                onMouseDown={handleScrub}
                onMouseMove={handleMouseMove}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${scrubPercent * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    backgroundColor: '#fff',
                    zIndex: 20,
                    pointerEvents: 'none',
                    boxShadow: '0 0 5px rgba(255,255,255,0.5)'
                  }}
                />
                {events.map((ev, i) => (
                  <div
                    key={i}
                    className={`scrubber-rune ${ev.level}`}
                    title={`${ev.time} - ${ev.level}`}
                    style={{
                      left: `${(ev.line_number / totalLines) * 100}%`,
                      backgroundColor: ev.level === 'ERROR' ? COLORS.accent_pink :
                        ev.level === 'WARN' ? '#ff9800' :
                          'rgba(255,255,255,0.1)'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case "logs":
        return (
          <div className="card" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3>Full Log View ({totalLines} lines)</h3>
            <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Time</th>
                    <th>Level</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} id={`log-row-${i}`}>
                      <td style={{ color: COLORS.text_dim, width: '50px' }}>{ev.line_number}</td>
                      <td style={{ whiteSpace: 'nowrap', width: '100px', color: COLORS.text_dim }}>{ev.time}</td>
                      <td style={{ width: '80px' }}>
                        <span className={`tag ${ev.level}`}>{ev.level}</span>
                      </td>
                      <td className="message">{ev.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "livetail":
        return (
          <div className="card" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Activity size={48} color={COLORS.accent_purple} style={{ marginBottom: 20 }} />
              <h3>Live Tail Coming Soon</h3>
              <p style={{ color: COLORS.text_dim }}>Real-time log streaming implementation in progress.</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="card" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h3>Work in Progress</h3>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">RUNE v4.2</div>
        <nav>
          <div
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={18} /> Logs
          </div>
          <div
            className={`nav-item ${activeTab === 'livetail' ? 'active' : ''}`}
            onClick={() => setActiveTab('livetail')}
          >
            <Activity size={18} /> Live Tail
          </div>
          <div
            className={`nav-item ${activeTab === 'dashboards' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboards')}
          >
            <LayoutDashboard size={18} /> Dashboards
          </div>
          <div
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <AlertCircle size={18} /> Alerts
          </div>
          <div
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} /> Settings
          </div>
        </nav>
      </aside>

      <main className="dashboard">
        <header className="top-bar">
          <h2>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} &gt; <span>{currentFile ? currentFile.split(/[/\\]/).pop() : "Overview"}</span>
          </h2>
          <div className="controls" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-time" onClick={handleOpenLog} style={{ backgroundColor: COLORS.accent_purple, color: '#fff', border: 'none' }}>
              Open Log...
            </button>
            <button className="btn-time">Last Session ▼</button>
          </div>
        </header>

        {renderContent()}
      </main>

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
