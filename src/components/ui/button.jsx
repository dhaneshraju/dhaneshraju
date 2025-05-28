import React from "react";
// import { cn } from "@/lib/utils"; // Optional: utility for class merging

// If you don't have cn, just remove it and use className directly

export const Button = ({ className = "", children, title, ...props }) => {
  return (
    <button
      title={title}
      className={`inline-flex items-center px-4 py-2 rounded-xl font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition duration-200 shadow-lg ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};