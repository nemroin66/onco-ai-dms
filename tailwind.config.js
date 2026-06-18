export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      ultrawide: "1920px",
    },
    extend: {
      spacing: {
        sidebar: "260px",
        "sidebar-sm": "300px",
        "sidebar-lg": "244px",
      },
      maxWidth: {
        content: "1320px",
        "content-lg": "1120px",
        "content-md": "960px",
      },
      borderRadius: {
        app: "12px",
        card: "12px",
        button: "8px",
      },
      fontFamily: {
        sans: ["system-ui"],
      },
      fontSize: {
        "base-mobile": ["16px", { lineHeight: "1.45" }],
        "base-desktop": ["14px", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};
