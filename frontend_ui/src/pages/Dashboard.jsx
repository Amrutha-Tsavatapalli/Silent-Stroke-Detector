import React, { useState } from "react";
import ScanPanel from "../components/ScanPanel";
import RiskMeter from "../components/RiskMeter";
import Insights from "../components/Insights";
import Emergency from "../components/Emergency";

export default function Dashboard() {
  const [result, setResult] = useState({
    risk: 0,
    alert: false,
  });

  return (
    <div className="min-h-screen p-6 md:p-10 space-y-6 fade-in">

      {/* Title */}
      <h1 className="text-3xl md:text-5xl font-bold text-blue-700" style={{ textAlign: "center" }}>
  🧠 Silent Stroke AI
</h1>

      {/* Top Section */}
      <div className="grid md:grid-cols-2 gap-6">
        
        <div className="glass">
          <ScanPanel setResult={setResult} />
        </div>

        <div className="glass flex items-center justify-center">
          <RiskMeter risk={result.risk} />
        </div>

      </div>

      {/* Bottom Section */}
      <div className="grid md:grid-cols-2 gap-6">

        <div className="glass">
          <Insights result={result} />
        </div>

        <div className="glass border-l-4 border-red-400">
          <Emergency alert={result.alert} />
        </div>

      </div>

    </div>
  );
}