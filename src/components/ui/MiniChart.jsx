import React from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export default function MiniChart({ data, color = "#d4a843", height = 60 }) {
  const chartData = data || Array.from({ length: 20 }, (_, i) => ({
    value: 50 + Math.random() * 30 + Math.sin(i * 0.5) * 10
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color.replace('#', '')})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}