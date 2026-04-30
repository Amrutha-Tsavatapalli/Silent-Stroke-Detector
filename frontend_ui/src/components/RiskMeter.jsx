import { motion } from "framer-motion";
import React from "react";
export default function RiskMeter({ result }) {
  const risk = result?.risk || 0;

  return (
    <div className="glass p-6 text-center">
      <h2 className="text-xl text-purple-300">Risk Level</h2>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="text-6xl font-bold text-purple-400"
      >
        {risk}
      </motion.div>

      <div className="mt-4 bg-gray-700 h-3 rounded-full">
        <div
          className="bg-purple-400 h-3 rounded-full"
          style={{ width: `${risk * 100}%` }}
        />
      </div>
    </div>
  );
}