import React from 'react';
import { TrendingUp, Users, HardDrive } from 'lucide-react';

interface StatsProps {
  totalSales: number;
  todaySales: number;
  conversionRate: number;
  completedOrders: number;
  totalStoreSessions: number;
  avgOrderValue: number;
  pathD: string;
  graphPoints: { label: string }[];
  finalGeos: { country: string; sessionCount: number; percentage: number }[];
}

interface AnalyticsTabProps {
  stats: StatsProps;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ stats }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric sales card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <TrendingUp className="absolute top-5 right-5 text-indigo-600 h-5 w-5" />
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Revenue (All-Time)</span>
          <h3 className="text-2xl font-black text-slate-900 mt-2">£{(Number(stats?.totalSales) || 0).toFixed(2)}</h3>
          <div className="text-[11px] text-emerald-600 font-bold mt-2 flex items-center gap-0.5">
            <span>£{(Number(stats?.todaySales) || 0).toFixed(2)}</span> <span className="text-slate-400 font-medium">gross sales received today</span>
          </div>
        </div>

        {/* Metric conversion card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <Users className="absolute top-5 right-5 text-indigo-600 h-5 w-5" />
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Conversion rate</span>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{(Number(stats?.conversionRate) || 0).toFixed(1)}%</h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {stats?.completedOrders || 0} orders from {stats?.totalStoreSessions || 0} store sessions
          </p>
          <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${Math.min(100, stats?.conversionRate || 3.2)}%` }} />
          </div>
        </div>

        {/* Metric AOV card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <HardDrive className="absolute top-5 right-5 text-indigo-600 h-5 w-5" />
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Average Order Value</span>
          <h3 className="text-2xl font-black text-slate-900 mt-2">£{(Number(stats?.avgOrderValue) || 0).toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Average cart check size across all sales</p>
        </div>

      </div>

      {/* Pure SVG Animated High contrast charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Revenue Trends */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h4 className="font-extrabold text-slate-800 text-sm mb-4">Gross Revenue Chart over Time</h4>
          <div className="relative h-60 bg-slate-50 rounded-lg border border-slate-100 p-4 flex items-end">
            <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col justify-between py-2 text-[9px] text-slate-400 pointer-events-none px-4">
              <div className="border-b border-dashed border-slate-200/80 w-full pt-1">£{(stats.totalSales || 800).toFixed(2)}</div>
              <div className="border-b border-dashed border-slate-200/80 w-full pt-1">£{((stats.totalSales || 800) * 0.66).toFixed(2)}</div>
              <div className="border-b border-dashed border-slate-200/80 w-full pt-1">£{((stats.totalSales || 800) * 0.33).toFixed(2)}</div>
              <div className="border-b border-dashed border-slate-200/80 w-full pt-1">£(0.00)</div>
            </div>

            {/* SVG Line path for high aesthetic fidelity */}
            <svg className="absolute inset-0 h-full w-full p-10 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path 
                d={stats.pathD} 
                fill="none" 
                stroke="#4f46e5" 
                strokeWidth="3.5" 
                strokeLinecap="round"
              />
              <path 
                d={`${stats.pathD} L 100 100 L 0 100 Z`} 
                fill="url(#rev-grad)" 
                opacity="0.08"
              />
              <defs>
                <linearGradient id="rev-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>

            {/* SVG chart dots */}
            <div className="relative z-10 w-full flex justify-between px-6 text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none pt-4">
              {stats.graphPoints.length > 0 ? (
                stats.graphPoints.map((gp, gIdx) => {
                  if (
                    stats.graphPoints.length <= 4 || 
                    gIdx === 0 || 
                    gIdx === stats.graphPoints.length - 1 || 
                    gIdx === Math.floor(stats.graphPoints.length / 3) ||
                    gIdx === Math.floor(stats.graphPoints.length * 2 / 3)
                  ) {
                    return <span key={gIdx}>{gp.label}</span>;
                  }
                  return null;
                })
              ) : (
                <>
                  <span>9:00 am</span>
                  <span>1:00 pm</span>
                  <span>5:00 pm</span>
                  <span>9:00 pm</span>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500">
            <span>Metric source: Secure checkout logs</span>
            <span>Trend State: <span className="text-emerald-600 font-bold">{stats.completedOrders > 0 ? 'Dynamic Live Graph' : 'Awaiting checkouts'}</span></span>
          </div>
        </div>

        {/* Chart 2: Regional Sessions Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h4 className="font-extrabold text-slate-800 text-sm mb-4">Top Geographic Customer Locations</h4>
          <div className="space-y-4">
            {stats.finalGeos.map((loc, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>{loc.country}</span>
                  <span>{loc.sessionCount} sessions ({loc.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-slate-900 h-full rounded-full transition-all duration-500" style={{ width: `${loc.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsTab;
