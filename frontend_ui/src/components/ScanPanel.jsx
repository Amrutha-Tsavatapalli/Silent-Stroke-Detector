import React, { useState } from "react";

export default function ScanPanel({ setResult }) {
  const [file, setFile] = useState(null);

  const handleRun = () => {
    if (!file) {
      alert("Please upload an image first");
      return;
    }

    // TEMP: dummy result (we'll connect backend later)
    setResult({
      risk: Math.random().toFixed(2),
      alert: Math.random() > 0.5,
    });
  };

  return (
    <div className="glass p-6">
      
      {/* Title */}
      <h2 className="text-xl text-cyan-400 mb-4 font-bold">
        Face Scan
      </h2>

      {/* Custom File Upload */}
      <div className="mb-4">
        
        {/* Hidden input */}
        <input
          type="file"
          id="fileUpload"
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {/* Custom button */}
        <label
          htmlFor="fileUpload"
          className="
            cursor-pointer inline-block px-4 py-2 rounded-lg
            bg-gray-700 text-white font-medium
            hover:bg-gray-600 transition
          "
        >
          📁 Choose Image
        </label>

        {/* File name */}
        {file && (
          <span className="ml-3 text-gray-300 text-sm">
            {file.name}
          </span>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        className="
          w-full py-3 rounded-xl font-semibold text-black
          bg-gradient-to-r from-cyan-400 to-blue-500
          shadow-lg shadow-cyan-500/30
          hover:scale-105 hover:shadow-cyan-400/50
          active:scale-95
          transition duration-300
        "
      >
        🚀 Run AI Scan
      </button>

    </div>
  );
}