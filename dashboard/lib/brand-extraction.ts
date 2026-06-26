export type BrandPresetSaveAction = "created" | "updated";

export function formatBrandPresetSaveMessage(label: string, action: BrandPresetSaveAction): string {
  return action === "updated" ? `Updated "${label}" preset.` : `Saved "${label}" to presets.`;
}
