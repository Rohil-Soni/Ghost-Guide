// Hash routing: #/loc/<id> deep-links to a focused location.
export function readLocFromHash() {
  const m = location.hash.match(/^#\/loc\/([\w-]+)/);
  return m ? m[1] : null;
}

export function setLocHash(id) {
  const next = id ? `#/loc/${id}` : ' ';
  history.replaceState(null, '', id ? next : location.pathname + location.search);
}

export const shareUrl = (id) => `${location.origin}${location.pathname}#/loc/${id}`;
