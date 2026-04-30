import React from "react";

export default function Emergency({ alert }) {
  return (
    <div className="glass ">
      
      <h2 className="text-lg font-semibold text-red-500 mb-2">
        Emergency
      </h2>

      <p className="text-gray-700">
        {alert
          ? "⚠️ Immediate attention needed!"
          : "No emergency detected"}
      </p>

    </div>
  );
}