import React from "react";
import { motion } from "framer-motion";
import { FaGithub, FaLinkedin, FaTwitter, FaEnvelope } from "react-icons/fa";
import './AboutPage.css';
import profileImg from "../assets/dhanesh.jpg";

export default function AboutPage() {
  return (
    <div className="snap-y snap-mandatory h-screen overflow-scroll bg-black text-white font-sans">
      {/* HERO SECTION */}
      <section className="snap-start h-screen flex flex-col items-center justify-center text-center relative">
        <img
          src={profileImg}
          alt="Dhanesh Raju"
          className="w-64 h-64 object-cover rounded-full border-4 border-cyan-500 shadow-xl"
        />
        <h1 className="mt-6 text-4xl font-bold">Dhanesh Raju</h1>
        <p className="mt-2 text-lg text-gray-400">Engineer of Minds — Natural & Machine</p>
        <p className="mt-1 text-sm italic text-cyan-400">"Where Change Happens"</p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 3 }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-black"
        ></motion.div>
      </section>

      {/* ABOUT SECTION */}
      <section className="snap-start h-screen px-8 py-16 flex flex-col items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black">
        <h2 className="text-3xl font-bold mb-4">About Me</h2>
        <p className="max-w-2xl text-center text-lg text-gray-300">
          I’m a passionate AI Engineer with a love for creative problem-solving and building intuitive digital experiences. I focus on bridging the gap between machine intelligence and human understanding through elegant design and efficient code.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="bg-gray-800/60 rounded-xl p-4 text-sm">🔧 Python, React, Node.js</div>
          <div className="bg-gray-800/60 rounded-xl p-4 text-sm">🧠 NLP, LLMs, OpenAI API</div>
          <div className="bg-gray-800/60 rounded-xl p-4 text-sm">🎨 UX-focused frontend</div>
          <div className="bg-gray-800/60 rounded-xl p-4 text-sm">🚀 Building futuristic UIs</div>
        </div>
      </section>

      {/* PROJECT SECTION */}
      <section className="snap-start h-screen px-8 py-16 flex flex-col items-center bg-black">
        <h2 className="text-3xl font-bold mb-8">Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900/50 rounded-xl p-4 hover:bg-gray-800 transition-all">
              <div className="h-40 bg-gray-700 rounded mb-4"></div>
              <h3 className="text-xl font-semibold">Project Title {i}</h3>
              <p className="text-sm text-gray-400 mt-2">Short description of what this project does and why it’s cool.</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONNECT SECTION */}
      <section className="snap-start h-screen px-8 py-16 flex flex-col items-center justify-center bg-gradient-to-t from-black via-gray-900 to-black">
        <h2 className="text-3xl font-bold mb-4">Let's Connect</h2>
        <p className="mb-8 text-gray-300">Open to collaborations, new ideas and bold visions.</p>
        <div className="flex space-x-6 text-2xl">
          <a href="#" className="hover:text-cyan-400"><FaGithub /></a>
          <a href="#" className="hover:text-cyan-400"><FaLinkedin /></a>
          <a href="#" className="hover:text-cyan-400"><FaTwitter /></a>
          <a href="mailto:your@email.com" className="hover:text-cyan-400"><FaEnvelope /></a>
        </div>
      </section>
    </div>
  );
}
