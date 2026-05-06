import React, { useEffect, useState } from 'react';
import { fetchAPI } from '../lib/utils';
import { FileUp, Download, CheckCircle, Clock } from 'lucide-react';

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/reports')
      .then(res => {
        setReports(res);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">M&E Reports</h1>
          <p className="mt-1 text-[11px] text-slate-500">Track and submit CAPAR and CAIS reports.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-500 border border-transparent rounded-lg shadow-sm hover:bg-emerald-600 transition-colors uppercase tracking-tight">
            <FileUp className="w-3 h-3 mr-2" /> Upload Report
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[11px] text-slate-500">Loading reports...</div>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {reports.map((report) => (
              <li key={report.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded shadow-sm flex items-center justify-center border font-bold text-xs ${report.type === 'CAIS' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {report.type}
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-xs font-bold text-slate-900">{report.coop_name}</h4>
                      <p className="text-[10px] text-slate-500">{report.type} - {new Date(report.date_submitted).getFullYear()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`flex items-center text-[10px] font-bold uppercase tracking-widest ${report.status === 'Approved' ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {report.status}
                    </span>
                    <button className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-tight bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">
                      <Download className="w-3 h-3 inline-block mr-1" /> View
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {reports.length === 0 && (
              <li className="p-8 text-center text-[11px] text-slate-500">No reports found.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
