import React from 'react';

export default function TerminalName({ text }) {
  return (
    <div className="terminal-container inline-block">
      <span className="terminal-prompt text-cyan-400 mr-2">#</span>
      <span className="terminal-text">{text}</span>
      <span className="terminal-cursor"></span>
    </div>
  );
}