/** Couleurs de repérage des projets et des personnes, prises dans la DA. */
export const PROJECT_COLORS = [
  '#3bbfbf', '#e8318a', '#8e6fc6', '#3d6e93', '#8e3c80',
  '#1f7f7f', '#6b52a0', '#c42872', '#0f4344', '#1f8a5f',
];

export function nextColor(used: string[]) {
  return PROJECT_COLORS.find((c) => !used.includes(c)) ?? PROJECT_COLORS[used.length % PROJECT_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
