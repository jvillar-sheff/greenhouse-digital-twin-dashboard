import React, { useState, useEffect, useCallback } from 'react';
import { 
  Thermometer, Droplets, Wind, Zap, X, 
  AlertTriangle, CloudOff, History, Loader2, Activity,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import './App.css';

const API_URL = "https://8u49qdlvy3.execute-api.us-east-1.amazonaws.com/latest";

function App() {
  const [data, setData] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);

  // --- 1. MODAL NAVIGATION LOGIC (Desktop Carousel) ---
  const navigateModal = useCallback((direction) => {
    if (!selectedSensor || data.length === 0) return;
    const currentIndex = data.findIndex(s => s.sensor === selectedSensor.sensor);
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % data.length;
    } else {
      nextIndex = (currentIndex - 1 + data.length) % data.length;
    }
    setSelectedSensor(data[nextIndex]);
  }, [selectedSensor, data]);

  // Keyboard Event Listeners for Arrows
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedSensor) return;
      if (e.key === 'ArrowRight') navigateModal('next');
      if (e.key === 'ArrowLeft') navigateModal('prev');
      if (e.key === 'Escape') setSelectedSensor(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSensor, navigateModal]);

  // --- 2. CORE DATA FETCHING (RDS/S3 Hybrid) ---
  const fetchData = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Network error');
      const json = await response.json();
      const isS3Backup = json.system_status === "S3 (Failover Archive)";
      
      if (json.data && Array.isArray(json.data)) {
        const cleanData = json.data.filter(item => 
          isNaN(item.sensor) && 
          !['matlab_datenum', 'unix_time', 'timestamp'].includes(item.sensor.toLowerCase())
        );
        cleanData.sort((a, b) => a.sensor.localeCompare(b.sensor));
        
        setData(cleanData);
        setHistory(json.history || []); 

        if (isS3Backup) {
          setIsOffline(true);
        } else {
          setIsOffline(false);
          // High-reliability persistent cache
          localStorage.setItem('greenhouse_cache', JSON.stringify({
            data: cleanData, 
            history: json.history,
            timestamp: new Date().toISOString()
          }));
        }
      }
    } catch (error) {
      setIsOffline(true);
      const cached = localStorage.getItem('greenhouse_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed.data);
        setHistory(parsed.history);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, []);

  // --- 3. CHART DATA PROCESSING ---
  const getChartData = (sensorName) => {
    if (!history || history.length === 0) return [];
    return history
      .filter(entry => {
        const val = entry.data[sensorName];
        if (val === null || val === undefined) return false;
        // Sanitization: Filter 0 only for concentration levels (impossible zeros)
        if (sensorName === 'indoor_co2' || sensorName === 'indoor_vpd') return val !== 0;
        return true; 
      })
      .map((entry, index, arr) => ({
        uniqueKey: `${entry.timestamp}-${index}`,
        timeLabel: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: parseFloat(entry.data[sensorName]?.toFixed(2) || 0),
        isAnomalyPoint: selectedSensor?.is_anomaly && index === (arr.length - 1)
      }));
  };

  const CustomizedDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload && payload.isAnomalyPoint) {
      return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="#fbbf24" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    }
    return <circle cx={cx} cy={cy} r={3} fill="#10b981" />;
  };

  if (loading) return (
    <div style={styles.loaderContainer}>
      <Loader2 className="animate-spin" size={32} color="#10b981" />
      <p style={{fontSize: '14px', marginTop: '10px', color: '#64748b'}}>Synchronizing Twin...</p>
    </div>
  );

  return (
    <div className="dashboard-container" style={styles.container}>
      <header className="header-flex" style={styles.header}>
        <div className="title-block">
          <h1 className="main-title" style={styles.title}>Greenhouse Twin</h1>
          <p style={styles.subtitle}>SNN Cognitive Monitoring & Diagnostics</p>
        </div>
        
        <div className="status-badge-container">
          <div style={{
            ...styles.badge, 
            borderColor: isOffline ? '#fecaca' : '#e2e8f0',
            color: '#0f172a'
          }}>
            <div style={{
              ...styles.pulse, 
              backgroundColor: isOffline ? '#ef4444' : '#10b981', 
              animation: isOffline ? 'none' : 'pulse 2s infinite'
            }}></div>
            <span style={{ fontWeight: '800', letterSpacing: '0.5px' }}>
              {isOffline ? 'SYSTEM OFFLINE' : 'LIVE SYSTEM'}
            </span>
          </div>
        </div>
      </header>

      {isOffline && (
        <div className="offline-warning-box" style={styles.offlineWarning}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <CloudOff size={18} />
            <strong style={{fontSize: '13px'}}>Limited Mode:</strong>
          </div>
          <span style={{fontSize: '12px'}}>
            Primary RDS is offline. Diagnostics suspended. Displaying 6-hour history from S3.
          </span>
        </div>
      )}

      <div className="dashboard-grid" style={styles.grid}>
        {data.map((item) => (
          <div 
            key={item.sensor} 
            className={`sensor-card ${item.is_anomaly ? 'warning-card' : ''}`} 
            onClick={() => setSelectedSensor(item)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            {item.is_anomaly && (
              <div className="spike-label" style={styles.spikeLabel}>
                <AlertTriangle size={12} /> SNN SPIKE
              </div>
            )}
            
            <div style={styles.cardHeader}>
              <div className="icon-box-mobile" style={styles.iconBox}>
                <SensorIcon name={item.sensor} isAnomaly={item.is_anomaly}/>
              </div>
              <span className="sensor-name-text" style={styles.sensorName}>{item.sensor.replace(/_/g, ' ')}</span>
            </div>
            
            <div style={styles.valueDisplay}>
              <span className="card-value" style={styles.value}>{item.value.toFixed(1)}</span>
              <span className="unit-text" style={styles.unit}>{getUnit(item.sensor)}</span>
            </div>
            
            <div className="footer-box" style={styles.footer}>
              <History size={12} color="#94a3b8" /> 
              <span style={{fontSize: '10px', color: '#64748b', fontWeight: '600'}}>View Real History</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSensor && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSensor(null)}>
          <div className="modal-content" style={styles.modalContent} onClick={e => e.stopPropagation()}>
            
            {/* Desktop-only Navigation Chevrons */}
            <button 
              className="modern-nav-btn"
              style={{...styles.modernNavBtn, left: '10px'}} 
              onClick={(e) => { e.stopPropagation(); navigateModal('prev'); }}
            >
              <ChevronLeft size={28} />
            </button>

            <button 
              className="modern-nav-btn"
              style={{...styles.modernNavBtn, right: '10px'}} 
              onClick={(e) => { e.stopPropagation(); navigateModal('next'); }}
            >
              <ChevronRight size={28} />
            </button>

            <button style={styles.closeBtn} onClick={() => setSelectedSensor(null)}><X size={20} /></button>
            
            <div className="modal-inner-padding">
               <h2 style={{textTransform: 'capitalize', fontSize: '20px', color: '#1e293b', marginBottom: '4px'}}>
                {selectedSensor.sensor.replace(/_/g, ' ')}
              </h2>
              <p style={{fontSize: '12px', color: '#94a3b8', marginBottom: '20px'}}>
                Sensor {data.findIndex(s => s.sensor === selectedSensor.sensor) + 1} of {data.length}
              </p>
              
              <div style={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={getChartData(selectedSensor.sensor)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={10} tickMargin={12} />
                    <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#colorGreen)" strokeWidth={3} dot={<CustomizedDot />} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {selectedSensor.is_anomaly && (
                <div className="anomaly-note" style={styles.anomalyNote}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={18} color="#92400e" />
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px' }}>Diagnostic: Temporal Spike Detected</strong>
                      <span style={{ fontSize: '12px' }}>The SNN detected significant instability in the recent telemetry stream.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getUnit = (name) => {
  const n = name.toLowerCase();
  if (n.includes('status')) return '';
  if (n.includes('temp')) return '°C';
  if (n.includes('rh') || n.includes('hum') || n.includes('closure') || n.includes('aperture')) return '%';
  if (n.includes('co2')) return 'ppm';
  if (n.includes('wind')) return 'm/s';
  if (n.includes('vpd')) return 'kPa';
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
  badge: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fff', padding: '8px 20px', borderRadius: '40px', fontSize: '11px', border: '1.5px solid', height: 'fit-content', whiteSpace: 'nowrap' },
  pulse: { width: '8px', height: '8px', borderRadius: '50%' },
  offlineWarning: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px 25px', borderRadius: '16px', marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '5px', border: '1.5px solid #fecaca', width: 'fit-content' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' },
  iconBox: { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '12px' },
  sensorName: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' },
  valueDisplay: { display: 'flex', alignItems: 'baseline', gap: '5px' },
  value: { fontSize: '36px', fontWeight: '900', color: '#1e293b' },
  unit: { fontSize: '16px', fontWeight: '600', color: '#cbd5e1' },
  footer: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '12px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { position: 'relative', backgroundColor: 'white', width: '80%', maxWidth: '850px', padding: '40px 10px', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' },
  chartContainer: { marginTop: '10px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' },
  closeBtn: { position: 'absolute', top: '25px', right: '25px', border: 'none', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spikeLabel: { position: 'absolute', top: '20px', right: '20px', backgroundColor: '#fef3c7', color: '#d97706', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' },
  anomalyNote: { marginTop: '20px', backgroundColor: '#fffbeb', padding: '20px', borderRadius: '20px', border: '1px solid #fef3c7', color: '#92400e' },
  modernNavBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', color: '#cbd5e1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', padding: '10px', zIndex: 1002 }
};

export default App;