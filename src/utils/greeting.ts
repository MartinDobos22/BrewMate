/**
 * Returns a Slovak time-of-day greeting based on the local hour.
 *
 *   05:00 – 11:59 → Dobré ráno
 *   12:00 – 17:59 → Dobrý deň
 *   18:00 – 04:59 → Dobrý večer
 */
export function getTimeGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return 'Dobré ráno';
  }
  if (hour >= 12 && hour < 18) {
    return 'Dobrý deň';
  }
  return 'Dobrý večer';
}

/** Long Slovak date — e.g. "Utorok, 11. apríl". */
export function formatSlovakDate(date: Date = new Date()): string {
  try {
    const formatted = date.toLocaleDateString('sk-SK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    // Capitalize the first letter (toLocaleDateString returns lowercase in sk-SK)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return '';
  }
}
