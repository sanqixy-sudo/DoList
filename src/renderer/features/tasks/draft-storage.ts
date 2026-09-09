/** Small local drafts survive renderer reloads and accidental application termination. */
export function createDraftMap<T>(key: string, validate: (value: any) => boolean = () => true) {
  class DraftMap extends Map<string, T> {
    persistenceError = '';
    private persist() {
      try { localStorage.setItem(key, JSON.stringify([...this.entries()])); this.persistenceError = ''; }
      catch { this.persistenceError = '草稿暂存失败，当前输入仍保留在窗口中。请保存成功后再关闭应用。'; }
    }
    set(id: string, value: T) { super.set(id, value); this.persist(); return this; }
    delete(id: string) { const result = super.delete(id); this.persist(); return result; }
  }
  const map = new DraftMap();
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(stored)) for (const item of stored) {
      if (Array.isArray(item) && typeof item[0] === 'string' && item[1] && typeof item[1] === 'object' && validate(item[1])) Map.prototype.set.call(map, item[0], item[1]);
    }
  } catch { /* Corrupt draft storage does not prevent opening saved tasks. */ }
  return map;
}
