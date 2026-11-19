/**
 * Tiny DOM helpers for the Android WebView.
 *
 * The WebView shipped on older Android images is Chromium 83, which has no
 * `Element.replaceChildren`. These helpers do the same job with APIs that have
 * existed since Chromium 1, so the shop/inventory counters never throw.
 */

export function clearNode(element) {
  if (!element) return element;
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

export function setChildren(element, ...nodes) {
  clearNode(element);
  nodes.forEach((node) => {
    if (Array.isArray(node)) node.forEach((child) => child && element.appendChild(child));
    else if (node) element.appendChild(node);
  });
  return element;
}
