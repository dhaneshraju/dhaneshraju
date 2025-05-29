/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    },
    fontSize: {
      'xs': '0.75rem',    // 12px
      'sm': '0.875rem',   // 14px
      'base': '1rem',     // 16px
      'lg': '1.125rem',   // 18px
      'xl': '1.25rem',    // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },
    extend: {
      spacing: {
        '72': '18rem',
        '80': '20rem',
        '88': '22rem',
        '96': '24rem',
        '104': '26rem',
        '112': '28rem',
        '120': '30rem',
      },
      maxHeight: {
        'chat': 'calc(100vh - 8rem)',
        'chat-mobile': 'calc(100vh - 6rem)',
      },
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
