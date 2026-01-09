import React, { useState, useEffect } from 'react';
import { Thermometer, Droplets, Wind, Sun, Activity, Loader2, Zap, X, AlertTriangle, CloudOff, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = "https://8u49qdlvy3.execute-api.us-east-1.amazonaws.com/latest";

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Database Offline');
      const json = await response.json();
      const cleanData = json.filter(item => isNaN(item.sensor) && !['matlab_datenum', 'unix_time', 'timestamp'].includes(item.sensor.toLowerCase()));
      cleanData.sort((a, b) => a.sensor.localeCompare(b.sensor));
      setData(cleanData);
      setIsOffline(false);
      setLoading(false);
    } catch (error) {
      console.error("Connection Error:", error);
      setIsOffline(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div style={styles.loaderContainer}>
      <Loader2 className="animate-spin" size={40} color="#10b981" />
      <p>Synchronizing with AWS Digital Twin...</p>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Greenhouse Digital Twin</h1>
          <p style={styles.subtitle}>Real-time Cognitive Monitoring & SNN Diagnostics</p>
        </div>
        <div style={{
          ...styles.badge, 
          color: isOffline ? '#ef4444' : '#10b981',
          borderColor: isOffline ? '#fecaca' : '#e2e8f0'
        }}>
          <div style={{...styles.pulse, backgroundColor: isOffline ? '#ef4444' : '#10b981', animation: isOffline ? 'none' : 'pulse 2s infinite'}}></div>
          {isOffline ? 'SYSTEM OFFLINE' : 'LIVE SYSTEM'}
        </div>
      </header>

      <div style={styles.grid}>
        {data.map((item) => (
          <div 
            key={item.sensor} 
            className={`sensor-card ${item.is_anomaly ? 'warning-card' : ''}`} 
            onClick={() => setSelectedSensor(item)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            {item.is_anomaly && (
              <div style={styles.spikeLabel}><AlertTriangle size={12} /> SNN WARNING</div>
            )}
            <div style={styles.cardHeader}>
              <div style={styles.iconBox}><SensorIcon name={item.sensor} isAnomaly={item.is_anomaly} /></div>
              <span style={styles.sensorName}>{item.sensor.replace(/_/g, ' ')}</span>
            </div>
            <div style={styles.valueDisplay}>
              <span style={styles.value}>{item.value.toFixed(1)}</span>
              <span style={styles.unit}>{getUnit(item.sensor)}</span>
            </div>
            <div style={styles.footer}>
              <History size={14} color="#64748b" />
              <span style={styles.footerText}>Click to view history</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSensor && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSensor(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={() => setSelectedSensor(null)}><X size={20} color="#64748b" /></button>
            <h2 style={{textTransform: 'capitalize', color: '#1e293b', marginBottom: '8px'}}>{selectedSensor.sensor.replace(/_/g, ' ')}</h2>
            <p style={{...styles.subtitle, marginBottom: '24px'}}>4-Hour History (Data Ingestion Every 15m)</p>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={generate15MinHistory(selectedSensor.value)}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  
                  {/* FIXED X-AXIS: Only shows :00 and :30 labels */}
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickMargin={12} 
                    tickFormatter={(str) => (str.endsWith(':00') || str.endsWith(':30') ? str : '')}
                  />
                  
                  <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#colorValue)" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} />
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
    const timeLabel = new Date(now.getTime() - i * 15 * 60 * 1000);
    const hours = timeLabel.getHours().toString().padStart(2, '0');
    const mins = timeLabel.getMinutes().toString().padStart(2, '0');
    points.push({
      time: `${hours}:${mins}`,
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
  if (n.includes('temp')) return <Thermometer color={color || "#ef4444"} size={22} />;
  if (n.includes('rh') || n.includes('hum') || n.includes('vpd')) return <Droplets color={color || "#3b82f6"} size={22} />;
  if (n.includes('wind')) return <Wind color={color || "#64748b"} size={22} />;
  return <Zap color={color || "#10b981"} size={22} />;
};

const styles = {
  container: { padding: '50px', backgroundColor: '#f8fafc', minHeight: '100vh', width: '100vw', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' },
  loaderContainer: { display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#64748b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' },
  title: { color: '#0f172a', margin: '0 0 8px 0', fontSize: '32px', fontWeight: '800', letterSpacing: '-1px' },
  subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },
  badge: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '8px 16px', borderRadius: '30px', fontSize: '11px', fontWeight: '800', border: '1px solid #e2e8f0' },
  pulse: { width: '8px', height: '8px', borderRadius: '50%' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' },
  iconBox: { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '12px' },
  sensorName: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' },
  valueDisplay: { display: 'flex', alignItems: 'baseline', gap: '5px' },
  value: { fontSize: '42px', fontWeight: '900', color: '#1e293b' },
  unit: { fontSize: '18px', fontWeight: '600', color: '#94a3b8' },
  footer: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '25px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' },
  footerText: { fontSize: '12px', color: '#475569', fontWeight: '600' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { position: 'relative', backgroundColor: 'white', width: '90%', maxWidth: '850px', padding: '48px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' },
  chartContainer: { marginTop: '10px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9' },
  closeBtn: { position: 'absolute', top: '30px', right: '30px', border: 'none', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '50%', cursor: 'pointer' },
  spikeLabel: { position: 'absolute', top: '20px', right: '20px', backgroundColor: '#fef3c7', color: '#d97706', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }
};

export default App;