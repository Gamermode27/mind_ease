
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { JournalEntry } from '../types';

interface TrendsChartProps {
  entries: JournalEntry[];
}

export const TrendsChart: React.FC<TrendsChartProps> = ({ entries }) => {
  const data = entries.slice().reverse().map(e => ({
    date: new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: e.moodScore,
    mood: e.moodLabel
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-xl p-3 border border-white/10 shadow-2xl rounded-2xl text-white">
          <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest mb-1">{label}</p>
          <p className="text-sm font-bold">{payload[0].payload.mood}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontWeight: 'bold'}} 
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis 
            domain={[-1, 1]} 
            hide={true} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2}} />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="#60a5fa" 
            strokeWidth={4}
            fillOpacity={1} 
            fill="url(#colorScore)" 
            dot={{ r: 5, fill: '#60a5fa', strokeWidth: 3, stroke: '#0f172a' }}
            activeDot={{ r: 8, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
