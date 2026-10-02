// Number and date formats: German first (decimal comma), English prepared.
const datetime = { short: { dateStyle: 'medium', timeStyle: 'short' } } as const

export default defineI18nConfig(() => ({
  fallbackLocale: 'de',
  datetimeFormats: { de: datetime, en: datetime },
  numberFormats: {
    de: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      metres: { style: 'unit', unit: 'meter', maximumFractionDigits: 1 },
      seconds: { style: 'unit', unit: 'second', unitDisplay: 'narrow', maximumFractionDigits: 1 },
    },
    en: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      metres: { style: 'unit', unit: 'meter', maximumFractionDigits: 1 },
      seconds: { style: 'unit', unit: 'second', unitDisplay: 'narrow', maximumFractionDigits: 1 },
    },
  },
}))
