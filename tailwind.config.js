/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      animation: {
        'hue-rotate': 'hueRotate 6s linear infinite',
        'scan': 'scan 2s linear infinite',
        'bounce': 'bounce 1.5s infinite',
      },
      keyframes: {
        hueRotate: {
          '0%': { '--tw-hue-rotate': '0deg' },
          '100%': { '--tw-hue-rotate': '360deg' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animationDelay: {
        '100': '100ms',
      },
    },
  },
  plugins: [
    function({ addVariant, e }) {
      addVariant('animation-delay', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.${e(`animation-delay${separator}${className}`)}`;
        });
      });
    },
  ],
}
