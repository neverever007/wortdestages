import { Badge } from './types';

export const DEFAULT_BADGES: Badge[] = [
  { id: 'anfaenger', name: 'Anfänger', beschreibung: 'Die App zum ersten Mal geöffnet', icon: '🌱' },
  { id: 'streak_3', name: 'Drei Tage', beschreibung: '3 Tage in Folge die App geöffnet', icon: '⚡' },
  { id: 'streak_7', name: 'Eine Woche', beschreibung: '7 Tage in Folge die App geöffnet', icon: '🔥' },
  { id: 'streak_30', name: 'Ein Monat', beschreibung: '30 Tage in Folge die App geöffnet', icon: '🏆' },
  { id: 'first_favorite', name: 'Erster Favorit', beschreibung: 'Das erste Wort als Favorit gespeichert', icon: '♥️' },
  { id: 'ten_favorites', name: 'Sammler', beschreibung: '10 Wörter als Favoriten gespeichert', icon: '📚' },
  { id: 'first_usage', name: 'Erstanwender', beschreibung: 'Ein Wort zum ersten Mal im Alltag benutzt', icon: '💬' },
  { id: 'ten_usage', name: 'Wortgewandt', beschreibung: '10 Wörter im Alltag benutzt', icon: '🎯' },
  { id: 'wortfinder', name: 'Wortfinder', beschreibung: 'Eigener Vorschlag wurde veröffentlicht', icon: '🔍' },
  { id: 'mein_wort', name: 'Tagebuchschreiber', beschreibung: 'Erstes persönliches Wort des Tages eingetragen', icon: '✍️' },
];
