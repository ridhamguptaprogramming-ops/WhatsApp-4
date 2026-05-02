import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, Video, Clock, Users, ArrowUpRight, ArrowDownLeft, 
  Calendar, PieChart, BarChart3, Activity, Users2, BrainCircuit
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { callService } from '../services/callService';
import { useAuth } from '../context/AuthContext';
import { CallSession } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const CallInsights: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<CallSession[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalMinutes: 0,
    videoRatio: 0,
    uniqueContacts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    const calls = await callService.getCallHistory(user.uid);
    setHistory(calls);

    // Calculate Stats
    const totalMins = Math.floor(calls.reduce((acc, call) => acc + (call.duration || 0), 0) / 60);
    const videoCalls = calls.filter(c => c.type === 'video').length;
    const participants = new Set(calls.flatMap(c => c.participants));
    participants.delete(user.uid);

    setStats({
      totalCount: calls.length,
      totalMinutes: totalMins,
      videoRatio: calls.length > 0 ? (videoCalls / calls.length) * 100 : 0,
      uniqueContacts: participants.size
    });
    setLoading(false);
  };

  const chartData = [
    { name: 'Mon', calls: 4 },
    { name: 'Tue', calls: 7 },
    { name: 'Wed', calls: 5 },
    { name: 'Thu', calls: 9 },
    { name: 'Fri', calls: 12 },
    { name: 'Sat', calls: 3 },
    { name: 'Sun', calls: 2 },
  ];

  return (
    <div className="flex-1 bg-[#f0f2f5] overflow-y-auto font-sans p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
           <div>
              <h1 className="text-3xl font-black text-[#111b21] tracking-tight">Call Insights</h1>
              <p className="text-gray-500 font-medium text-sm mt-1">Deep analytics and history of your communications</p>
           </div>
           <div className="bg-white p-1 rounded-2xl flex border border-black/5">
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20">All Time</button>
              <button className="px-4 py-2 text-gray-400 hover:text-gray-600 text-xs font-bold transition-colors">Monthly</button>
           </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <StatCard label="Total Calls" value={stats.totalCount} icon={Phone} color="text-emerald-500" bg="bg-emerald-50" />
           <StatCard label="Total Duration" value={`${stats.totalMinutes}m`} icon={Clock} color="text-blue-500" bg="bg-blue-50" />
           <StatCard label="Video Ratio" value={`${Math.round(stats.videoRatio)}%`} icon={Video} color="text-purple-500" bg="bg-purple-50" />
           <StatCard label="Contact Network" value={stats.uniqueContacts} icon={Users2} color="text-amber-500" bg="bg-amber-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Chart */}
           <div className="lg:col-span-2 bg-white rounded-[40px] p-8 border border-black/5 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-bold flex items-center">
                    <Activity className="h-5 w-5 mr-3 text-emerald-500" />
                    Weekly Activity
                 </h3>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Call Frequency</span>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667781' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667781' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#10b981', strokeWidth: 2 }}
                    />
                    <Line type="monotone" dataKey="calls" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Call Logs */}
           <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold">Recent Calls</h3>
                <ArrowUpRight className="h-5 w-5 text-gray-300" />
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pr-2">
                 {history.map((call, i) => (
                   <CallLogItem key={call.callId} call={call} currentUserId={user?.uid || ''} />
                 ))}
                 {history.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                     <Phone className="h-12 w-12 mb-2 opacity-20" />
                     <p className="text-xs font-bold uppercase">No calls yet</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* AI Summaries Section */}
        <div className="bg-zinc-900 rounded-[40px] p-10 text-white relative overflow-hidden">
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-md">
                 <div className="flex items-center space-x-2 text-emerald-400 mb-4">
                    <BrainCircuit className="h-6 w-6" />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Gemini AI Assistant</span>
                 </div>
                 <h2 className="text-2xl font-bold mb-2">Automated Call Recaps</h2>
                 <p className="text-zinc-400 text-sm leading-relaxed">
                   Our advanced neural processing engine generates instant summaries of your discussion points and action items.
                 </p>
              </div>
              <button className="bg-white text-zinc-950 px-8 py-4 rounded-3xl font-black text-sm hover:scale-105 active:scale-95 transition-transform shadow-xl">
                 ENABLE TRANSCRIPTION
              </button>
           </div>
           
           {/* Abstract BG */}
           <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -mr-48 -mt-48" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: any, icon: any, color: string, bg: string }> = ({ label, value, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm flex flex-col space-y-2">
    <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-1", bg, color)}>
       <Icon className="h-5 w-5" />
    </div>
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    <span className="text-2xl font-black text-[#111b21]">{value}</span>
  </div>
);

const CallLogItem: React.FC<{ call: CallSession, currentUserId: string }> = ({ call, currentUserId }) => {
  const [partner, setPartner] = useState<any>(null);
  const isMeHost = call.hostId === currentUserId;
  const partnerId = call.participants.find(p => p !== currentUserId) || call.hostId;

  useEffect(() => {
    const fetchPartner = async () => {
      const docSnap = await getDoc(doc(db, 'users', partnerId));
      if (docSnap.exists()) setPartner(docSnap.data());
    };
    fetchPartner();
  }, [partnerId]);

  return (
    <div className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors group">
       <img 
         src={partner?.photoURL || `https://ui-avatars.com/api/?name=${partner?.displayName || '?'}`} 
         className="h-10 w-10 rounded-xl object-cover" 
       />
       <div className="flex-1 overflow-hidden">
          <p className="text-xs font-bold text-[#111b21] truncate">{partner?.displayName || 'User'}</p>
          <div className="flex items-center text-[10px] text-gray-500 font-bold uppercase mt-0.5">
             {call.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
             {call.duration ? `${Math.floor(call.duration/60)}m ${call.duration%60}s` : 'Ringing'}
          </div>
       </div>
       <div className="text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase">{call.startTime?.toDate ? formatDistanceToNow(call.startTime.toDate()) : 'Recent'}</p>
          <div className={cn(
            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block",
            call.status === 'missed' ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
          )}>
            {call.status}
          </div>
       </div>
    </div>
  );
};
