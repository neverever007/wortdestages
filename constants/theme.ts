export const lightTheme = {
  paper: '#FAF7F0',
  card: '#FFFFFF',
  ink: '#1F1A14',
  inkSoft: '#5C5347',
  rule: '#D9D2C2',
  accent: '#B5502E',
  green: '#5A7D5A',
  red: '#A8493A',
  gold: '#C99A3C',
};

export const darkTheme = {
  paper: '#171310',
  card: '#231D17',
  ink: '#F2ECE2',
  inkSoft: '#A89C8A',
  rule: '#3A3128',
  accent: '#E08158',
  green: '#7FA87F',
  red: '#D17A6A',
  gold: '#D9B567',
};

export type Theme = typeof lightTheme;

// Wichtig: Die ursprüngliche App hat Fraunces/Inter verwendet, aber im Projekt waren keine
// echten Schriftdateien vorhanden. Nicht geladene Custom Fonts können die App direkt crashen.
// Deshalb nutzen wir robuste System-Schriften. Später kannst du Custom Fonts wieder sauber laden.
export const fonts = {
  serif: undefined,
  serifItalic: undefined,
  serifSemiBold: undefined,
  sans: undefined,
  sansMedium: undefined,
  sansSemiBold: undefined,
};
