import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../lib/utils';
import { Plus, Search, Filter } from 'lucide-react';

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = () => {
    fetchAPI('/members')
      .then(res => {
        setMembers(res);
        setLoading(false);
      })
      .catch(console.error);
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="sm:flex sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Members Directory</h1>
          <p className="mt-1 text-[11px] text-slate-500">A list of all members in the cooperative network.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors uppercase tracking-tight">
            <Filter className="w-3 h-3 mr-2" /> Filter
          </button>
          <button className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-500 border border-transparent rounded-lg shadow-sm hover:bg-emerald-600 transition-colors uppercase tracking-tight">
            <Plus className="w-3 h-3 mr-2" /> Add Member
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-100 flex items-center shrink-0">
          <div className="relative w-full max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border-none text-xs rounded-lg bg-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              placeholder="Search members..."
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-[11px] text-slate-500">Loading members...</div>
        ) : (
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="py-3 px-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Member Name</th>
                  <th className="py-3 px-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Cooperative</th>
                  <th className="py-3 px-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Contact</th>
                  <th className="py-3 px-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-xs border border-emerald-100">
                        {member.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold">{member.name}</div>
                        <div className="text-[10px] text-slate-500">{member.gender} • {new Date().getFullYear() - new Date(member.birthdate).getFullYear()} yrs</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900">{member.coop_name}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {member.contact}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                        member.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center text-slate-500 text-xs">No members found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
