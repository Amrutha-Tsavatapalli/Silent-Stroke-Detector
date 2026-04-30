import React from "react";
import ScanPanel from "../components/ScanPanel";
import RiskMeter from "../components/RiskMeter";
import Insights from "../components/Insights";
import Emergency from "../components/Emergency";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">

      <h1 className="text-4xl font-bold text-cyan-400">
        🧠 Silent Stroke AI
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass">
          <ScanPanel />
        </div>

        <div className="glass text-center">
          <RiskMeter />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass">
          <Insights />
        </div>

        <div className="glass border border-red-500">
          <Emergency />
        </div>
      </div>

    </div>
  );
}