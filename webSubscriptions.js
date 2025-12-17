const STORAGE_KEY = "readhub_web_subscriptions";
const VERSION_KEY = "readhub_web_subscriptions_version";
const LATEST_VERSION = "v1";

export function createSubscriptionStore() {
  ensureVersion();

  function ensureVersion() {
    const current = localStorage.getItem(VERSION_KEY);
    if (current !== LATEST_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, LATEST_VERSION);
    }
  }

  function getAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      console.error("订阅解码失败", e);
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("订阅保存失败", e);
    }
  }

  function add(item) {
    const list = getAll();
    if (list.some((x) => x.id === item.id)) return;
    list.push({ id: item.id, name: item.name, type: item.type });
    save(list);
  }

  function remove(item) {
    const list = getAll();
    const next = list.filter((x) => x.id !== item.id);
    save(next);
  }

  function isSubscribed(item) {
    return getAll().some((x) => x.id === item.id);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { getAll, add, remove, isSubscribed, clearAll };
}
