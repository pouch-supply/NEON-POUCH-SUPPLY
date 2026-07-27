import React from 'react';

interface SubscriptionIconProps {
  planName: string;
  className?: string;
}

export default function SubscriptionIcon({ planName, className = '' }: SubscriptionIconProps) {
  const lower = planName.toLowerCase();
  let name = "BOX";
  let count = "8 TINS";
  let colorFrom = "#4f46e5"; // Indigo
  let colorTo = "#312e81";
  let textColor = "#ffffff";
  let badgeColor = "#10b981"; // Emerald

  if (lower.includes('lite')) {
    name = "LITE";
    count = "6 TINS";
    colorFrom = "#6366f1"; // Indigo-500
    colorTo = "#4338ca";
    badgeColor = "#10b981";
  } else if (lower.includes('core')) {
    name = "CORE";
    count = "8 TINS";
    colorFrom = "#0284c7"; // Sky-600
    colorTo = "#0369a1";
    badgeColor = "#dfb55a"; // Gold/Amber
  } else if (lower.includes('pro')) {
    name = "PRO";
    count = "10 TINS";
    colorFrom = "#8b5cf6"; // Violet-500
    colorTo = "#6d28d9";
    badgeColor = "#f59e0b"; // Orange/Amber
  } else if (lower.includes('ultimate')) {
    name = "ULTI";
    count = "12 TINS";
    colorFrom = "#ec4899"; // Pink-500
    colorTo = "#be185d";
    badgeColor = "#3b82f6"; // Blue
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 shrink-0 shadow-md select-none ${className}`}
    >
      <defs>
        <linearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      
      {/* Background card gradient */}
      <rect x="0" y="0" width="100" height="100" rx="12" fill={`url(#grad-${name})`} />
      
      {/* Abstract geometric patterns representing tins stack */}
      <circle cx="50" cy="50" r="32" fill="#000000" fillOpacity="0.15" />
      
      {/* Stacked circles representing tins */}
      <circle cx="50" cy="38" r="16" fill="#ffffff" fillOpacity="0.1" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" />
      <circle cx="42" cy="46" r="16" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" />
      <circle cx="58" cy="46" r="16" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" />
      
      {/* Overlay plan name text */}
      <text 
        x="50" 
        y="50" 
        textAnchor="middle" 
        dominantBaseline="central" 
        fill={textColor} 
        fontSize="12" 
        fontWeight="900" 
        letterSpacing="1.5"
        fontFamily="sans-serif"
        style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.5)' }}
      >
        {name}
      </text>

      {/* Mini badge for tins count */}
      <rect x="15" y="68" width="70" height="18" rx="9" fill={badgeColor} />
      <text 
        x="50" 
        y="77" 
        textAnchor="middle" 
        dominantBaseline="central" 
        fill="#0f172a" 
        fontSize="8" 
        fontWeight="900"
        letterSpacing="0.5"
        fontFamily="monospace"
      >
        {count}
      </text>
    </svg>
  );
}
