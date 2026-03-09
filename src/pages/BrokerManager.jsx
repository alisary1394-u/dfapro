import React from "react";
import BrokerManagerComponent from "@/components/trading/BrokerManager";
import { Building2 } from "lucide-react";

export default function BrokerManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#b8922f] flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">إدارة الوسيط</h1>
          <p className="text-xs text-[#94a3b8]">ربط حساب Alpaca وإدارة التداول</p>
        </div>
      </div>
      <BrokerManagerComponent />
    </div>
  );
}