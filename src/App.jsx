import { useState, useEffect, useCallback, useRef } from "react";

// ── localStorage helper (device-local only) ──
function loadLocal(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Cloud storage helpers (Vercel Blob via API route) ──
const CLOUD_API = '/api/data';

async function loadCloud() {
  try {
    const res = await fetch(CLOUD_API);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveCloudData(data) {
  try {
    await fetch(CLOUD_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error('Cloud save failed:', e);
  }
}

const INITIAL_USERS = [
  { id: 1, name: "Alice Tan", role: "staff", avatar: "AT", grade: "Operator" },
  { id: 2, name: "Bob Lee", role: "staff", avatar: "BL", grade: "Intermediate" },
  { id: 3, name: "Carol Ng", role: "manager", avatar: "CN", grade: "Operator" },
  { id: 4, name: "David Koh", role: "staff", avatar: "DK", grade: "Trainee" },
  { id: 5, name: "Eve Lim", role: "admin", avatar: "EL", grade: "Operator" },
];

const LEAVE_TYPES = ["Annual / Paid Leave", "Conference Leave"];
const STATUS_COLORS = {
  Pending:  { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", border: "border-yellow-300" },
  Approved: { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  border: "border-green-300"  },
  Rejected: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400",    border: "border-red-300"    },
};
const DUTY_STATUS_COLORS = {
  Pending:  { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", border: "border-yellow-300" },
  Approved: { bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500",border: "border-emerald-300"},
  Rejected: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400",    border: "border-red-300"    },
};
const USER_COLORS = ["bg-blue-500","bg-purple-500","bg-pink-500","bg-indigo-500","bg-teal-500","bg-orange-500","bg-rose-500","bg-cyan-500","bg-lime-600","bg-amber-600"];
const LEAVE_TYPE_COLORS = { "Annual / Paid Leave": "bg-blue-100 text-blue-800", "Conference Leave": "bg-purple-100 text-purple-800" };
const ROLES = ["staff","manager","admin"];
const GRADES = ["Operator","Intermediate","Trainee"];
const today = new Date();

const initialLeaves = [
  { id:1, userId:1, type:"Annual / Paid Leave", start:"2026-02-10", end:"2026-02-12", status:"Approved", reason:"Family vacation",      submittedAt:"2026-02-01" },
  { id:2, userId:2, type:"Conference Leave",    start:"2026-02-18", end:"2026-02-20", status:"Approved", reason:"Tech Summit 2026",      submittedAt:"2026-02-05" },
  { id:3, userId:4, type:"Annual / Paid Leave", start:"2026-02-24", end:"2026-02-25", status:"Pending",  reason:"Personal errands",      submittedAt:"2026-02-14" },
  { id:4, userId:1, type:"Conference Leave",    start:"2026-03-05", end:"2026-03-07", status:"Pending",  reason:"Marketing conference",  submittedAt:"2026-02-13" },
  { id:5, userId:2, type:"Annual / Paid Leave", start:"2026-03-10", end:"2026-03-11", status:"Rejected", reason:"Spring break",          submittedAt:"2026-02-10" },
];

const initialDuties = [
  { id:1, userId:1, date:"2026-02-28", reason:"Cover evening shift for David", status:"Pending",  submittedAt:"2026-02-15" },
  { id:2, userId:2, date:"2026-03-02", reason:"Weekend server maintenance",    status:"Approved", submittedAt:"2026-02-14" },
];

function getInitials(name) { return name.split(" ").map(p=>p[0]).join("").toUpperCase().slice(0,2); }
function fmtDate(d) { return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }
function getDays(y,m) { return new Date(y,m+1,0).getDate(); }
function getFirst(y,m) { return new Date(y,m,1).getDay(); }
function inRange(d,s,e) { return d>=s && d<=e; }
function toStr(y,m,d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function colorFor(id) { return USER_COLORS[(id-1)%USER_COLORS.length]; }

const FInput = ({label,type="text",value,onChange,placeholder,hint,autoFocus,min}) => (
  <div>
    <label className="text-sm font-semibold text-gray-600 block mb-1">{label}</label>
    {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
    <input autoFocus={autoFocus} type={type} value={value} min={min}
      onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
  </div>
);
const FSelect = ({label,value,onChange,options}) => (
  <div>
    <label className="text-sm font-semibold text-gray-600 block mb-1">{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
      {options.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
    </select>
  </div>
);

// ── Confirm dialog ──
const ConfirmModal = ({title,message,onConfirm,onCancel,danger=true}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${danger?"bg-red-100":"bg-yellow-100"}`}>
        <svg className={`w-6 h-6 ${danger?"text-red-500":"text-yellow-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 className="font-bold text-gray-800 text-base text-center mb-1">{title}</h3>
      <p className="text-sm text-gray-500 text-center mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
        <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white ${danger?"bg-red-500 hover:bg-red-600":"bg-yellow-500 hover:bg-yellow-600"}`}>
          {danger?"Delete":"Confirm"}
        </button>
      </div>
    </div>
  </div>
);

export default function App() {
  const [users, setUsers]       = useState([]);
  const [passwords, setPasswords] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [leaves, setLeaves]     = useState([]);
  const [duties, setDuties]     = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [view, setView]         = useState("calendar");
  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [showRequest, setShowRequest] = useState(false);
  const [showDuty, setShowDuty] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [form, setForm]         = useState({type:LEAVE_TYPES[0],start:"",end:"",reason:""});
  const [dutyForm, setDutyForm] = useState({date:"",reason:""});
  const [formErr, setFormErr]   = useState("");
  const [dutyErr, setDutyErr]   = useState("");
  const [filter, setFilter]     = useState("All");
  const [dutyFilter, setDutyFilter] = useState("All");
  const [notif, setNotif]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaveTab, setLeaveTab] = useState("leaves"); // "leaves" | "duties" in My Leaves

  // confirm delete
  const [confirmDel, setConfirmDel] = useState(null); // {type:"leave"|"duty", id, msg}

  // switch user
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switchPw, setSwitchPw]   = useState("");
  const [switchErr, setSwitchErr] = useState("");

  // profile
  const [showProfile, setShowProfile] = useState(false);
  const [profName, setProfName]   = useState("");
  const [profPwCur, setProfPwCur] = useState("");
  const [profPwNew, setProfPwNew] = useState("");
  const [profPwCon, setProfPwCon] = useState("");
  const [profErr, setProfErr]     = useState("");
  const [profOk, setProfOk]       = useState("");

  // add/edit user
  const [showAdd, setShowAdd]   = useState(false);
  const [newUser, setNewUser]   = useState({name:"",role:"staff",grade:"Operator"});
  const [newErr, setNewErr]     = useState("");
  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editErr, setEditErr]   = useState("");

  // admin expanded user
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [adminLeaveFilter, setAdminLeaveFilter] = useState("All");

  // ── Cloud sync refs ──
  const saveTimerRef = useRef(null);
  const skipSaveRef = useRef(true);      // skip save on initial mount
  const lastSaveRef = useRef(0);         // timestamp of last cloud save

  // ── Load from cloud on mount ──
  useEffect(() => {
    loadCloud().then(data => {
      // Use cloud data if available, otherwise fall back to hardcoded defaults (first-ever load)
      const cloudUsers    = data?.users?.length ? data.users : INITIAL_USERS;
      const cloudPasswords = data?.passwords ?? {};
      const cloudLeaves   = data?.leaves ?? initialLeaves;
      const cloudDuties   = data?.duties ?? initialDuties;
      const cloudAuditLog = data?.auditLog ?? [];

      setUsers(cloudUsers);
      setPasswords(cloudPasswords);
      setLeaves(cloudLeaves);
      setDuties(cloudDuties);
      setAuditLog(cloudAuditLog);

      // Restore currentUser from cloud user list + local device preference
      const savedId = loadLocal('leavesync_currentUserId', null);
      const found = savedId && cloudUsers.find(u => u.id === savedId);
      setCurrentUser(found || cloudUsers[0]);

      setCloudLoading(false);
      // Allow saves after initial load settles
      setTimeout(() => { skipSaveRef.current = false; }, 500);
    });
  }, []);

  // ── Persist currentUserId locally (device-specific) ──
  useEffect(() => { if (currentUser) saveLocal('leavesync_currentUserId', currentUser.id); }, [currentUser]);

  // ── Debounced save to cloud on every shared-state change ──
  useEffect(() => {
    if (cloudLoading || skipSaveRef.current) return;
    // Don't save if state is still empty (pre-cloud-load)
    if (!users.length || !currentUser) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSaveRef.current = Date.now();
      saveCloudData({ users, passwords, leaves, duties, auditLog });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [users, passwords, leaves, duties, auditLog, cloudLoading, currentUser]);

  // ── Poll for updates from other users every 5 seconds ──
  useEffect(() => {
    if (cloudLoading) return;
    const interval = setInterval(async () => {
      // Don't poll if we just saved (avoid echo)
      if (Date.now() - lastSaveRef.current < 3000) return;
      const data = await loadCloud();
      if (!data) return;
      // Only update state if data actually changed (prevents save loop)
      skipSaveRef.current = true;
      setUsers(prev =>  JSON.stringify(prev) !== JSON.stringify(data.users || prev) ? (data.users || prev) : prev);
      setPasswords(prev => JSON.stringify(prev) !== JSON.stringify(data.passwords ?? prev) ? (data.passwords ?? prev) : prev);
      setLeaves(prev => JSON.stringify(prev) !== JSON.stringify(data.leaves || prev) ? (data.leaves || prev) : prev);
      setDuties(prev => JSON.stringify(prev) !== JSON.stringify(data.duties || prev) ? (data.duties || prev) : prev);
      setAuditLog(prev => JSON.stringify(prev) !== JSON.stringify(data.auditLog || prev) ? (data.auditLog || prev) : prev);
      // Also update currentUser if their profile changed in cloud
      setCurrentUser(prev => {
        const updated = (data.users || []).find(u => u.id === prev.id);
        return updated && JSON.stringify(updated) !== JSON.stringify(prev) ? updated : prev;
      });
      setTimeout(() => { skipSaveRef.current = false; }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, [cloudLoading]);

  const addLog = useCallback((action, details) => {
    setAuditLog(prev => [{ id: Date.now(), userId: currentUser.id, userName: currentUser.name, action, details, timestamp: new Date().toISOString() }, ...prev].slice(0, 500));
  }, [currentUser]);

  const notify = (msg,color="green") => { setNotif({msg,color}); setTimeout(()=>setNotif(null),3000); };

  // ── Switch user ──
  function attemptSwitch(u) {
    if(u.id===currentUser.id) return;
    if(passwords[u.id]) { setSwitchTarget(u); setSwitchPw(""); setSwitchErr(""); }
    else doSwitch(u);
  }
  function doSwitch(u) { addLog("Switched user", `Switched to ${u.name}`); setCurrentUser(u); setView("calendar"); setFilter("All"); setDutyFilter("All"); setSidebarOpen(false); setSwitchTarget(null); }
  function confirmSwitch() {
    if(switchPw===passwords[switchTarget.id]) doSwitch(switchTarget);
    else setSwitchErr("Incorrect password. Please try again.");
  }

  // ── Profile ──
  function openProfile() { setProfName(currentUser.name); setProfErr(""); setProfOk(""); setProfPwCur(""); setProfPwNew(""); setProfPwCon(""); setShowProfile(true); }
  function saveProfile() {
    setProfErr(""); setProfOk("");
    const n=profName.trim();
    if(!n||n.length<2) return setProfErr("Name must be at least 2 characters.");
    if(profPwNew||profPwCon||profPwCur) {
      const cur=passwords[currentUser.id]||"";
      if(profPwCur!==cur) return setProfErr("Current password is incorrect.");
      if(profPwNew.length<4) return setProfErr("New password must be at least 4 characters.");
      if(profPwNew!==profPwCon) return setProfErr("Passwords do not match.");
      setPasswords(p=>({...p,[currentUser.id]:profPwNew}));
      addLog("Password changed", `${currentUser.name} changed their password`);
    }
    const updated={...currentUser,name:n,avatar:getInitials(n)};
    if(n !== currentUser.name) addLog("Name changed", `Changed name from "${currentUser.name}" to "${n}"`);
    setUsers(p=>p.map(u=>u.id===currentUser.id?updated:u));
    setCurrentUser(updated);
    setProfOk("Profile saved!"); setProfPwCur(""); setProfPwNew(""); setProfPwCon("");
  }

  // ── Add / Edit / Remove user ──
  function addUser() {
    setNewErr("");
    const n=newUser.name.trim();
    if(!n||n.length<2) return setNewErr("Name must be at least 2 characters.");
    const maxId=Math.max(...users.map(u=>u.id));
    const u={id:maxId+1,name:n,role:newUser.role,grade:newUser.grade,avatar:getInitials(n)};
    setUsers(p=>[...p,u]); setShowAdd(false); setNewUser({name:"",role:"staff",grade:"Operator"});
    addLog("User added", `Added new user: ${u.name} (${u.role}, ${u.grade})`);
    notify(`${u.name} added!`);
  }
  function openEdit(u) { setEditUser(u); setEditName(u.name); setEditRole(u.role); setEditDept(u.grade); setEditErr(""); }
  function saveEdit() {
    setEditErr("");
    const n=editName.trim();
    if(!n||n.length<2) return setEditErr("Name must be at least 2 characters.");
    const updated={...editUser,name:n,role:editRole,grade:editDept,avatar:getInitials(n)};
    setUsers(p=>p.map(u=>u.id===editUser.id?updated:u));
    if(currentUser.id===editUser.id) setCurrentUser(updated);
    addLog("User edited", `Edited ${editUser.name}: name=${n}, role=${editRole}, grade=${editDept}`);
    setEditUser(null); notify("User updated!");
  }
  function removeUser(uid) {
    if(uid===currentUser.id) return notify("Cannot delete yourself!","red");
    const removedName = users.find(u=>u.id===uid)?.name || "Unknown";
    setUsers(p=>p.filter(u=>u.id!==uid));
    setLeaves(p=>p.filter(l=>l.userId!==uid));
    setDuties(p=>p.filter(d=>d.userId!==uid));
    addLog("User removed", `Removed user: ${removedName}`);
    notify("User removed.");
  }

  // ── Leave CRUD ──
  function submitLeave() {
    setFormErr("");
    if(!form.start||!form.end) return setFormErr("Please select start and end dates.");
    if(form.end<form.start) return setFormErr("End date must be after start date.");
    if(!form.reason.trim()) return setFormErr("Please provide a reason.");
    setLeaves(p=>[...p,{id:Date.now(),userId:currentUser.id,type:form.type,start:form.start,end:form.end,status:"Pending",reason:form.reason,submittedAt:new Date().toISOString().split("T")[0]}]);
    addLog("Leave requested", `${form.type}: ${form.start} to ${form.end} — ${form.reason}`);
    setShowRequest(false); setForm({type:LEAVE_TYPES[0],start:"",end:"",reason:""}); notify("Leave request submitted!");
  }
  function actLeave(id,status) {
    const leave = leaves.find(l=>l.id===id);
    const owner = leave ? getU(leave.userId) : null;
    setLeaves(p=>p.map(l=>l.id===id?{...l,status}:l));
    addLog(`Leave ${status.toLowerCase()}`, `${status} ${owner?.name || "user"}'s ${leave?.type || "leave"}: ${leave?.start} to ${leave?.end}`);
    notify(status==="Approved"?"Approved ✓":"Rejected",status==="Approved"?"green":"red");
  }
  function deleteLeave(id) {
    const leave = leaves.find(l=>l.id===id);
    const owner = leave ? getU(leave.userId) : null;
    setLeaves(p=>p.filter(l=>l.id!==id)); setConfirmDel(null);
    addLog("Leave deleted", `Deleted ${owner?.name || "user"}'s ${leave?.type || "leave"}: ${leave?.start} to ${leave?.end}`);
    notify("Leave removed.");
  }

  // ── Duty CRUD ──
  function submitDuty() {
    setDutyErr("");
    if(!dutyForm.date) return setDutyErr("Please select a date.");
    if(!dutyForm.reason.trim()) return setDutyErr("Please provide a reason.");
    setDuties(p=>[...p,{id:Date.now(),userId:currentUser.id,date:dutyForm.date,reason:dutyForm.reason,status:"Pending",submittedAt:new Date().toISOString().split("T")[0]}]);
    addLog("Duty requested", `Duty on ${dutyForm.date} — ${dutyForm.reason}`);
    setShowDuty(false); setDutyForm({date:"",reason:""}); notify("Duty request submitted!");
  }
  function actDuty(id,status) {
    const duty = duties.find(d=>d.id===id);
    const owner = duty ? getU(duty.userId) : null;
    setDuties(p=>p.map(d=>d.id===id?{...d,status}:d));
    addLog(`Duty ${status.toLowerCase()}`, `${status} ${owner?.name || "user"}'s duty on ${duty?.date}`);
    notify(status==="Approved"?"Duty approved ✓":"Duty rejected",status==="Approved"?"green":"red");
  }
  function deleteDuty(id) {
    const duty = duties.find(d=>d.id===id);
    const owner = duty ? getU(duty.userId) : null;
    setDuties(p=>p.filter(d=>d.id!==id)); setConfirmDel(null);
    addLog("Duty deleted", `Deleted ${owner?.name || "user"}'s duty on ${duty?.date}`);
    notify("Duty removed.");
  }

  // ── Calendar helpers ──
  const myLeaves = leaves.filter(l=>l.userId===currentUser?.id);
  const myDuties = duties.filter(d=>d.userId===currentUser?.id);
  const pendingLeaves = leaves.filter(l=>l.status==="Pending");
  const pendingDuties = duties.filter(d=>d.status==="Pending");
  const totalPending  = pendingLeaves.length + pendingDuties.length;
  const daysInMonth   = getDays(calYear,calMonth);
  const firstDay      = getFirst(calYear,calMonth);
  const monthName     = new Date(calYear,calMonth,1).toLocaleString("default",{month:"long"});
  const getDayLeaves  = d=>leaves.filter(l=>l.status==="Approved"&&inRange(d,l.start,l.end));
  const getU          = id=>users.find(u=>u.id===id);
  const prevM = ()=>calMonth===0?(setCalMonth(11),setCalYear(y=>y-1)):setCalMonth(m=>m-1);
  const nextM = ()=>calMonth===11?(setCalMonth(0),setCalYear(y=>y+1)):setCalMonth(m=>m+1);

  const balance = {
    "Annual / Paid Leave":{total:14,used:myLeaves.filter(l=>l.type==="Annual / Paid Leave"&&l.status==="Approved").length},
    "Conference Leave":   {total:5, used:myLeaves.filter(l=>l.type==="Conference Leave"   &&l.status==="Approved").length},
  };

  const filtLeaves = myLeaves.filter(l=>filter==="All"||l.status===filter);
  const filtDuties = myDuties.filter(d=>dutyFilter==="All"||d.status===dutyFilter);

  const navItems = [
    {key:"calendar",  label:"Team Calendar", icon:"M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"},
    {key:"my-leaves", label:"My Requests",   icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"},
    ...((currentUser?.role==="manager"||currentUser?.role==="admin")?[{key:"approvals",label:"Approvals",icon:"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",badge:totalPending}]:[]),
    ...(currentUser?.role==="admin"?[{key:"admin",label:"Admin Panel",icon:"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197"}]:[]),
    ...(currentUser?.role==="admin"?[{key:"audit-log",label:"Audit Log",icon:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",badge:auditLog.length>0?auditLog.length:undefined}]:[]),
  ];

  // ── SIDEBAR ──
  const Sidebar = () => (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <span className="font-bold text-gray-800">LeaveSync</span>
      </div>
      <div className="p-3 border-b border-gray-100" style={{maxHeight:"240px",overflowY:"auto"}}>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-semibold">Switch User</p>
        {users.map(u=>(
          <button key={u.id} onClick={()=>attemptSwitch(u)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-all ${currentUser.id===u.id?"bg-indigo-50 text-indigo-700 font-semibold":"text-gray-600 hover:bg-gray-50"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${colorFor(u.id)}`}>{u.avatar}</div>
            <div className="text-left min-w-0 flex-1"><div className="truncate">{u.name}</div><div className="text-xs text-gray-400 capitalize">{u.role}</div></div>
            {passwords[u.id]&&<svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
          </button>
        ))}
      </div>
      <nav className="p-3 flex-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-semibold">Navigation</p>
        {navItems.map(item=>(
          <button key={item.key} onClick={()=>{setView(item.key);setSidebarOpen(false);}}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-all ${view===item.key?"bg-indigo-600 text-white shadow":"text-gray-600 hover:bg-gray-100"}`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon}/></svg>
            <span className="flex-1 text-left text-sm">{item.label}</span>
            {item.badge>0&&<span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button onClick={openProfile} className="w-full flex items-center gap-2 bg-gray-50 hover:bg-indigo-50 rounded-xl p-2 transition-all group">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${colorFor(currentUser.id)}`}>{currentUser.avatar}</div>
          <div className="min-w-0 flex-1 text-left"><div className="text-xs font-semibold text-gray-800 truncate">{currentUser.name}</div><div className="text-xs text-gray-400 capitalize">{currentUser.role}</div></div>
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
      </div>
    </div>
  );

  if (cloudLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50" style={{fontFamily:"system-ui,sans-serif"}}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-gray-500 text-sm font-medium">Loading from cloud…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{fontFamily:"system-ui,sans-serif"}}>
      {notif&&<div className={`fixed top-3 right-3 z-50 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium ${notif.color==="green"?"bg-green-500":"bg-red-500"}`}>{notif.msg}</div>}

      <div className="hidden md:flex flex-shrink-0"><Sidebar/></div>
      {sidebarOpen&&(
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={()=>setSidebarOpen(false)}/>
          <div className="relative z-50 w-56"><Sidebar/></div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100" onClick={()=>setSidebarOpen(true)}>
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-800">{{calendar:"Team Calendar","my-leaves":"My Requests",approvals:"Approvals",admin:"Admin Panel","audit-log":"Audit Log"}[view]}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">{{calendar:"Approved leaves shown","my-leaves":"Your leave & duty requests",approvals:"Review pending requests",admin:"Manage users & settings","audit-log":"History of all changes"}[view]}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {(view==="calendar"||view==="my-leaves") && (
              <>
                {/* Duty Request */}
                <button onClick={()=>{setDutyForm({date:"",reason:""});setDutyErr("");setShowDuty(true);}}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-sm font-semibold shadow transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                  <span className="hidden sm:inline">Duty Request</span>
                  <span className="sm:hidden">Duty</span>
                </button>
                {/* Leave Request */}
                <button onClick={()=>{setForm({type:LEAVE_TYPES[0],start:"",end:"",reason:""});setFormErr("");setShowRequest(true);}}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-semibold shadow transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  <span className="hidden sm:inline">Request Leave</span>
                  <span className="sm:hidden">Leave</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ══ CALENDAR ══ */}
          {view==="calendar"&&(
            <div className="space-y-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <button onClick={prevM} className="p-1.5 hover:bg-gray-100 rounded-lg"><svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
                  <h2 className="text-base font-bold text-gray-800">{monthName} {calYear}</h2>
                  <button onClick={nextM} className="p-1.5 hover:bg-gray-100 rounded-lg"><svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
                </div>
                <div className="grid grid-cols-7 border-b bg-gray-50">
                  {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`} className="h-16 sm:h-20 border-b border-r border-gray-50 bg-gray-50/30"/>)}
                  {Array.from({length:daysInMonth}).map((_,i)=>{
                    const day=i+1,ds=toStr(calYear,calMonth,day),dl=getDayLeaves(ds);
                    const isToday=ds===today.toISOString().split("T")[0];
                    return(
                      <div key={day} onClick={()=>dl.length>0&&setSelectedDay({ds,dl})}
                        className={`h-16 sm:h-20 border-b border-r border-gray-100 p-1.5 transition-colors ${dl.length>0?"cursor-pointer hover:bg-indigo-50":""}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${isToday?"bg-indigo-600 text-white":"text-gray-600"}`}>{day}</div>
                        {dl.slice(0,2).map(l=><div key={l.id} className={`text-xs px-1 py-0.5 rounded truncate font-medium mb-0.5 ${colorFor(l.userId)} text-white leading-tight`}>{getU(l.userId)?.name.split(" ")[0]}</div>)}
                        {dl.length>2&&<div className="text-xs text-gray-400">+{dl.length-2}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Team Members</p>
                <div className="flex flex-wrap gap-2">{users.map(u=><div key={u.id} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${colorFor(u.id)}`}/><span className="text-xs text-gray-600">{u.name}</span></div>)}</div>
              </div>
            </div>
          )}

          {/* ══ MY REQUESTS ══ */}
          {view==="my-leaves"&&(
            <div className="space-y-3">
              {/* Tab switch */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button onClick={()=>setLeaveTab("leaves")} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${leaveTab==="leaves"?"bg-white shadow text-indigo-700":"text-gray-500"}`}>
                  Leave Requests <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${leaveTab==="leaves"?"bg-indigo-100 text-indigo-600":"bg-gray-200 text-gray-500"}`}>{myLeaves.length}</span>
                </button>
                <button onClick={()=>setLeaveTab("duties")} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${leaveTab==="duties"?"bg-white shadow text-amber-600":"text-gray-500"}`}>
                  Duty Requests <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${leaveTab==="duties"?"bg-amber-100 text-amber-600":"bg-gray-200 text-gray-500"}`}>{myDuties.length}</span>
                </button>
              </div>

              {/* LEAVE tab */}
              {leaveTab==="leaves"&&(
                <>
                  <div className="flex gap-2 flex-wrap">{["All","Pending","Approved","Rejected"].map(s=><button key={s} onClick={()=>setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter===s?"bg-indigo-600 text-white shadow":"bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>{s}</button>)}</div>
                  {filtLeaves.length===0&&<div className="text-center py-10 text-gray-400"><div className="text-3xl mb-2">🗓️</div><p className="text-sm">No leave requests found</p></div>}
                  {filtLeaves.map(l=>{
                    const sc=STATUS_COLORS[l.status];
                    return(
                      <div key={l.id} className={`bg-white rounded-2xl border ${sc.border} shadow-sm p-4 flex items-start gap-3`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${sc.dot}`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEAVE_TYPE_COLORS[l.type]}`}>{l.type}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{l.status}</span>
                          </div>
                          <p className="text-sm text-gray-700 font-medium">{fmtDate(l.start)} → {fmtDate(l.end)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{l.reason}</p>
                        </div>
                        {/* Delete button */}
                        <button onClick={()=>setConfirmDel({type:"leave",id:l.id,msg:`Remove your ${l.type} on ${fmtDate(l.start)}?`})}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0" title="Remove leave">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              {/* DUTY tab */}
              {leaveTab==="duties"&&(
                <>
                  <div className="flex gap-2 flex-wrap">{["All","Pending","Approved","Rejected"].map(s=><button key={s} onClick={()=>setDutyFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${dutyFilter===s?"bg-amber-500 text-white shadow":"bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>{s}</button>)}</div>
                  {filtDuties.length===0&&<div className="text-center py-10 text-gray-400"><div className="text-3xl mb-2">📋</div><p className="text-sm">No duty requests found</p></div>}
                  {filtDuties.map(d=>{
                    const sc=DUTY_STATUS_COLORS[d.status];
                    return(
                      <div key={d.id} className={`bg-white rounded-2xl border ${sc.border} shadow-sm p-4 flex items-start gap-3`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${sc.dot}`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Duty</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{d.status}</span>
                          </div>
                          <p className="text-sm text-gray-700 font-medium">{fmtDate(d.date)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{d.reason}</p>
                        </div>
                        <button onClick={()=>setConfirmDel({type:"duty",id:d.id,msg:`Remove your duty request on ${fmtDate(d.date)}?`})}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0" title="Remove duty">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ══ APPROVALS ══ */}
          {view==="approvals"&&(currentUser.role==="manager"||currentUser.role==="admin")&&(
            <div className="space-y-4">
              {/* Leave approvals */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"/>Leave Requests
                  {pendingLeaves.length>0&&<span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingLeaves.length} pending</span>}
                </h3>
                <div className="flex gap-2 flex-wrap mb-2">{["All","Pending","Approved","Rejected"].map(s=><button key={s} onClick={()=>setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter===s?"bg-indigo-600 text-white shadow":"bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>{s}</button>)}</div>
                {(filter==="All"?leaves:leaves.filter(l=>l.status===filter)).length===0&&<div className="text-center py-6 text-gray-400 text-sm">No leave requests</div>}
                {(filter==="All"?leaves:leaves.filter(l=>l.status===filter)).map(l=>{
                  const u=getU(l.userId),sc=STATUS_COLORS[l.status];
                  return(
                    <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${colorFor(l.userId)}`}>{u?.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="font-semibold text-gray-800 text-sm">{u?.name}</span><span className="text-gray-400 text-xs">{u?.grade}</span></div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEAVE_TYPE_COLORS[l.type]}`}>{l.type}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{l.status}</span>
                          </div>
                          <p className="text-sm text-gray-700 font-medium">{fmtDate(l.start)} → {fmtDate(l.end)}</p>
                          <p className="text-xs text-gray-400">{l.reason}</p>
                        </div>
                      </div>
                      {l.status==="Pending"&&(
                        <div className="flex gap-2 mt-3 ml-12">
                          <button onClick={()=>actLeave(l.id,"Approved")} className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-all">✓ Approve</button>
                          <button onClick={()=>actLeave(l.id,"Rejected")} className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-sm font-semibold rounded-xl transition-all">✕ Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Duty approvals */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Duty Requests
                  {pendingDuties.length>0&&<span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingDuties.length} pending</span>}
                </h3>
                <div className="flex gap-2 flex-wrap mb-2">{["All","Pending","Approved","Rejected"].map(s=><button key={s} onClick={()=>setDutyFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${dutyFilter===s?"bg-amber-500 text-white shadow":"bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>{s}</button>)}</div>
                {(dutyFilter==="All"?duties:duties.filter(d=>d.status===dutyFilter)).length===0&&<div className="text-center py-6 text-gray-400 text-sm">No duty requests</div>}
                {(dutyFilter==="All"?duties:duties.filter(d=>d.status===dutyFilter)).map(d=>{
                  const u=getU(d.userId),sc=DUTY_STATUS_COLORS[d.status];
                  return(
                    <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${colorFor(d.userId)}`}>{u?.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1"><span className="font-semibold text-gray-800 text-sm">{u?.name}</span><span className="text-gray-400 text-xs">{u?.grade}</span></div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Duty</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{d.status}</span>
                          </div>
                          <p className="text-sm text-gray-700 font-medium">{fmtDate(d.date)}</p>
                          <p className="text-xs text-gray-400">{d.reason}</p>
                        </div>
                      </div>
                      {d.status==="Pending"&&(
                        <div className="flex gap-2 mt-3 ml-12">
                          <button onClick={()=>actDuty(d.id,"Approved")} className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-all">✓ Approve</button>
                          <button onClick={()=>actDuty(d.id,"Rejected")} className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-sm font-semibold rounded-xl transition-all">✕ Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ ADMIN ══ */}
          {view==="admin"&&currentUser.role==="admin"&&(
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"><div className="text-2xl font-bold text-indigo-600">{users.length}</div><div className="text-xs text-gray-500 mt-1">Staff</div></div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"><div className="text-2xl font-bold text-yellow-500">{totalPending}</div><div className="text-xs text-gray-500 mt-1">Pending</div></div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"><div className="text-2xl font-bold text-green-500">{leaves.filter(l=>l.status==="Approved").length}</div><div className="text-xs text-gray-500 mt-1">Approved</div></div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">Users & Leave Management</h3>
                <button onClick={()=>{setShowAdd(true);setNewUser({name:"",role:"staff",grade:"Operator"});setNewErr("");}}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                  Add User
                </button>
              </div>

              {users.map(u=>{
                const ul=leaves.filter(l=>l.userId===u.id);
                const ud=duties.filter(d=>d.userId===u.id);
                const isExpanded=expandedUserId===u.id;
                const filtUL=adminLeaveFilter==="All"?ul:ul.filter(l=>l.status===adminLeaveFilter);
                const filtUD=adminLeaveFilter==="All"?ud:ud.filter(d=>d.status===adminLeaveFilter);
                return(
                  <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* User row - clickable dropdown */}
                    <button onClick={()=>setExpandedUserId(isExpanded?null:u.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${colorFor(u.id)}`}>{u.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 text-sm truncate">{u.name}</span>
                          {passwords[u.id]&&<svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
                        </div>
                        <div className="text-xs text-gray-400">{u.grade} · <span className="capitalize">{u.role}</span></div>
                      </div>
                      <div className="flex gap-2 text-xs flex-shrink-0 mr-1">
                        <div className="text-center"><div className="font-bold text-green-500">{ul.filter(l=>l.status==="Approved").length}</div><div className="text-gray-400">OK</div></div>
                        <div className="text-center"><div className="font-bold text-yellow-500">{ul.filter(l=>l.status==="Pending").length+ud.filter(d=>d.status==="Pending").length}</div><div className="text-gray-400">Pend</div></div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <span onClick={e=>{e.stopPropagation();openEdit(u);}} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </span>
                        {u.id!==currentUser.id&&<span onClick={e=>{e.stopPropagation();removeUser(u.id);}} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </span>}
                        <span className={`p-1.5 text-gray-400 rounded-lg transition-all ${isExpanded?"rotate-180":""}`} style={{display:"inline-flex"}}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                        </span>
                      </div>
                    </button>

                    {/* Expanded leave list */}
                    {isExpanded&&(
                      <div className="border-t border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-600">Leave & Duty Records</span>
                          <div className="flex gap-1">
                            {["All","Pending","Approved","Rejected"].map(s=>(
                              <button key={s} onClick={()=>setAdminLeaveFilter(s)}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${adminLeaveFilter===s?"bg-indigo-600 text-white":"bg-white text-gray-500 border border-gray-200"}`}>{s}</button>
                            ))}
                          </div>
                        </div>

                        {/* Leave records */}
                        {filtUL.length===0&&filtUD.length===0&&(
                          <div className="text-center py-4 text-gray-400 text-xs">No records found</div>
                        )}
                        {filtUL.map(l=>{
                          const sc=STATUS_COLORS[l.status];
                          return(
                            <div key={l.id} className={`flex items-center gap-2 bg-white rounded-xl border ${sc.border} px-3 py-2.5 mb-1.5`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`}/>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLORS[l.type]}`}>{l.type}</span>
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{l.status}</span>
                                </div>
                                <p className="text-xs text-gray-600 font-medium mt-0.5">{fmtDate(l.start)} → {fmtDate(l.end)}</p>
                                <p className="text-xs text-gray-400 truncate">{l.reason}</p>
                              </div>
                              <button onClick={()=>setConfirmDel({type:"leave",id:l.id,msg:`Delete ${u.name}'s ${l.type}?`})}
                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          );
                        })}
                        {filtUD.map(d=>{
                          const sc=DUTY_STATUS_COLORS[d.status];
                          return(
                            <div key={d.id} className={`flex items-center gap-2 bg-white rounded-xl border ${sc.border} px-3 py-2.5 mb-1.5`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`}/>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Duty</span>
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{d.status}</span>
                                </div>
                                <p className="text-xs text-gray-600 font-medium mt-0.5">{fmtDate(d.date)}</p>
                                <p className="text-xs text-gray-400 truncate">{d.reason}</p>
                              </div>
                              <button onClick={()=>setConfirmDel({type:"duty",id:d.id,msg:`Delete ${u.name}'s duty on ${fmtDate(d.date)}?`})}
                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* ══ AUDIT LOG ══ */}
          {view==="audit-log"&&currentUser.role==="admin"&&(
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{auditLog.length} record{auditLog.length!==1?"s":""}</p>
                <div className="flex gap-2">
                  {auditLog.length>0&&<button onClick={()=>setConfirmDel({type:"audit",id:"all",msg:"Clear all audit log entries? This cannot be undone."})} className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Clear Log
                  </button>}
                  <button onClick={()=>{Object.values(STORAGE_KEYS).forEach(k=>localStorage.removeItem(k));window.location.reload();}} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl text-xs font-semibold transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Reset All Data
                  </button>
                </div>
              </div>
              {auditLog.length===0&&<div className="text-center py-10 text-gray-400"><div className="text-3xl mb-2">📝</div><p className="text-sm">No activity recorded yet</p></div>}
              {auditLog.map(log=>{
                const logUser = users.find(u=>u.id===log.userId);
                return(
                  <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${colorFor(log.userId)}`}>{logUser?.avatar || log.userName?.slice(0,2) || "??"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{log.userName || logUser?.name || "Unknown"}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{log.action}</span>
                      </div>
                      <p className="text-sm text-gray-600">{log.details}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(log.timestamp).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}        </div>
      </div>

      {/* ════════════ CONFIRM DELETE ════════════ */}
      {confirmDel&&(
        <ConfirmModal
          title="Delete Record"
          message={confirmDel.msg}
          onConfirm={()=>{
            if(confirmDel.type==="leave") deleteLeave(confirmDel.id);
            else if(confirmDel.type==="duty") deleteDuty(confirmDel.id);
            else if(confirmDel.type==="audit") { setAuditLog([]); setConfirmDel(null); notify("Audit log cleared."); }
          }}
          onCancel={()=>setConfirmDel(null)}
        />
      )}

      {/* ════════════ SWITCH USER ════════════ */}
      {switchTarget&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={()=>setSwitchTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 ${colorFor(switchTarget.id)}`}>{switchTarget.avatar}</div>
              <h3 className="font-bold text-gray-800 text-lg">{switchTarget.name}</h3>
              <p className="text-sm text-gray-400 capitalize">{switchTarget.role} · {switchTarget.grade}</p>
            </div>
            <FInput label="Password" type="password" value={switchPw} onChange={v=>{setSwitchPw(v);setSwitchErr("");}} placeholder="Enter password..." autoFocus={true}/>
            {switchErr&&<p className="text-red-500 text-xs mt-2 bg-red-50 rounded-lg px-3 py-2">{switchErr}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setSwitchTarget(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={confirmSwitch} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Login</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ PROFILE ════════════ */}
      {showProfile&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={()=>setShowProfile(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-5 text-white text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-2 border-2 border-white/30 ${colorFor(currentUser.id)}`}>{currentUser.avatar}</div>
              <p className="text-sm opacity-75 capitalize">{currentUser.role} · {currentUser.grade}</p>
              <h3 className="font-bold text-lg">My Profile</h3>
            </div>
            <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
              <FInput label="Display Name" value={profName} onChange={setProfName} placeholder="Your full name"/>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  Password <span className="text-xs font-normal text-gray-400">(optional)</span>
                </p>
                <div className="space-y-3">
                  <FInput label="Current Password" type="password" value={profPwCur} onChange={setProfPwCur} placeholder={passwords[currentUser.id]?"Enter current password":"No password set"} hint={!passwords[currentUser.id]?"Leave blank if setting for first time":""}/>
                  <FInput label="New Password" type="password" value={profPwNew} onChange={setProfPwNew} placeholder="Min. 4 characters"/>
                  <FInput label="Confirm New Password" type="password" value={profPwCon} onChange={setProfPwCon} placeholder="Repeat new password"/>
                </div>
              </div>
              {profErr&&<p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{profErr}</p>}
              {profOk&&<p className="text-green-600 text-sm bg-green-50 rounded-xl px-3 py-2">✓ {profOk}</p>}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={()=>setShowProfile(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Close</button>
              <button onClick={saveProfile} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ ADD USER ════════════ */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={()=>setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              Add New User
            </h3>
            <p className="text-xs text-gray-400 mb-4">User can set their own password after logging in</p>
            <div className="flex justify-center mb-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold ${colorFor(Math.max(...users.map(u=>u.id))+1)}`}>{newUser.name.trim()?getInitials(newUser.name):"?"}</div>
            </div>
            <div className="space-y-3">
              <FInput label="Full Name" value={newUser.name} onChange={v=>setNewUser(p=>({...p,name:v}))} placeholder="e.g. John Smith"/>
              <FSelect label="Role" value={newUser.role} onChange={v=>setNewUser(p=>({...p,role:v}))} options={ROLES}/>
              <FSelect label="Grade" value={newUser.grade} onChange={v=>setNewUser(p=>({...p,grade:v}))} options={GRADES}/>
              {newErr&&<p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{newErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowAdd(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={addUser} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Add User</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ EDIT USER ════════════ */}
      {editUser&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={()=>setEditUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-4">Edit User</h3>
            <div className="flex justify-center mb-4"><div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold ${colorFor(editUser.id)}`}>{editName.trim()?getInitials(editName):"?"}</div></div>
            <div className="space-y-3">
              <FInput label="Full Name" value={editName} onChange={setEditName} placeholder="Full name"/>
              <FSelect label="Role" value={editRole} onChange={setEditRole} options={ROLES}/>
              <FSelect label="Grade" value={editDept} onChange={setEditDept} options={GRADES}/>
              {editErr&&<p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{editErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setEditUser(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={saveEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DAY DETAIL ════════════ */}
      {selectedDay&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4" onClick={()=>setSelectedDay(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-3">{fmtDate(selectedDay.ds)}</h3>
            <div className="space-y-2">
              {selectedDay.dl.map(l=>{const u=getU(l.userId);return(
                <div key={l.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${colorFor(l.userId)}`}>{u?.avatar}</div>
                  <div><div className="text-sm font-semibold text-gray-800">{u?.name}</div><div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${LEAVE_TYPE_COLORS[l.type]}`}>{l.type}</div></div>
                </div>
              );})}
            </div>
            <button onClick={()=>setSelectedDay(null)} className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl font-medium text-sm">Close</button>
          </div>
        </div>
      )}

      {/* ════════════ REQUEST LEAVE ════════════ */}
      {showRequest&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4" onClick={()=>{setShowRequest(false);setFormErr("");}}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Request Leave
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1.5">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">{LEAVE_TYPES.map(t=><button key={t} onClick={()=>setForm(f=>({...f,type:t}))} className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${form.type===t?"border-indigo-500 bg-indigo-50 text-indigo-700":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>{t}</button>)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FInput label="Start Date" type="date" value={form.start} onChange={v=>setForm(f=>({...f,start:v}))}/>
                <FInput label="End Date" type="date" value={form.end} onChange={v=>setForm(f=>({...f,end:v}))}/>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1">Reason</label>
                <textarea rows={3} placeholder="Brief reason..." value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"/>
              </div>
              {formErr&&<p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{formErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setShowRequest(false);setFormErr("");}} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={submitLeave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DUTY REQUEST ════════════ */}
      {showDuty&&(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4" onClick={()=>{setShowDuty(false);setDutyErr("");}}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
              Duty Request
            </h3>
            <p className="text-xs text-gray-400 mb-4">Request to be assigned duty on a specific date</p>
            <div className="space-y-4">
              <FInput label="Duty Date" type="date" value={dutyForm.date} onChange={v=>setDutyForm(f=>({...f,date:v}))} min={today.toISOString().split("T")[0]}/>
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1">Reason / Details</label>
                <textarea rows={3} placeholder="Describe the duty you're requesting (e.g. cover evening shift, weekend maintenance)..."
                  value={dutyForm.reason} onChange={e=>setDutyForm(f=>({...f,reason:e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"/>
              </div>
              {dutyErr&&<p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{dutyErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setShowDuty(false);setDutyErr("");}} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={submitDuty} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-semibold text-sm shadow">Submit Duty Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}