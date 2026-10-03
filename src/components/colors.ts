/** Stable hue per participant so names and avatars are easy to tell apart. */
export function colorFor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 65% 62%)`
}
