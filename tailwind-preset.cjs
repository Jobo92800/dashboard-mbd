/**
 * MAbeautyplus — preset Tailwind (v2, septembre 2026)
 * Usage : dans tailwind.config.js → presets: [require('./tailwind-preset.js')]
 * Toutes les couleurs sont préfixées « mab- » pour ne jamais écraser la palette
 * Tailwind par défaut (ex. bg-mab-aqua, text-mab-encre, border-mab-filet).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        mab: {
          blanc: '#ffffff',
          wash: '#f4fbfb', 'wash-2': '#eaf7f7', 'wash-halo': '#e7f7f7',
          'rose-wash': '#fef3f8', 'violet-wash': '#f2eefa',
          rail: '#e4f2f2', filet: '#e6efef',
          'filet-aqua': '#a8dede', 'filet-violet': '#cfc0e8', 'filet-rose': '#f6d3e4',
          aqua: '#3bbfbf', 'aqua-profond': '#2aa5a5', 'aqua-texte': '#1f7f7f',
          'aqua-encre': '#0f4344', 'aqua-clair': '#7fd4d4',
          rose: '#e8318a', 'rose-texte': '#c42872',
          violet: '#8e6fc6', 'violet-texte': '#7a5cb5',
          encre: '#152b2c', texte: '#41595a', gris: '#7c9091', 'gris-doux': '#9babab',
          'profond-haut': '#0f4344', 'profond-bas': '#175a5c',
          'profond-texte': '#cfeded', 'profond-doux': '#9fdcdc', 'profond-source': '#7fa8a8',
          'terrain-1-fond': '#e7f7f7', 'terrain-1-filet': '#b0e0e0', 'terrain-1-texte': '#1f7f7f',
          'terrain-2-fond': '#edf3f9', 'terrain-2-filet': '#c6daea', 'terrain-2-texte': '#3d6e93',
          'terrain-3-fond': '#f2eefa', 'terrain-3-filet': '#cfc0e8', 'terrain-3-texte': '#6b52a0',
          'terrain-4-fond': '#f9edf6', 'terrain-4-filet': '#e5c5dd', 'terrain-4-texte': '#8e3c80',
          'terrain-5-fond': '#fef0f6', 'terrain-5-filet': '#f6cfe2', 'terrain-5-texte': '#c42872',
          succes: '#1f8a5f', erreur: '#c0392b',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontWeight: { light: '300', normal: '400', medium: '500', semibold: '600', bold: '700' },
      borderRadius: {
        'mab-puce': '6px', 'mab-etiquette': '8px', 'mab-visuel': '12px', 'mab-champ': '14px',
        'mab-carte': '18px', 'mab-bloc': '20px', 'mab-encadre': '22px', 'mab-pilule': '999px',
      },
      boxShadow: {
        'mab-carte': '0 6px 16px -10px rgba(21,43,44,.28)',
        'mab-flottante': '0 16px 36px -24px rgba(21,43,44,.5)',
        'mab-cta': '0 10px 26px -10px rgba(232,49,138,.5)',
        'mab-profonde': '0 14px 30px -14px rgba(0,0,0,.7)',
      },
      backgroundImage: {
        'mab-degrade-marque': 'linear-gradient(90deg, #3bbfbf 0%, #8e6fc6 55%, #e8318a 100%)',
        'mab-degrade-profond': 'linear-gradient(158deg, #0f4344 0%, #175a5c 100%)',
        'mab-halo-haut': 'radial-gradient(1350px 620px at 50% -250px, #e7f7f7 0%, rgba(231,247,247,0) 70%)',
      },
      maxWidth: { 'mab-texte': '680px', 'mab-formulaire': '720px', 'mab-lp': '1140px' },
    },
  },
};
