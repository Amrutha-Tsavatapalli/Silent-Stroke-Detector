import React from "react";

export default function Insights({ result }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-600 mb-2">
        Insights
      </h2>

      <p className="text-gray-500">
        {result.risk > 0
          ? "AI analyzed your facial data."
          : "No insights yet"}
      </p>
    </div>
  );
}