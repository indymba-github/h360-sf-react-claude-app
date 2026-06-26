export function getPresetLogoCaption(logoDataUrl: string | null): string {
  if (!logoDataUrl) return "";
  if (logoDataUrl.startsWith("data:")) {
    const bytes = Math.round((logoDataUrl.length * 3) / 4 / 1024);
    return `Custom upload, ${bytes} KB`;
  }
  if (logoDataUrl.startsWith("/")) return logoDataUrl.split("/").pop() ?? logoDataUrl;
  return "Loaded from URL";
}
