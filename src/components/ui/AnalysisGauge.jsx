import React from "react";

export default function AnalysisGauge({ score, label, size = 120 }) {
  // score: 0-100
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 70) return "#10b981";
    if (score >= 40) return "#d4a843";
    return "#ef4444";
  };

  const getLabel = () => {
    if (score >= 80) return "شراء قوي";
    if (score >= 60) return "شراء";
    if (score >= 40) return "محايد";
    if (score >= 20) return "بيع";
    return "بيع قوي";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 8px ${getColor()}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
          <span className="text-xs text-[#94a3b8]">من 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold" style={{ color: getColor() }}>{getLabel()}</p>
        {label && <p className="text-xs text-[#94a3b8]">{label}</p>}
      </div>
    </div>
  );
}