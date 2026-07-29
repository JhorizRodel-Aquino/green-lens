/** Deterministic first-login password: name initials + first 2 letters of region + current year. */
export function generateInitialPassword(name: string, regionName: string, year = new Date().getFullYear()): string {
    const initials = name.trim().split(/\s+/).map((word) => word[0]).join('').toUpperCase();
    const regionPrefix = regionName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    return `${initials}${regionPrefix}${year}`;
}
