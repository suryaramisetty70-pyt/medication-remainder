import React, { useState, useEffect, useRef } from 'react';
import { 
  Pill, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Send, 
  Volume2, 
  VolumeX,
  X,
  Camera,
  Activity,
  Award,
  Clock,
  ChevronRight,
  Sparkles,
  Bell,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import PillCamera from './components/PillCamera';

// Audio Alarm Helpers using Web Audio API
let audioCtx = null;
let alarmInterval = null;

const playAlarmSound = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (alarmInterval) return; // Already ringing
  
  alarmInterval = setInterval(() => {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2); // Beep for 200ms
    } catch (e) {
      console.warn("Audio Context failed to play beep:", e);
    }
  }, 600); // Beep every 600ms
};

const stopAlarmSound = () => {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
};

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? "http://localhost:8000" 
  : window.location.origin;




export default function App() {
  // State variables
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([
    { id: 1, username: "Parent User", role: "parent", parent_id: null },
    { id: 2, username: "Child User", role: "child", parent_id: 1 }
  ]);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("aegis_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });
  const [parentAlerts, setParentAlerts] = useState([]);
  const [parentEmail, setParentEmail] = useState("");


  
  // Form fields
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedTime, setNewMedTime] = useState("");
  const [newMedInstruction, setNewMedInstruction] = useState("");
  
  // Modals & Chat
  const [selectedMedForCamera, setSelectedMedForCamera] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Hello! I am your AI Health Coach. Ask me any questions about your medications or report side effects!' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Sound Alarm State
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [alarmAcknowledgedToday, setAlarmAcknowledgedToday] = useState({}); // e.g. {medId-date: true}
  
  // Photo lightbox state
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  
  // Parent notification toasts
  const [parentNotifications, setParentNotifications] = useState([]);
  const prevAlertsCount = useRef(0);
  
  const chatMessagesEndRef = useRef(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const handleUnlockAudio = () => {
    if (isAudioUnlocked) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      // Play a quick silent beep to satisfy browser interaction policy
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
      setIsAudioUnlocked(true);
      console.log("🔊 Audio autoplay context unlocked successfully!");
    } catch (e) {
      console.warn("Failed to unlock audio context:", e);
    }
  };


  // Login & OTP Auth State Variables
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("aegis_is_logged_in") === "true";
  });

  const [authTab, setAuthTab] = useState("login"); // 'login' or 'signup'
  const [loginName, setLoginName] = useState("");
  const [loginAge, setLoginAge] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginRole, setLoginRole] = useState("parent");
  const [loginFamilyCode, setLoginFamilyCode] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!loginEmail) return;
    setIsSendingOtp(true);
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail })
      });
      if (res.ok) {
        setOtpSent(true);
      } else {
        const data = await res.json();
        setLoginError(data.detail || "Failed to send OTP.");
      }
    } catch (err) {
      setLoginError("Connection error. Please check your internet.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!loginOtp || !loginEmail) return;
    if (authTab === 'signup' && (!loginName || !loginAge || !loginPhone)) return;
    
    setIsVerifyingOtp(true);
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          otp_code: loginOtp,
          username: authTab === 'signup' ? loginName : undefined,
          age: authTab === 'signup' && loginAge ? Number(loginAge) : undefined,
          phone: authTab === 'signup' ? loginPhone : undefined,
          role: loginRole,
          parent_id: loginRole === 'child' ? 1 : null,
          family_code: authTab === 'signup' && loginRole === 'child' && loginFamilyCode ? loginFamilyCode : undefined
        })
      });

      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setIsLoggedIn(true);
        try {
          localStorage.setItem("aegis_current_user", JSON.stringify(user));
          localStorage.setItem("aegis_is_logged_in", "true");
        } catch(e) {}
        handleUnlockAudio();
        fetchUsers();
      } else {
        const data = await res.json();
        setLoginError(data.detail || "Invalid OTP code.");
      }
    } catch (err) {
      setLoginError("Verification failed. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };



  // Helper date strings
  const getTodayString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getChildId = () => {
    if (!currentUser) return 1;
    if (currentUser.role === 'child') return currentUser.id;
    // For parent, get the linked child user
    const child = users.find(u => u.role === 'child' && u.parent_id === currentUser.id);
    return child ? child.id : 2; // fallback to Child User ID
  };

  // Fetch Data
  const fetchMedications = async (familyId = currentUser?.family_id || 'FAM-DEFAULT') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/medications?family_id=${familyId}`);
      if (res.ok) {
        const data = await res.json();
        setMedications(data);
      }
    } catch (err) {
      console.error("Error fetching medications:", err);
    }
  };

  const fetchLogs = async (familyId = currentUser?.family_id || 'FAM-DEFAULT') => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 7); // Last 7 days
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    try {
      const res = await fetch(`${API_BASE_URL}/api/logs?start_date=${startStr}&end_date=${endStr}&family_id=${familyId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const fetchParentAlerts = async (familyId = currentUser?.family_id || 'FAM-DEFAULT') => {
    if (!familyId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/parent/alerts/${familyId}`);
      if (res.ok) {
        const data = await res.json();
        setParentAlerts(data);
      }
    } catch (err) {
      console.error("Error fetching parent alerts:", err);
    }
  };


  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        const parentUser = data.find(u => u.role === 'parent');
        if (parentUser && parentUser.email) {
          setParentEmail(parentUser.email);
        }

      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    const parentUser = users.find(u => u.role === 'parent');
    if (!parentUser) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${parentUser.id}/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parentEmail })
      });
      if (res.ok) {
        fetchUsers();
        alert("Alert email updated successfully!");
      }
    } catch (err) {
      console.error("Error saving email:", err);
    }
  };


  useEffect(() => {
    fetchUsers();
    // Request browser notification permission on app load
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const familyId = currentUser.family_id || 'FAM-DEFAULT';
      fetchMedications(familyId);
      fetchLogs(familyId);
      fetchParentAlerts(familyId);
    }
  }, [currentUser]);

  // Poll for parent alerts ALWAYS (every 5 seconds) — works in both parent AND child mode
  useEffect(() => {
    if (!currentUser) return;
    const familyId = currentUser.family_id || 'FAM-DEFAULT';
    
    const interval = setInterval(() => {
      fetchParentAlerts(familyId);
      fetchLogs(familyId); // Also refresh logs to keep dashboard in sync
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);


  // Fire browser notification + in-app toast when new parent alerts appear
  // Works in BOTH parent and child mode — parent always gets notified
  useEffect(() => {
    if (!currentUser) return;
    
    if (parentAlerts.length > prevAlertsCount.current) {
      // New alerts detected
      const newAlerts = parentAlerts.slice(prevAlertsCount.current);
      
      newAlerts.forEach(alert => {
        // Browser notification (works even if app is minimized)
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`⚠️ Missed Dose Alert!`, {
            body: `${alert.name} (${alert.dosage}) - ${alert.message}`,
            icon: "https://cdn-icons-png.flaticon.com/512/1043/1043136.png",
            requireInteraction: true  // Stays until user clicks it
          });
        }
        
        // In-app toast notification (visible in both parent and child mode)
        const toastId = Date.now() + Math.random();
        setParentNotifications(prev => [...prev, {
          id: toastId,
          title: `${alert.name} (${alert.dosage})`,
          message: alert.message,
          time: new Date().toLocaleTimeString()
        }]);
        
        // Play a notification sound
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523, audioCtx.currentTime); // C5 note
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.5);
        } catch(e) {}
        
        // Auto-dismiss toast after 10 seconds
        setTimeout(() => {
          setParentNotifications(prev => prev.filter(n => n.id !== toastId));
        }, 10000);
      });
    }
    
    prevAlertsCount.current = parentAlerts.length;
  }, [parentAlerts, currentUser]);

  // Poll for Alarm notifications every 3 seconds (Only for Child user role)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'child') return;
    
    const checkAlarmTrigger = () => {
      if (activeAlarm) return; // Already ringing
      
      const now = new Date();
      const todayStr = getTodayString();
      const nowMinutes = now.getHours() * 60 + now.getMinutes(); // Current time in minutes since midnight
      
      medications.forEach(med => {
        const ackKey = `${med.id}-${todayStr}`;
        if (alarmAcknowledgedToday[ackKey]) return; // Already acknowledged
        
        // Parse medication schedule time
        const [schedH, schedM] = med.schedule_time.split(':').map(Number);
        const schedMinutes = schedH * 60 + schedM;
        
        // Trigger if we are within 0 to 2 minutes AFTER the scheduled time
        const diff = nowMinutes - schedMinutes;
        if (diff >= 0 && diff <= 2) {
          // Check if already taken or missed in today's logs
          const alreadyLogged = logs.some(log => 
            log.medication_id === med.id && 
            log.scheduled_time.startsWith(todayStr) && 
            (log.status === 'taken' || log.status === 'missed')
          );
          
          if (!alreadyLogged) {
            console.log(`🔔 ALARM TRIGGERED for ${med.name} at ${med.schedule_time}`);
            setActiveAlarm(med);
            playAlarmSound();
            
            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`⏰ Reminder: Time for ${med.name}!`, {
                body: `${med.dosage} - ${med.instruction || "No special instructions"}`,
                icon: "https://cdn-icons-png.flaticon.com/512/1043/1043136.png",
                requireInteraction: true
              });
            }
          }
        }
      });
    };

    // Run check immediately on mount
    checkAlarmTrigger();
    
    // Then poll every 3 seconds
    const interval = setInterval(checkAlarmTrigger, 3000);
    return () => clearInterval(interval);
  }, [medications, logs, activeAlarm, alarmAcknowledgedToday, currentUser]);

  // Unanswered alarm auto-timeout (60 seconds) -> logs missed dose and triggers parent email alert
  useEffect(() => {
    if (!activeAlarm) return;
    const timeoutId = setTimeout(() => {
      console.warn(`⏰ Alarm unacknowledged for ${activeAlarm.name}. Auto-logging as missed and sending email alert to parent...`);
      stopAlarmSound();
      handleLogAdherence(activeAlarm.id, 'missed', 0, "Unanswered alarm - child did not respond");
      setActiveAlarm(null);
    }, 60000); // 60 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [activeAlarm]);


  // Scroll Chat to bottom
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  // Add Medication handler
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!newMedName || !newMedDosage || !newMedTime) return;

    const familyId = currentUser?.family_id || 'FAM-DEFAULT';

    try {
      const res = await fetch(`${API_BASE_URL}/api/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMedName,
          dosage: newMedDosage,
          schedule_time: newMedTime,
          instruction: newMedInstruction,
          family_id: familyId
        })
      });

      if (res.ok) {
        setNewMedName("");
        setNewMedDosage("");
        setNewMedTime("");
        setNewMedInstruction("");
        fetchMedications(familyId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Medication handler
  const handleDeleteMedication = async (id) => {
    const familyId = currentUser?.family_id || 'FAM-DEFAULT';
    try {
      const res = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchMedications(familyId);
        fetchLogs(familyId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Log Adherence (without camera)
  const handleLogAdherence = async (medId, status, isVerified = 0, msg = "Self-logged", imageData = null) => {
    const todayStr = getTodayString();
    const scheduledTime = `${todayStr} ${medications.find(m => m.id === medId)?.schedule_time || '00:00'}`;
    const familyId = currentUser?.family_id || 'FAM-DEFAULT';

    try {
      const res = await fetch(`${API_BASE_URL}/api/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_id: medId,
          status: status,
          scheduled_time: scheduledTime,
          is_verified: isVerified,
          verification_msg: msg,
          image_data: imageData,
          family_id: familyId
        })
      });

      if (res.ok) {
        // Mark acknowledged in state to prevent re-triggering alarm
        const ackKey = `${medId}-${todayStr}`;
        setAlarmAcknowledgedToday(prev => ({ ...prev, [ackKey]: true }));
        
        fetchLogs(familyId);
        
        // If parent is viewing, refresh alerts too
        if (currentUser?.role === 'parent') {
          fetchParentAlerts(familyId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };


  // Acknowledge alarm trigger directly from alarm popup
  const handleAlarmAction = async (status) => {
    if (activeAlarm) {
      stopAlarmSound();
      const medId = activeAlarm.id;
      setActiveAlarm(null);
      
      const todayStr = getTodayString();
      const ackKey = `${medId}-${todayStr}`;
      setAlarmAcknowledgedToday(prev => ({ ...prev, [ackKey]: true }));

      if (status === 'taken') {
        // Check if we need camera verification
        setSelectedMedForCamera(activeAlarm);
      } else {
        await handleLogAdherence(medId, 'missed', 0, "Alarm ignored/missed");
      }
    }
  };

  const handleSnoozeAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
    // Temporary acknowledge for 5 minutes (simplified as acknowledging for this check cycle)
    const todayStr = getTodayString();
    const ackKey = `${activeAlarm.id}-${todayStr}`;
    setAlarmAcknowledgedToday(prev => ({ ...prev, [ackKey]: true }));
  };

  // Send message to AI Chatbot
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      // Package clean message history
      const history = chatMessages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          history: history
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'model', text: data.reply }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { 
        role: 'system', 
        text: 'Connection failed. Please ensure the backend is running.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Compute KPI Stats (Calculated over last 7 days of logs)
  const getStats = () => {
    const todayStr = getTodayString();
    
    // Total doses scheduled for today
    const totalScheduledToday = medications.length;
    
    // Taken today
    const takenToday = logs.filter(log => 
      log.scheduled_time.startsWith(todayStr) && log.status === 'taken'
    ).length;

    // Missed today
    const missedToday = logs.filter(log => 
      log.scheduled_time.startsWith(todayStr) && log.status === 'missed'
    ).length;

    // Taken total (last 7 days)
    const totalTaken = logs.filter(log => log.status === 'taken').length;
    const totalMissed = logs.filter(log => log.status === 'missed').length;
    const totalLogged = totalTaken + totalMissed;
    
    const complianceRate = totalLogged > 0 ? Math.round((totalTaken / totalLogged) * 100) : 100;

    // Calculate streak
    let streak = 0;
    const dateCursor = new Date();
    
    while (true) {
      const cursorStr = dateCursor.toISOString().split('T')[0];
      
      // Get all logs for this cursor date
      const cursorLogs = logs.filter(l => l.scheduled_time.startsWith(cursorStr));
      
      // If we don't have medications scheduled, we ignore empty historic days,
      // but if we do have medications, we need all of them to be taken to maintain the streak.
      if (medications.length === 0) break;

      const takenOnDay = cursorLogs.filter(l => l.status === 'taken').length;
      const missedOnDay = cursorLogs.filter(l => l.status === 'missed').length;
      
      // Check if patient completed all their medications for that day
      if (takenOnDay > 0 && missedOnDay === 0 && takenOnDay >= medications.length) {
        streak++;
        dateCursor.setDate(dateCursor.getDate() - 1);
      } else {
        // If it's today and they haven't finished all their doses yet but haven't missed any, 
        // keep the streak alive check based on yesterday
        if (cursorStr === todayStr && missedOnDay === 0) {
          dateCursor.setDate(dateCursor.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return {
      scheduledToday: totalScheduledToday,
      takenToday: takenToday,
      missedToday: missedToday,
      compliance: complianceRate,
      streak: streak,
      totalVerified: logs.filter(log => log.status === 'taken' && log.is_verified === 1).length
    };
  };

  const stats = getStats();

  // Helper lists for today's logs checklist
  const getTodayChecklist = () => {
    const todayStr = getTodayString();
    
    return medications.map(med => {
      // Check if we have an existing log for today
      const todayLog = logs.find(log => 
        log.medication_id === med.id && 
        log.scheduled_time.startsWith(todayStr)
      );

      return {
        ...med,
        status: todayLog ? todayLog.status : 'pending',
        is_verified: todayLog ? todayLog.is_verified : 0,
        verification_msg: todayLog ? todayLog.verification_msg : ""
      };
    });
  };

  const todayChecklist = getTodayChecklist();

  // Custom 7-day adherence graphic grid
  const getAdherenceHistoryData = () => {
    const days = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const name = weekdayNames[d.getDay()];
      
      // Find logs on this date
      const dayLogs = logs.filter(l => l.scheduled_time.startsWith(dateStr));
      const taken = dayLogs.filter(l => l.status === 'taken').length;
      const missed = dayLogs.filter(l => l.status === 'missed').length;
      
      let status = 'pending'; // no log or incomplete
      if (medications.length > 0) {
        if (taken >= medications.length && missed === 0) {
          status = 'taken';
        } else if (missed > 0 || (dayLogs.length > 0 && taken < dayLogs.length)) {
          status = 'missed';
        }
      }
      
      days.push({ name, status });
    }
    return days;
  };

  const historyDays = getAdherenceHistoryData();

  // Request system notification permissions on first load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="app-container" onClick={handleUnlockAudio} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem', background: '#090d16' }}>

        <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '2.5rem', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Pill size={48} style={{ color: 'var(--color-accent)', marginBottom: '0.75rem', filter: 'drop-shadow(0 0 12px var(--color-accent))' }} />
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.025em', color: '#fff', marginBottom: '0.25rem' }}>Aegis AI Authentication</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Smart Medication Adherence Monitor</p>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              ⚠️ {loginError}
            </div>
          )}

          {!otpSent ? (
            <div>
              {/* Dual Tab Switcher: Log In vs Sign Up */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.35rem', borderRadius: '14px', marginBottom: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setLoginError(""); }}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: authTab === 'login' ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                    color: authTab === 'login' ? '#fff' : '#94a3b8',
                    boxShadow: authTab === 'login' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none'
                  }}
                >
                  🔑 Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setLoginError(""); }}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: authTab === 'signup' ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                    color: authTab === 'signup' ? '#fff' : '#94a3b8',
                    boxShadow: authTab === 'signup' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none'
                  }}
                >
                  📝 Sign Up
                </button>
              </div>

              {/* TAB 1: Log In (Existing Users) */}
              {authTab === 'login' ? (
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Registered Email ID</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g. yourname@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  {/* Quick Select from existing household profiles */}
                  {users.filter(u => u.email).length > 0 && (
                    <div style={{ marginTop: '-0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                        Quick Select Saved Profile:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {users.filter(u => u.email).map((u, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setLoginEmail(u.email);
                              setLoginRole(u.role || 'parent');
                            }}
                            style={{
                              background: loginEmail === u.email ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: loginEmail === u.email ? '1px solid #0ea5e9' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: loginEmail === u.email ? '#38bdf8' : '#cbd5e1',
                              borderRadius: '20px',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            {u.role === 'parent' ? '👨‍👩‍👦' : '👶'} {u.username}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isSendingOtp}
                    style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
                  >
                    {isSendingOtp ? "Sending OTP..." : "Send Log In OTP"}
                  </button>
                </form>
              ) : (
                /* TAB 2: Sign Up (New Account) */
                <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Full Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. John Doe"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Age</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="e.g. 35"
                        value={loginAge}
                        onChange={(e) => setLoginAge(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Role</label>
                      <select 
                        className="form-control" 
                        value={loginRole} 
                        onChange={(e) => setLoginRole(e.target.value)}
                        style={{ background: '#121826', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#fff' }}
                      >
                        <option value="parent">Parent</option>
                        <option value="child">Child</option>
                      </select>
                    </div>
                  </div>

                  {loginRole === 'child' && (
                    <div className="form-group" style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#38bdf8' }}>🔑 Family Code (from Parent)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. FAM-8X2K (Optional)"
                        value={loginFamilyCode}
                        onChange={(e) => setLoginFamilyCode(e.target.value.toUpperCase())}
                        style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                        Enter the Family Code shown on your Parent's dashboard to link your schedule.
                      </span>
                    </div>
                  )}

                  <div className="form-group">
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Phone Number</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      placeholder="e.g. +91 9876543210"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Email ID</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g. user@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>


                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isSendingOtp}
                    style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
                  >
                    {isSendingOtp ? "Sending OTP..." : "Create Account & Send OTP"}
                  </button>
                </form>
              )}
            </div>
          ) : (

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.82rem', textAlign: 'center', lineHeight: '1.4' }}>
                📧 An OTP verification code was sent to <strong style={{ color: '#fff' }}>{loginEmail}</strong>. Please enter the code below to complete sign in.
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>Enter 6-Digit OTP Code</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. 123456"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value)}
                  style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '8px', fontWeight: '700', color: 'var(--color-accent)' }}
                  required
                />
              </div>


              <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem 0', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(14, 165, 233, 0.08)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                💡 Fast-Track Test Code: <span onClick={() => setLoginOtp("123456")} style={{ color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', letterSpacing: '1px' }}>123456</span> <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(click to auto-fill)</span>
              </div>


              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setOtpSent(false)}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isVerifyingOtp}
                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify & Log In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" onClick={handleUnlockAudio}>
      {!isAudioUnlocked && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.1)',
          borderBottom: '1px solid rgba(234, 179, 8, 0.2)',
          color: '#fbbf24',
          textAlign: 'center',
          padding: '0.5rem 1rem',
          fontSize: '0.82rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          🔊 Browser audio is currently muted. Click anywhere on the screen to unlock medication alarm sounds!
        </div>
      )}

      {/* Header */}
      <header>
        <div className="logo-section">
          <Pill size={32} className="logo-icon" />
          <div>
            <h1>Aegis AI</h1>
          </div>
          <span>Smart Adherence</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Logged in User Profile & Log Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.35rem 0.85rem', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              👤 {currentUser?.username} ({currentUser?.role?.toUpperCase()})
            </span>
            <button 
              onClick={() => {
                localStorage.removeItem("aegis_current_user");
                localStorage.removeItem("aegis_is_logged_in");
                setCurrentUser(null);
                setIsLoggedIn(false);
                setOtpSent(false);
                setLoginOtp("");
                setLoginError("");
              }}

              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#f87171',
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(239, 68, 68, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
            >
              Log Out
            </button>
          </div>

          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Activity size={12} className="logo-icon" />
            <span>Live</span>
          </div>
        </div>
      </header>

      {/* Parent Alerts Banner (Only visible in Parent Mode) */}
      {currentUser?.role === 'parent' && parentAlerts.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            <AlertTriangle size={16} />
            <span>⚠️ CRITICAL ADHERENCE ALERTS ({parentAlerts.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {parentAlerts.map((alert, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                <span><strong>{alert.name} ({alert.dosage})</strong>: {alert.message}</span>
                <span style={{ color: '#f87171', fontWeight: '600' }}>{alert.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <section className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-label">Today's Regimen</div>
          <div className="kpi-value">{stats.takenToday} / {stats.scheduledToday}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Doses logged taken today</div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-label">Compliance Rate</div>
          <div className="kpi-value">{stats.compliance}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Weekly average rate</div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-label">Active Streak</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <Award size={22} /> {stats.streak} Days
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Perfect days count</div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-label">AI Verified Ingestions</div>
          <div className="kpi-value" style={{ color: 'var(--color-accent)' }}>{stats.totalVerified}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Camera confirmed doses</div>
        </div>
      </section>

      {/* Main Grid */}
      <main className="dashboard-grid">
        
        {/* Left Side: Setup and Current Inventory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Add Medication Form (Parent only) / Welcoming Guide (Child only) */}
          {/* Add Medication Form (Parent only) / Welcoming Guide with Live Countdown (Child only) */}
          {currentUser?.role === 'child' ? (
            <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <h3 className="card-title" style={{ color: 'var(--color-accent)' }}><Sparkles size={18} /> Child Adherence Guide</h3>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                Welcome back! Please review your daily medication checklist on the right. 
              </p>
              
              {/* Next Dose Countdown Badge */}
              {(() => {
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                let nextMed = null;
                let minDiff = 999999;
                
                medications.forEach(m => {
                  const parts = (m.schedule_time || "").split(':');
                  if (parts.length === 2) {
                    const medMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    let diff = medMins - currentMins;
                    if (diff < 0) diff += 1440;
                    if (diff < minDiff) {
                      minDiff = diff;
                      nextMed = { ...m, diffMins: diff };
                    }
                  }
                });

                if (!nextMed) return null;
                const hours = Math.floor(nextMed.diffMins / 60);
                const mins = nextMed.diffMins % 60;
                const timeLabel = nextMed.diffMins === 0 ? "Due Right Now!" : `${hours > 0 ? `${hours}h ` : ''}${mins}m`;

                return (
                  <div style={{ marginTop: '0.85rem', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.65rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
                      ⏰ Next Dose: <strong>{nextMed.name}</strong> ({nextMed.dosage})
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.5px' }}>
                      {timeLabel}
                    </span>
                  </div>
                );
              })()}

              <div style={{ marginTop: '1rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                🔔 <strong>How it works:</strong> The alarm will ring automatically when it is time to take your pill. Tapping <strong>Stop Alarm</strong> opens the camera automatically. Simply scan the pill to report to your parent!
              </div>
            </div>
          ) : (
            <>
              {/* Household Family Code Card for Parent */}
              <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(2, 132, 199, 0.05))', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>
                      👨‍👩‍👧 Household Family Code
                    </span>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#38bdf8', letterSpacing: '2px', marginTop: '0.2rem' }}>
                      {currentUser?.family_id || 'FAM-DEFAULT'}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Share this code with your child during sign-up so their app links to this schedule.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentUser?.family_id || 'FAM-DEFAULT');
                      alert(`Copied Family Code: ${currentUser?.family_id || 'FAM-DEFAULT'}`);
                    }}
                    style={{
                      background: 'rgba(14, 165, 233, 0.25)',
                      border: '1px solid #0ea5e9',
                      color: '#38bdf8',
                      borderRadius: '10px',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy Code
                  </button>
                </div>
              </div>

              <div className="glass-card">
                <h3 className="card-title"><Plus size={18} /> Schedule Medication</h3>
                <form onSubmit={handleAddMedication}>
                  <div className="form-group">
                    <label>Medication Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Lipitor, Metformin" 
                      value={newMedName}
                      onChange={(e) => setNewMedName(e.target.value)}
                      required
                    />
                  </div>


                <div className="form-group">
                  <label>Dosage</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. 10mg, 1 tablet" 
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Schedule Time (24h)</label>
                  <input 
                    type="time" 
                    className="form-control" 
                    value={newMedTime}
                    onChange={(e) => setNewMedTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Special Instructions (Optional)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Take with food, Avoid milk" 
                    value={newMedInstruction}
                    onChange={(e) => setNewMedInstruction(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Add to Schedule
                </button>
              </form>
            </div>
            </>
          )}


          {/* Parent Alert Email Configuration Card */}
          {currentUser?.role === 'parent' && (
            <div className="glass-card" style={{ marginTop: '-1rem', background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.15)' }}>
              <h3 className="card-title" style={{ color: 'var(--color-accent)' }}><Bell size={18} /> Email Notification Alerts</h3>
              <form onSubmit={handleSaveEmail}>
                <div className="form-group">
                  <label>Parent's Registered Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="e.g. parent@example.com" 
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Alerts are sent to this address immediately if a dose is skipped or missed.
                  </span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-accent)', width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                  Save Email Address
                </button>
              </form>
            </div>
          )}


          {/* Scheduled Medications Inventory List */}
          <div className="glass-card">
            <h3 className="card-title"><Pill size={18} /> Daily Regimen List</h3>
            <div className="medication-list">
              {medications.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                  No medications scheduled. Add one above!
                </p>
              ) : (
                medications.map(med => (
                  <div className="medication-item" key={med.id}>
                    <div className="medication-info">
                      <h4>{med.name}</h4>
                      <p>{med.dosage} • <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>{med.schedule_time}</span></p>
                      {med.instruction && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instructions: {med.instruction}</p>}
                    </div>
                    {currentUser?.role === 'parent' && (
                      <button className="btn-icon-delete" onClick={() => handleDeleteMedication(med.id)} title="Delete Medication">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Active Logs & Visual Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Today's Checklist */}
          <div className="glass-card">
            <h3 className="card-title"><Clock size={18} /> Today's Ingestion Timeline</h3>
            <div className="schedule-checklist">
              {todayChecklist.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                  Your scheduled medicines will show up here. Add a medication to start tracking!
                </p>
              ) : (
                todayChecklist.map(item => (
                  <div key={item.id} className={`schedule-item ${item.status}`}>
                    <div className="schedule-details">
                      <div className="schedule-time-badge">{item.schedule_time}</div>
                      <div className="schedule-title">{item.name}</div>
                      <div className="schedule-meta">
                        {item.dosage} {item.instruction ? `• ${item.instruction}` : ''}
                      </div>
                      
                      {/* Show verification tags */}
                      {item.status === 'taken' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: item.is_verified === 1 ? 'var(--color-accent)' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <Sparkles size={12} />
                            <span>{item.verification_msg || (item.is_verified === 1 ? "AI verified" : "Logged manually")}</span>
                          </div>
                          {/* Show captured pill photo for parent view */}
                          {currentUser?.role === 'parent' && item.image_data && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <img 
                                src={item.image_data} 
                                alt="Pill verification photo" 
                                style={{ 
                                  width: '120px', 
                                  height: '90px', 
                                  objectFit: 'cover', 
                                  borderRadius: '8px', 
                                  border: '2px solid rgba(56, 189, 248, 0.3)',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setExpandedPhoto(item.image_data)}
                              />
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                <Eye size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> Click to enlarge
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="schedule-actions">
                      {item.status === 'pending' ? (
                        currentUser?.role === 'child' ? (
                          <>
                            <button className="btn-action btn-action-take" onClick={() => handleLogAdherence(item.id, 'taken', 0, "Self-logged")}>
                              Take
                            </button>
                            
                            <button className="btn-action btn-action-verify" onClick={() => setSelectedMedForCamera(item)}>
                              <Camera size={14} /> Scan
                            </button>
                            
                            <button className="btn-action btn-action-miss" onClick={() => handleLogAdherence(item.id, 'missed')}>
                              Miss
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending child action</span>
                        )
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: item.status === 'taken' ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                          {item.status === 'taken' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          <span style={{ textTransform: 'capitalize' }}>{item.status}</span>
                          
                          {currentUser?.role === 'child' && (
                            <button 
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '0.5rem' }}
                              onClick={() => handleLogAdherence(item.id, 'pending')}
                              title="Reset Log"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Adherence Graph & Analytics */}
          <div className="glass-card">
            <h3 className="card-title"><Calendar size={18} /> Adherence Analytics (7-Day Overview)</h3>
            
            <div className="compliance-tracker">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Overall Progress</span>
                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{stats.compliance}% Compliance</span>
              </div>
              
              <div className="compliance-bar-wrapper">
                <div className="compliance-bar" style={{ width: `${stats.compliance}%` }}>
                  {stats.compliance > 10 ? `${stats.compliance}%` : ''}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                Daily Compliance History
              </div>
              
              <div className="compliance-days-grid">
                {historyDays.map((day, idx) => (
                  <div className="compliance-day-col" key={idx}>
                    <span className="compliance-day-label">{day.name}</span>
                    <div className={`compliance-day-status ${day.status}`}>
                      {day.status === 'taken' ? '✓' : day.status === 'missed' ? '✗' : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pill Camera Verification Modal */}
      {selectedMedForCamera && (
        <PillCamera 
          medicationName={selectedMedForCamera.name}
          onClose={() => setSelectedMedForCamera(null)}
          onVerified={(status, isVerified, msg, imageData) => handleLogAdherence(selectedMedForCamera.id, status, isVerified ? 1 : 0, msg, imageData)}
        />
      )}

      {/* Floating Sound Alarm Banner */}
      {activeAlarm && (
        <div className="alarm-overlay">
          <div className="alarm-card">
            <div className="alarm-icon-wrapper">
              <Clock size={36} style={{ animation: 'spin 2s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>
              MEDICATION ALARM!
            </h2>
            <p style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Time to take: {activeAlarm.name}
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Dosage: {activeAlarm.dosage} • {activeAlarm.instruction || 'No special instruction'}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-success" onClick={() => handleAlarmAction('taken')}>
                Take Medication (Open Camera)
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={handleSnoozeAlarm} style={{ flex: 1 }}>
                  Snooze
                </button>
                <button className="btn btn-danger" onClick={() => handleAlarmAction('missed')} style={{ flex: 1 }}>
                  Mark Missed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Chatbot Widget */}
      <div className="chat-widget">
        {!isChatOpen ? (
          <button className="chat-bubble-btn" onClick={() => setIsChatOpen(true)}>
            <MessageSquare size={26} />
          </button>
        ) : (
          <div className="chat-window">
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="chat-status-dot"></div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Health Assistant</h4>
              </div>
              <button className="close-btn" onClick={() => setIsChatOpen(false)} style={{ color: 'var(--text-primary)' }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div className={`chat-message ${msg.role}`} key={idx}>
                  {msg.text}
                </div>
              ))}
              {isTyping && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
              <input 
                type="text" 
                placeholder="Ask about side effects, instructions..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isTyping}
              />
              <button type="submit" className="chat-send-btn" disabled={isTyping}>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Photo Lightbox Modal */}
      {expandedPhoto && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, cursor: 'pointer'
          }}
          onClick={() => setExpandedPhoto(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={expandedPhoto} 
              alt="Pill verification - enlarged" 
              style={{ 
                maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', 
                borderRadius: '12px', border: '3px solid rgba(56, 189, 248, 0.4)' 
              }} 
            />
            <button 
              onClick={() => setExpandedPhoto(null)}
              style={{
                position: 'absolute', top: '-12px', right: '-12px',
                background: 'rgba(239, 68, 68, 0.9)', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff'
              }}
            >
              <X size={16} />
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              <ImageIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Child's medication verification photo — captured via AI Pill Scanner
            </div>
          </div>
        </div>
      )}

      {/* Parent Notification Toasts */}
      {parentNotifications.length > 0 && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          zIndex: 9999, maxWidth: '360px'
        }}>
          {parentNotifications.map(notif => (
            <div key={notif.id} style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              color: '#fff',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)',
              animation: 'slideInRight 0.4s ease-out',
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
            }}>
              <Bell size={20} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>
                  ⚠️ {notif.title}
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>{notif.message}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.25rem' }}>{notif.time}</div>
              </div>
              <button 
                onClick={() => setParentNotifications(prev => prev.filter(n => n.id !== notif.id))}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

