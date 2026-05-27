export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs < 10_000) {
    return sign + "$" + Math.round(abs).toLocaleString("en-US");
  }

  if (abs < 1_000_000) {
    const compact = abs / 1_000;
    const formatted = parseFloat(compact.toFixed(1)).toString();
    return sign + "$" + formatted + "K";
  }

  if (abs < 1_000_000_000) {
    const compact = abs / 1_000_000;
    const formatted = parseFloat(compact.toFixed(1)).toString();
    return sign + "$" + formatted + "M";
  }

  const compact = abs / 1_000_000_000;
  const formatted = parseFloat(compact.toFixed(1)).toString();
  return sign + "$" + formatted + "B";
}

export function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "0";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs < 1_000) {
    return sign + Math.round(abs).toString();
  }

  const compact = abs / 1_000;
  const formatted = parseFloat(compact.toFixed(1)).toString();
  return sign + formatted + "K";
}
