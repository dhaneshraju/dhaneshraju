import React from 'react';

export default function HeartbeatWave() {
  return (
    <div className="heartbeat-container mb-4">
      <svg 
        className="w-32 h-8" 
        viewBox="0 0 400 40" 
        preserveAspectRatio="none"
      >
        <path
          className="heartbeat-path"
          d="M0,20 L100,20 L120,0 L140,40 L160,0 L180,40 L200,20 L400,20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}