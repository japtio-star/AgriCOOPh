import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('amds_user') || '{}');

  useEffect(() => {
    fetchAPI('/dashboard')
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Loading dashboard...</div>;

  const pieData = data.genderDistribution.map((i: any) => ({
    name: i.gender,
    value: i.count
  }));
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B'];

  // Mock data for the chart
  const growthData = [
    { name: 'May', members: Math.floor(data.totalMembers * 0.5) },
    { name: 'Jun', members: Math.floor(data.totalMembers * 0.7) },
    { name: 'Jul', members: Math.floor(data.totalMembers * 0.8) },
    { name: 'Aug', members: Math.floor(data.totalMembers * 0.9) },
    { name: 'Sep', members: Math.floor(data.totalMembers * 0.95) },
    { name: 'Oct', members: data.totalMembers },
  ];

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {[
          { name: 'Total Members', stat: data.totalMembers, color: 'bg-emerald-500', w: 'w-3/4' },
          { name: 'Active Members', stat: data.activeMembers, color: 'bg-blue-500', w: 'w-[90%]' },
          { name: 'Inactive Members', stat: data.inactiveMembers, color: 'bg-orange-500', w: 'w-1/3' },
          { name: 'Total Coops', stat: data.totalCoops, color: 'bg-indigo-500', w: 'w-full' },
        ].map((item) => (
          <div key={item.name} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 uppercase font-semibold mb-1">{item.name}</div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-slate-900">{item.stat}</span>
            </div>
            <div className="h-1 w-full bg-slate-100 mt-2 rounded-full overflow-hidden flex">
              <div className={`${item.color} h-full ${item.w}`}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-0 flex-1">
        <div className="flex-[3] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Membership Growth</h3>
              <p className="text-[11px] text-slate-500">6 month projection</p>
            </div>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, textTransform: 'uppercase' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="members" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex-[2] flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Gender Distribution</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center space-x-6">
              {pieData.map((entry: any, index: number) => (
                <div key={entry.name} className="flex items-center">
                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-medium text-slate-700">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#1E293B] p-5 rounded-xl text-white relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="text-sm font-bold mb-1">System Status</h3>
               <p className="text-[10px] text-slate-400 mb-2">All services operational</p>
               <div className="text-2xl font-bold">100%</div>
             </div>
             <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500 opacity-20 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
