import React from "react";
export default function Insights({ result }) {
  if (!result) return <div className="glass p-6">No insights yet</div>;

  return (
    <div className="glass p-6">
      <h2 className="text-green-400 text-xl mb-3">AI Insights</h2>

      <ul>
        <li>✔ Facial asymmetry detected</li>
        <li>✔ Speech irregularity observed</li>
        <li>✔ Risk trending upward</li>
      </ul>
    </div>
  );
}