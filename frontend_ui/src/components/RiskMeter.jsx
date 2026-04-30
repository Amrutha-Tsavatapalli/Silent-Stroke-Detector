import React from "react";


export default function RiskMeter({ risk = 0 }) {
  const percentage = Math.min(risk * 100, 100);

  return (
    <div className="text-center w-full">

      {/* Title */}
      <h2 className="text-gray-500 mb-4">Risk Level</h2>

      {/* Circle */}
      <div className="relative w-40 h-40 mx-auto">

        {/* Background circle */}
        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">

          {/* Inner value */}
          <span className="text-3xl font-bold text-teal-600">
            {risk}
          </span>

        </div>

      </div>

      {/* Percentage text */}
      <p className="mt-3 text-sm text-gray-500">
        {percentage}% risk detected
      </p>

    </div>
  );
}