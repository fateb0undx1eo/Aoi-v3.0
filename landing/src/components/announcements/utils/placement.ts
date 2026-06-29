export function getPlacement(el: HTMLElement): "above" | "below" {
  const rect = el.getBoundingClientRect();
  const center = rect.top + rect.height / 2;
  const vh = window.innerHeight;
  return center < vh / 2 ? "below" : "above";
}
