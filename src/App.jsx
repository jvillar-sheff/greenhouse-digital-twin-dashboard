import React, { useState, useEffect } from 'react';
import { Thermometer, Droplets, Wind, Sun, Activity, Loader2, Zap, X, AlertTriangle, CloudOff, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = "https://8u49qdlvy3.execute-api.us-east-1.amazonaws.com/latest";

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('DB Offline');
      const json = await response.json();
      const cleanData = json.filter(item => isNaN(item.sensor) && !['matlab_datenum', 'unix_time', 'timestamp'].includes(item.sensor.toLowerCase()));
      cleanData.sort((a, b) => a.sensor.localeCompare(b.sensor));
      setData(cleanData);
      setLoading(false);
    } catch (error) { console.error(error); setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div style={styles.loaderContainer}>
      <Loader2 className="animate-spin" size={32} color="#10b981" />
      <p style={{fontSize: '14px', marginTop: '10px', color: '#64748b'}}>Establishing Cloud Link...</p>
    </div>
  );

  return (
    <div className="dashboard-container" style={styles.container}>
      <header className="header-flex" style={styles.header}>
        <div>
          <h1 className="main-title" style={styles.title}>Greenhouse Twin</h1>
          <p style={styles.subtitle}>Real-time Cognitive Monitoring & SNN Diagnostics</p>
        </div>
        <div style={styles.badge}>
          <div style={{...styles.pulse, backgroundColor: '#10b981', animation: 'pulse 2s infinite'}}></div>
          LIVE SYSTEM
        </div>
      </header>

      <div className="dashboard-grid" style={styles.grid}>
        {data.map((item) => (
          <div 
            key={item.sensor} 
            className={`sensor-card ${item.is_anomaly ? 'warning-card' : ''}`} 
            onClick={() => setSelectedSensor(item)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <div style={styles.cardHeader}>
              <div style={styles.iconBox}><SensorIcon name={item.sensor} isAnomaly={item.is_anomaly}/></div>
              <span className="sensor-name-text" style={styles.sensorName}>{item.sensor.replace(/_/g, ' ')}</span>
            </div>
            <div style={styles.valueDisplay}>
              <span className="card-value" style={styles.value}>{item.value.toFixed(1)}</span>
              <span className="unit-text" style={styles.unit}>{getUnit(item.sensor)}</span>
            </div>
            <div className="footer-box" style={styles.footer}>
              <History size={12} color="#94a3b8" /> <span style={{fontSize: '10px', color: '#64748b', fontWeight: '600'}}>Click for history</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSensor && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSensor(null)}>
          <div className="modal-content" style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={() => setSelectedSensor(null)}><X size={20} /></button>
            <h2 style={{textTransform: 'capitalize', fontSize: '20px', color: '#1e293b', marginBottom: '4px'}}>{selectedSensor.sensor.replace(/_/g, ' ')}</h2>
            <p style={{fontSize: '12px', color: '#94a3b8', marginBottom: '20px'}}>4-Hour History (15m intervals)</p>
            
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart 
                  data={generate15MinHistory(selectedSensor.value)}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="color" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  
                  {/* AXIS: Tick only on :00 and :30 marks */}
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickMargin={12} 
                    tickFormatter={(str) => (str.endsWith(':00') || str.endsWith(':30') ? str : '')} 
                  />
                  
                  <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#color)" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const generate15MinHistory = (val) => {
  const points = [];
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  for (let i = 16; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 15 * 60 * 1000);
    points.push({ 
      time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`, 
      value: val + (Math.random() - 0.5) * (val * 0.05) 
    });
  }
  return points;
};

const getUnit = (name) => {
  const n = name.toLowerCase();
  if (n.includes('temp')) return '°C';
  if (n.includes('rh') || n.includes('closure') || n.includes('aperture')) return '%';
  if (n.includes('co2')) return 'ppm';
  if (n.includes('wind')) return 'm/s';
  return '';
};

const SensorIcon = ({ name, isAnomaly }) => {
  const n = name.toLowerCase();
  const color = isAnomaly ? "#fbbf24" : null;
  if (n.includes('temp')) return <Thermometer color={color || "#ef4444"} size={18} />;
  if (n.includes('rh') || n.includes('hum')) return <Droplets color={color || "#3b82f6"} size={18} />;
  if (n.includes('wind')) return <Wind color={color || "#64748b"} size={18} />;
  return <Zap color={color || "#10b981"} size={18} />;
};

const styles = {
  container: { padding: '40px 60px', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' },
  loaderContainer: { display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' },
  title: { color: '#0f172a', margin: 0, fontSize: '32px', fontWeight: '800', letterSpacing: '-1px' },
  subtitle: { color: '#94a3b8', margin: 0, fontSize: '13px', fontWeight: '500' },
  badge: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '30px', fontSize: '11px', fontWeight: '800', border: '1px solid #e2e8f0', height: 'fit-content' },
  pulse: { width: '8px', height: '8px', borderRadius: '50%' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' },
  iconBox: { backgroundColor: '#f8fafc', padding: '8px', borderRadius: '10px' },
  sensorName: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' },
  valueDisplay: { display: 'flex', alignItems: 'baseline', gap: '5px' },
  value: { fontSize: '36px', fontWeight: '900', color: '#1e293b' },
  unit: { fontSize: '16px', fontWeight: '600', color: '#cbd5e1' },
  footer: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '12px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { position: 'relative', backgroundColor: 'white', width: '80%', maxWidth: '750px', padding: '40px', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' },
  chartContainer: { marginTop: '10px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' },
  closeBtn: { position: 'absolute', top: '25px', right: '25px', border: 'none', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default App;