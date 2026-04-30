import React from "react";
export default function Emergency({ result }) {
  return (
    <div className="glass p-6 border border-red-500">
      <h2 className="text-red-400 text-xl mb-3">Emergency</h2>

      {result?.alert ? (
        <>
          <p className="text-red-300 font-bold">
            ⚠ Immediate Attention Needed
          </p>
          <button className="mt-3 bg-red-500 px-4 py-2 rounded-lg">
            Call Hospital 🚑
          </button>
        </>
      ) : (
        <p className="text-green-400">No emergency detected</p>
      )}
    </div>
  );
}