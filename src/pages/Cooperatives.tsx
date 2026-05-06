import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../lib/utils';
import { Plus } from 'lucide-react';

export default function Cooperatives() {
  const [coops, setCoops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/cooperatives')
      .then(res => {
        setCoops(res);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cooperative Units</h1>
          <p className="mt-1 text-[11px] text-slate-500">Manage cooperatives registered under the federation.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-500 border border-transparent rounded-lg shadow-sm hover:bg-emerald-600 transition-colors uppercase tracking-tight">
            <Plus className="w-3 h-3 mr-2" /> Add Coop
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full p-8 text-center text-[11px] text-slate-500">Loading cooperatives...</div>
        ) : (
          coops.map((coop) => (
            <div key={coop.id} className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded shadow-sm bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 font-bold text-lg">
                    {coop.name.substring(0, 1)}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100">
                    {coop.type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">{coop.name}</h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{coop.location}</p>
                
                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                  <div className="text-slate-500">Joined <span className="font-bold text-slate-900">{new Date(coop.date_joined).getFullYear()}</span></div>
                  <a href="#" className="font-bold text-emerald-600 hover:text-emerald-500 uppercase tracking-tight text-[10px]">View Details</a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
