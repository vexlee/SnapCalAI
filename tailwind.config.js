/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#F4F7F5',
                    100: '#E3EBE6',
                    200: '#C1D6CB',
                    300: '#94B8A3',
                    400: '#64967F',
                    500: '#467A64',
                    600: '#3D745B', // Deep Forest Green
                    700: '#315C49',
                    800: '#274739',
                    900: '#1F3A2E',
                    950: '#11211A',
                },
                secondary: {
                    50: '#F5F7FA',
                    100: '#EBEFF5',
                    200: '#DDE4ED',
                    300: '#CAD5E0',
                    400: '#9FB1C1',
                    500: '#7B92A8',
                    600: '#5E7387',
                    700: '#485969',
                    800: '#36434F',
                    900: '#273038',
                    950: '#1A2026',
                },
                accent: {
                    50: '#fbf8f3',
                    100: '#f5efe4',
                    200: '#eaddc7',
                    300: '#dbc2a1',
                    400: '#cba376',
                    500: '#bf8a53',
                    600: '#b27242',
                    700: '#955b38',
                    800: '#794b32',
                    900: '#623f2b',
                    950: '#352014',
                },
                surface: {
                    DEFAULT: '#FAF9F6', // Off-white cream for cards
                    dark: '#1A1C26',
                },
                background: '#F3F0E7', // Cream/Bone background
                'surface-dark': '#1a211e', // Dark green/black for dark mode

                // Mapped Legacy Colors
                royal: {
                    50: '#F4F7F5',
                    100: '#E3EBE6',
                    200: '#C1D6CB',
                    300: '#94B8A3',
                    400: '#64967F',
                    500: '#467A64',
                    600: '#3D745B',
                    700: '#315C49',
                    800: '#274739',
                    900: '#1F3A2E',
                    950: '#11211A',
                },
            },
            borderRadius: {
                '3xl': '1.5rem',
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            boxShadow: {
                'soft': '0 10px 40px -10px rgba(0,0,0,0.08)',
                'soft-lg': '0 20px 60px -15px rgba(45, 74, 62, 0.15)',
                'diffused': '0 20px 50px rgba(0, 0, 0, 0.04)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
            },
            zIndex: {
                'base': 'var(--z-base)',
                'above': 'var(--z-above)',
                'sticky': 'var(--z-sticky)',
                'fixed-bg': 'var(--z-fixed-bg)',
                'nav': 'var(--z-nav)',
                'modal-backdrop': 'var(--z-modal-backdrop)',
                'modal': 'var(--z-modal)',
                'tooltip': 'var(--z-tooltip)',
                'max': 'var(--z-max)',
            },
        }
    },
    plugins: [],
}
