// Number formats: German first (decimal comma), English prepared.
export default defineI18nConfig(() => ({
  fallbackLocale: 'de',
  numberFormats: {
    de: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      metres: { style: 'unit', unit: 'meter', maximumFractionDigits: 1 },
      seconds: { style: 'unit', unit: 'second', maximumFractionDigits: 1 },
    },
    en: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      metres: { style: 'unit', unit: 'meter', maximumFractionDigits: 1 },
      seconds: { style: 'unit', unit: 'second', maximumFractionDigits: 1 },
    },
  },
}))
