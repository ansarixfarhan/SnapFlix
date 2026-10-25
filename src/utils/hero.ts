import { heroui } from "@heroui/react";

export default heroui({
  defaultTheme: "dark",
  themes: {
    light: {
      colors: {
        primary: {
          50: "#FFF0F0",
          100: "#FFD1D3",
          200: "#FFA3A7",
          300: "#FF666E",
          400: "#F52A35",
          500: "#E50914",
          600: "#C10711",
          700: "#9A060E",
          800: "#73040B",
          900: "#4D0307",
          DEFAULT: "#E50914",
          foreground: "#FFFFFF",
        },
        warning: {
          50: "#FFF0F0",
          100: "#FFD1D3",
          200: "#FFA3A7",
          300: "#FF666E",
          400: "#F52A35",
          500: "#E50914",
          600: "#C10711",
          700: "#9A060E",
          800: "#73040B",
          900: "#4D0307",
          DEFAULT: "#E50914",
          foreground: "#FFFFFF",
        },
        //@ts-expect-error this is a custom color name
        "secondary-background": "#161618",
        focus: "#E50914",
      },
    },
    dark: {
      colors: {
        background: "#0c0c0e",
        //@ts-expect-error this is a custom color name
        "secondary-background": "#161618",
        primary: {
          50: "#FFF0F0",
          100: "#FFD1D3",
          200: "#FFA3A7",
          300: "#FF666E",
          400: "#F52A35",
          500: "#E50914",
          600: "#C10711",
          700: "#9A060E",
          800: "#73040B",
          900: "#4D0307",
          DEFAULT: "#E50914",
          foreground: "#FFFFFF",
        },
        warning: {
          50: "#FFF0F0",
          100: "#FFD1D3",
          200: "#FFA3A7",
          300: "#FF666E",
          400: "#F52A35",
          500: "#E50914",
          600: "#C10711",
          700: "#9A060E",
          800: "#73040B",
          900: "#4D0307",
          DEFAULT: "#E50914",
          foreground: "#FFFFFF",
        },
        focus: "#E50914",
      },
    },
  },
});
