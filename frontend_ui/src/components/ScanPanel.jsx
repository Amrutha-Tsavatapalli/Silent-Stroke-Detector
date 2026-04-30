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
      <h2 className="text-xl text-blue-600 mb-4 font-bold">
        Face Scan
      </h2>

      {/* Upload Section */}
      <div className="mb-4">

        {/* Hidden input */}
        <input
          type="file"
          id="fileUpload"
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {/* Custom Upload Button */}
        <label
          htmlFor="fileUpload"
          className="cursor-pointer px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
        >
          📁 Choose Image
        </label>

        {/* Show selected file */}
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            {file.name}
          </p>
        )}

      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        className="
    w-full py-3 rounded-xl font-semibold text-white
    bg-gradient-to-r from-teal-400 to-blue-400
    shadow-lg hover:shadow-xl
    hover:scale-[1.02]
    transition duration-300
  "
>
  🚀 Run AI Scan
</button>

    </div>
  );
}