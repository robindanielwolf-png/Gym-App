// Vorschau und Live teilen sich die Domain und damit IndexedDB. Der Speichername
// ergibt sich aus dem Ablageort, derselbe Code läuft unverändert an beiden Stellen.
const APP_PFAD = new URL('../', import.meta.url).pathname;

export const IST_VORSCHAU = APP_PFAD.endsWith('/vorschau/');
export const DB_NAME = IST_VORSCHAU ? 'gym-tracker-vorschau' : 'gym-tracker';
