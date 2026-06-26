export interface ResolvedBrandingSettings {
  appName: string;
  logoSrc: string | null | undefined;
}

export function resolveBrandingSettings(
  rawSettings: string | null,
  serverAppName: string,
  serverLogoSrc: string | null | undefined,
): ResolvedBrandingSettings {
  if (!rawSettings) return { appName: serverAppName, logoSrc: serverLogoSrc };

  try {
    const settings = JSON.parse(rawSettings) as Record<string, unknown>;
    const appName = typeof settings.appName === "string" ? settings.appName : serverAppName;
    const hasLogo = Object.prototype.hasOwnProperty.call(settings, "logoBase64");
    const logoSrc = hasLogo
      ? (typeof settings.logoBase64 === "string" ? settings.logoBase64 : null)
      : serverLogoSrc;

    return { appName, logoSrc };
  } catch {
    return { appName: serverAppName, logoSrc: serverLogoSrc };
  }
}
