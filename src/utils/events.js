// Tiny pub/sub so modules stay decoupled (see plan §9.2).
const handlers = new Map();

export const bus = {
  on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type).delete(fn);
  },
  emit(type, payload) {
    handlers.get(type)?.forEach((fn) => fn(payload));
  },
};
