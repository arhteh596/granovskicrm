// Normalize avatar URL for proxying via Nginx and handle old absolute URLs
export function getAvatarSrc(raw?: string, version?: string | number): string {
    if (!raw) return '';
    try {
        // If full URL and points to localhost/back service, strip origin to make it relative
        if (/^https?:\/\//i.test(raw)) {
            const url = new URL(raw);
            // For any http(s) origin, use only pathname so Nginx /uploads proxy works
            const path = url.pathname + (url.search || '');
            return appendVersion(path, version);
        }
        // Already relative like /uploads/avatars/...
        return appendVersion(raw, version);
    } catch {
        // In case of malformed URL, return as-is
        return appendVersion(raw, version);
    }
}

function appendVersion(path: string, version?: string | number) {
    if (!version) return path;
    const hasQuery = path.includes('?');
    const sep = hasQuery ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(String(version))}`;
}

export function avatarOnError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const img = e.currentTarget as HTMLImageElement;
    // Prevent infinite loop
    if (img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    // Fallback to app logo or a generic placeholder
    img.src = '/assets/logo.png';
}
