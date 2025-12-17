const BASE_URL = "https://hubx-api-proxy.843699906.workers.dev";

export function createApiClient() {
  function buildUrl(path, params = {}) {
    const url = new URL(path, BASE_URL);
    const searchParams = url.searchParams;

    const common = {
      appVersion: "web-1.0",
      platform: "Web",
    };

    Object.entries({ ...common, ...params }).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        searchParams.set(k, String(v));
      }
    });

    return url.toString();
  }

  async function get(path, params) {
    const url = buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `请求失败: ${resp.status}`);
    }

    try {
      return await resp.json();
    } catch (e) {
      console.error("解码失败", e);
      throw new Error("数据解析错误");
    }
  }

  function parseIsoDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function formatDate(str) {
    const d = parseIsoDate(str);
    if (!d) return "未知时间";
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    return `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }

  function formatRelativeOrDate(str) {
    const d = parseIsoDate(str);
    if (!d) return "未知时间";
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const abs = Math.abs(diff);
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    if (abs < oneWeek) {
      if (abs < oneMinute) return "刚刚";
      if (abs < oneHour) {
        const m = Math.round(abs / oneMinute);
        return diff >= 0 ? `${m}分钟后` : `${m}分钟前`;
      }
      if (abs < oneDay) {
        const h = Math.round(abs / oneHour);
        return diff >= 0 ? `${h}小时后` : `${h}小时前`;
      }
      const dCount = Math.round(abs / oneDay);
      return diff >= 0 ? `${dCount}天后` : `${dCount}天前`;
    }

    return formatDate(str);
  }

  return { get, formatDate, formatRelativeOrDate };
}
