import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, Video, Clock, Users, ArrowUpRight, ArrowDownLeft, 
  Calendar, PieChart, BarChart3, Activity, Users2, BrainCircuit,
  TrendingUp, Search, Filter, CalendarDays, MoreHorizontal,
  ChevronRight, ArrowLeft, Loader2, Sparkles, PhoneMissed, PhoneIncoming, PhoneOutgoing,
  ArrowRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { callService } from '../services/callService';
import { useAuth } from '../context/AuthContext';
import { CallSession } from '../types';
import { formatDistanceToNow, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type FilterType = 'all' | 'missed' | 'completed' | 'video' | 'audio';

export const CallInsights: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    const calls = await callService.getCallHistory(user.uid);
    setHistory(calls);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalCount = history.length;
    const completed = history.filter(c => c.status === 'ended');
    const totalMins = Math.floor(completed.reduce((acc, call) => acc + (call.duration || 0), 0) / 60);
    const videoCalls = history.filter(c => c.type === 'video').length;
    const participants = new Set(history.flatMap(c => c.participants));
    participants.delete(user?.uid || '');

    const avgDuration = completed.length > 0 ? (totalMins / completed.length).toFixed(1) : '0';
    
    // Find most contacted
    const contactCounts = new Map<string, number>();
    history.forEach(c => {
      c.participants.forEach(p => {
        if (p !== user?.uid) {
          contactCounts.set(p, (contactCounts.get(p) || 0) + 1);
        }
      });
    });
    
    let mostContactedId = null;
    let maxCount = 0;
    contactCounts.forEach((count, id) => {
      if (count > maxCount) {
        maxCount = count;
        mostContactedId = id;
      }
    });

    return {
      totalCount,
      totalMinutes: totalMins,
      videoRatio: totalCount > 0 ? Math.round((videoCalls / totalCount) * 100) : 0,
      uniqueContacts: participants.size,
      avgDuration,
      mostContactedId
    };
  }, [history, user]);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return days.map(day => {
      const dayCalls = history.filter(c => {
        const date = (c.startTime as any)?.toDate?.() || new Date();
        return isSameDay(date, day);
      });
      return {
        name: format(day, 'EEE'),
        calls: dayCalls.length,
        fullDate: format(day, 'MMM d')
      };
    });
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter(call => {
      const matchesFilter = 
        activeFilter === 'all' || 
        (activeFilter === 'missed' && call.status === 'missed') ||
        (activeFilter === 'completed' && call.status === 'ended') ||
        (activeFilter === 'video' && call.type === 'video') ||
        (activeFilter === 'audio' && call.type === 'audio');
      
      return matchesFilter;
    });
  }, [history, activeFilter]);

  if (loading) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Processing Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white overflow-y-auto no-scrollbar selection:bg-emerald-100 selection:text-emerald-900">
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {/* Futuristic Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-1"
           >
              <div className="flex items-center space-x-2 text-emerald-500 mb-1">
                 <Sparkles className="h-4 w-4" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em]">Platform Intelligence</span>
              </div>
              <h1 className="text-4xl font-black text-[#111b21] tracking-tight leading-none">
                Call <span className="text-emerald-500">Insights</span>
              </h1>
              <p className="text-gray-400 font-medium text-sm">Real-time performance metrics for your Chatty AI communications</p>
           </motion.div>
           
           <div className="flex items-center space-x-3 bg-zinc-50 p-1.5 rounded-2xl border border-black/5">
              {(['all', 'missed', 'completed', 'video', 'audio'] as FilterType[]).map((f) => (
                <button 
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    activeFilter === f 
                      ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 scale-105" 
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {f}
                </button>
              ))}
           </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatCard 
             label="Network Volume" 
             value={stats.totalCount} 
             icon={Activity} 
             trend="+12%" 
             delay={0.1}
             color="emerald"
           />
           <StatCard 
             label="Airtime Minutes" 
             value={stats.totalMinutes} 
             icon={Clock} 
             trend={`${stats.avgDuration}m avg`} 
             delay={0.2}
             color="blue"
           />
           <StatCard 
             label="Visual Engagement" 
             value={`${stats.videoRatio}%`} 
             icon={Video} 
             trend="Strong" 
             delay={0.3}
             color="purple"
           />
           <StatCard 
             label="Active Nodes" 
             value={stats.uniqueContacts} 
             icon={Users2} 
             trend="Growing" 
             delay={0.4}
             color="amber"
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Visual Performance Chart */}
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.5 }}
             className="lg:col-span-8 bg-white rounded-[48px] p-10 border border-black/5 shadow-2xl shadow-emerald-500/5 relative overflow-hidden group"
           >
              <div className="flex items-center justify-between mb-10 relative z-10">
                 <div>
                   <h3 className="text-xl font-bold text-[#111b21] flex items-center">
                      <TrendingUp className="h-5 w-5 mr-3 text-emerald-500" />
                      Frequency Distribution
                   </h3>
                   <p className="text-xs text-gray-400 font-medium mt-1">Activity fluctuations over the last 7 cycles</p>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                 </div>
              </div>
              
              <div className="h-[320px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                        padding: '16px 20px',
                        background: 'white'
                      }}
                      cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="#10b981" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorCalls)" 
                      dot={{ r: 4, fill: '#fff', strokeWidth: 3, stroke: '#10b981' }}
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#10b981' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Decorative elements */}
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/10 transition-colors" />
           </motion.div>

           {/* Metrics Panel */}
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.6 }}
             className="lg:col-span-4 space-y-6"
           >
              <div className="bg-zinc-900 rounded-[40px] p-8 text-white relative overflow-hidden h-full flex flex-col justify-between">
                 <div>
                   <div className="flex items-center justify-between mb-8">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Node Spotlight</span>
                     <MoreHorizontal className="h-5 w-5 text-white/30" />
                   </div>
                   
                   {stats.mostContactedId ? (
                     <MostContacted userId={stats.mostContactedId} />
                   ) : (
                     <p className="text-zinc-500 text-sm italic">No recurring contacts found yet.</p>
                   )}
                 </div>

                 <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                    <div className="flex items-center justify-between">
                       <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Global Status</p>
                       <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                    </div>
                    <div className="space-y-4">
                       <MetricRow label="Avg Reliability" value="99.9%" />
                       <MetricRow label="Data Usage" value="1.2 GB" />
                       <MetricRow label="Encryption" value="E2EE" />
                    </div>
                 </div>

                 {/* BG Glow */}
                 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[60px]" />
              </div>
           </motion.div>
        </div>

        {/* Dense Log View */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-[48px] p-10 border border-black/5 shadow-2xl shadow-zinc-200/20 relative overflow-hidden group"
        >
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 opacity-50" />
           
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-[#111b21] tracking-tight">Communication Ledger</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Neural history of signaling events</p>
              </div>
              <div className="flex items-center space-x-4">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Filter ledger..."
                      className="pl-12 pr-6 py-3 bg-zinc-50 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none ring-1 ring-black/5 focus:ring-emerald-500/20 focus:bg-white transition-all w-full md:w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-black/5 flex items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors">
                    <Filter className="h-4 w-4 text-gray-400" />
                 </div>
              </div>
           </div>

           <div className="overflow-x-auto relative z-10">
             <table className="w-full border-separate border-spacing-y-2">
                <thead>
                   <tr className="text-left">
                      <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identified Participant</th>
                      <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Interaction Type</th>
                      <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status / Duration</th>
                      <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Temporal Logic</th>
                      <th className="pb-6 px-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                   </tr>
                </thead>
                <tbody>
                   <AnimatePresence mode="popLayout">
                     {filteredHistory
                       .filter(call => searchQuery ? call.status.includes(searchQuery.toLowerCase()) : true)
                       .map((call, i) => (
                         <CallRow key={call.callId} call={call} currentUserId={user?.uid || ''} index={i} />
                       ))
                     }
                   </AnimatePresence>
                </tbody>
             </table>
             {filteredHistory.length === 0 && (
               <div className="py-24 flex flex-col items-center justify-center text-gray-300">
                  <div className="relative mb-6">
                    <Activity className="h-16 w-16 opacity-5" />
                    <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero matching nodes in history</p>
               </div>
             )}
           </div>
        </motion.div>

        {/* AI Transcription Teaser */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="bg-emerald-500 rounded-[48px] p-12 text-white relative overflow-hidden cursor-pointer group shadow-2xl shadow-emerald-500/20"
        >
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-xl">
                 <div className="flex items-center space-x-2 text-emerald-100 mb-6">
                    <BrainCircuit className="h-8 w-8" />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">AI Synthesis Pipeline</span>
                 </div>
                 <h2 className="text-4xl font-black mb-4 tracking-tight leading-tight">
                    Turn your conversations into <span className="text-emerald-900/50">searchable assets</span>
                 </h2>
                 <p className="text-emerald-50 text-base font-medium leading-relaxed opacity-80">
                   Chatty AI's neural transcribers generate structured summaries, action items, and topic maps for every call.
                 </p>
              </div>
              <div className="flex-shrink-0">
                 <button className="bg-white text-emerald-600 px-10 py-5 rounded-[24px] font-black text-sm hover:translate-x-2 transition-transform shadow-xl flex items-center group">
                    UPGRADE SUBSCRIPTION
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                 </button>
              </div>
           </div>
           
           {/* Animated blobs */}
           <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-[120px] -mr-48 -mt-48 group-hover:scale-110 transition-transform duration-700" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-900/20 rounded-full blur-[80px] -ml-32 -mb-32" />
        </motion.div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  label: string, 
  value: any, 
  icon: any, 
  trend: string, 
  delay: number,
  color: 'emerald' | 'blue' | 'purple' | 'amber'
}> = ({ label, value, icon: Icon, trend, delay, color }) => {
  const themes = {
    emerald: { bg: 'bg-emerald-50 text-emerald-500', shadow: 'shadow-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 text-blue-500', shadow: 'shadow-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-50 text-purple-500', shadow: 'shadow-purple-500/10', text: 'text-purple-500' },
    amber: { bg: 'bg-amber-50 text-amber-500', shadow: 'shadow-amber-500/10', text: 'text-amber-500' }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "bg-white p-8 rounded-[40px] border border-black/5 flex flex-col space-y-4 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1",
        themes[color].shadow
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", themes[color].bg)}>
           <Icon className="h-6 w-6" />
        </div>
        <div className="px-3 py-1 bg-zinc-50 rounded-full flex items-center space-x-1">
           <ArrowUpRight className={cn("h-3 w-3", themes[color].text)} />
           <span className="text-[10px] font-black text-gray-500">{trend}</span>
        </div>
      </div>
      <div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{label}</span>
        <span className="text-3xl font-black text-[#111b21] tracking-tight">{value}</span>
      </div>
    </motion.div>
  );
};

const MetricRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex items-center justify-between group">
     <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
     <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">{value}</span>
  </div>
);

const MostContacted: React.FC<{ userId: string }> = ({ userId }) => {
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) setUserData(snap.data());
    };
    fetch();
  }, [userId]);

  return (
    <div className="space-y-6">
       <div className="flex items-center space-x-4">
          <img 
            src={userData?.photoURL || `https://ui-avatars.com/api/?name=${userData?.displayName || '?'}`} 
            className="h-16 w-16 rounded-[24px] object-cover ring-2 ring-emerald-500/20 p-1 bg-white/5" 
          />
          <div>
             <h4 className="text-lg font-bold truncate leading-tight">{userData?.displayName || 'Loading...'}</h4>
             <p className="text-xs text-zinc-500 font-medium">Favorite Collab Node</p>
          </div>
       </div>
       <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center space-x-2">
          <span>View Session Logs</span>
          <ArrowRight className="h-3 w-3" />
       </button>
    </div>
  );
};

const CallRow: React.FC<{ call: CallSession, currentUserId: string, index: number }> = ({ call, currentUserId, index }) => {
  const [partner, setPartner] = useState<any>(null);
  const partnerId = call.participants.find(p => p !== currentUserId) || call.hostId;

  useEffect(() => {
    const fetchPartner = async () => {
      const docSnap = await getDoc(doc(db, 'users', partnerId));
      if (docSnap.exists()) setPartner(docSnap.data());
    };
    fetchPartner();
  }, [partnerId, currentUserId]);

  const durationStr = call.duration ? `${Math.floor(call.duration/60)}m ${call.duration%60}s` : 'Ringing';
  const isIncoming = call.hostId !== currentUserId;

  return (
    <motion.tr 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
       <td className="py-2 px-4 bg-zinc-50/30 group-hover:bg-zinc-100/50 rounded-l-[24px] border-y border-l border-transparent group-hover:border-black/5 transition-all duration-300">
          <div className="flex items-center space-x-4">
             <div className="relative">
               <img 
                 src={partner?.photoURL || `https://ui-avatars.com/api/?name=${partner?.displayName || '?'}`} 
                 className="h-12 w-12 rounded-2xl object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" 
               />
               <motion.div 
                 whileHover={{ scale: 1.2 }}
                 className={cn(
                   "absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] shadow-sm",
                   isIncoming ? "bg-blue-500" : "bg-emerald-500"
                 )}>
                 {isIncoming ? <PhoneIncoming className="h-2.5 w-2.5 text-white" /> : <PhoneOutgoing className="h-2.5 w-2.5 text-white" />}
               </motion.div>
             </div>
             <div>
                <p className="text-[14px] font-black text-[#111b21] tracking-tight group-hover:text-emerald-600 transition-colors">{partner?.displayName || 'Syncing Node...'}</p>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter opacity-60">@{partner?.username || 'identifier'}</p>
             </div>
          </div>
       </td>
       <td className="py-2 px-4 bg-zinc-50/30 group-hover:bg-zinc-100/50 border-y border-transparent group-hover:border-black/5 transition-all duration-300">
          <div className="flex items-center space-x-3">
             <div className={cn(
               "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12",
               call.type === 'video' ? "bg-purple-100/50 text-purple-600" : "bg-blue-100/50 text-blue-600"
             )}>
                {call.type === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
             </div>
             <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 opacity-80">{call.type} Session</span>
          </div>
       </td>
       <td className="py-2 px-4 bg-zinc-50/30 group-hover:bg-zinc-100/50 border-y border-transparent group-hover:border-black/5 transition-all duration-300">
          <div className="space-y-1">
             <div className={cn(
               "text-[9px] font-black uppercase px-3 py-1 rounded-full inline-block tracking-[0.1em] shadow-sm",
               call.status === 'missed' ? "bg-rose-100 text-rose-600" : 
               call.status === 'ended' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
             )}>
               {call.status}
             </div>
             <p className="text-[11px] font-black text-gray-400 tracking-tighter ml-1">{durationStr}</p>
          </div>
       </td>
       <td className="py-2 px-4 bg-zinc-50/30 group-hover:bg-zinc-100/50 border-y border-transparent group-hover:border-black/5 transition-all duration-300">
          <p className="text-[12px] font-black text-[#111b21] tracking-tight flex items-center gap-2">
            {call.startTime?.toDate ? format(call.startTime.toDate(), 'MMM d, h:mm a') : 'Temporal Error'}
            {call.status === 'ended' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-[10px] text-emerald-600 border border-emerald-100 font-bold">
                {durationStr}
              </span>
            )}
          </p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-60">{call.startTime?.toDate ? formatDistanceToNow(call.startTime.toDate(), { addSuffix: true }) : 'Calculating...'}</p>
       </td>
       <td className="py-2 px-4 bg-zinc-50/30 group-hover:bg-zinc-100/50 rounded-r-[24px] border-y border-r border-transparent group-hover:border-black/5 text-right transition-all duration-300">
          <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-emerald-500 hover:text-white text-emerald-600 transition-all transform hover:scale-110 active:scale-95 shadow-sm group-hover:shadow-emerald-500/20">
             <ArrowUpRight className="h-5 w-5" />
          </button>
       </td>
    </motion.tr>
  );
};
