import { createApiClient } from "./webApi.js";
import { createSubscriptionStore } from "./webSubscriptions.js";

const api = createApiClient();
const subscriptions = createSubscriptionStore();

const state = {
  currentTab: "home", // home | search | activity | topicDetail
  currentTopicUid: null,
  // 首页相关状态
  home: {
    selectedType: "normal", // normal | tag
    topics: [],
    pageIndex: 1,
    hasMore: true,
    isLoading: false,
    error: "",
  },
  // 搜索
  search: {
    query: "",
    isSearching: false,
    error: "",
    results: [],
    showSubscriptions: false,
  },
  // 活动
  activity: {
    items: [],
    isLoading: false,
    error: "",
  },
  // 详情
  detail: {
    topic: null,
    news: [],
    timeline: [],
    timelineTitle: "",
    isLoadingDetail: false,
    isLoadingTimeline: false,
    detailError: "",
    timelineError: "",
  },
};

function $(selector) {
  return document.querySelector(selector);
}

function renderApp() {
  const root = document.getElementById("app");
  root.innerHTML = "";

  const header = document.createElement("header");
  header.className = "app-header";
  const h1 = document.createElement("h1");
  h1.className = "app-header-title";
  h1.textContent = getHeaderTitle();
  header.appendChild(h1);

  const main = document.createElement("main");
  main.className = "app-content";
  main.appendChild(renderCurrentPage());

  const tabBar = renderTabBar();

  root.appendChild(header);
  root.appendChild(main);
  root.appendChild(tabBar);
}

function getHeaderTitle() {
  switch (state.currentTab) {
    case "home":
      return "订阅内容";
    case "search":
      return "搜索";
    case "activity":
      return "活动";
    case "topicDetail":
      return "话题详情";
    default:
      return "ReadHubX";
  }
}

function renderTabBar() {
  const bar = document.createElement("nav");
  bar.className = "tab-bar";

  const tabs = [
    { key: "home", label: "首页" },
    { key: "search", label: "搜索" },
    { key: "activity", label: "动态" },
  ];

  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tab-item" + (state.currentTab === tab.key ? " active" : "");
    item.textContent = tab.label;
    item.addEventListener("click", () => {
      state.currentTab = tab.key;
      if (tab.key === "home") {
        ensureHomeDataLoaded();
      } else if (tab.key === "activity") {
        ensureActivityLoaded();
      }
      renderApp();
    });
    bar.appendChild(item);
  });

  return bar;
}

function renderCurrentPage() {
  switch (state.currentTab) {
    case "home":
      return renderHomePage();
    case "search":
      return renderSearchPage();
    case "activity":
      return renderActivityPage();
    case "topicDetail":
      return renderTopicDetailPage();
    default:
      return document.createTextNode("未知页面");
  }
}

// ========== 首页：订阅话题 ==========

function renderHomePage() {
  const container = document.createElement("div");

  const allSubs = subscriptions.getAll();
  const nonTagSubs = allSubs.filter((s) => s.type.toLowerCase() !== "tag");
  const tagSubs = allSubs.filter((s) => s.type.toLowerCase() === "tag");

  if (allSubs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-state-title">暂无订阅内容</div>
      <div class="empty-state-desc">前往搜索页面添加订阅，精彩内容将会呈现在这里</div>
      <button class="button button-primary" id="go-search">去添加订阅</button>
    `;
    setTimeout(() => {
      const btn = document.getElementById("go-search");
      if (btn) {
        btn.addEventListener("click", () => {
          state.currentTab = "search";
          renderApp();
        });
      }
    });
    container.appendChild(empty);
    return container;
  }

  if (nonTagSubs.length > 0 && tagSubs.length > 0) {
    const segmented = document.createElement("div");
    segmented.className = "segmented";

    const btnNormal = document.createElement("button");
    btnNormal.textContent = "公司/产品";
    if (state.home.selectedType === "normal") btnNormal.classList.add("active");
    btnNormal.addEventListener("click", () => {
      state.home.selectedType = "normal";
      state.home.pageIndex = 1;
      loadHomeTopics(true);
    });

    const btnTag = document.createElement("button");
    btnTag.textContent = "标签";
    if (state.home.selectedType === "tag") btnTag.classList.add("active");
    btnTag.addEventListener("click", () => {
      state.home.selectedType = "tag";
      state.home.pageIndex = 1;
      loadHomeTopics(true);
    });

    segmented.appendChild(btnNormal);
    segmented.appendChild(btnTag);

    container.appendChild(segmented);

    const subsLabel = document.createElement("div");
    subsLabel.className = "section-title";
    subsLabel.textContent = "当前订阅:";
    container.appendChild(subsLabel);

    const subsRow = document.createElement("div");
    subsRow.className = "tag-row";
    const currentSubs = state.home.selectedType === "normal" ? nonTagSubs : tagSubs;
    currentSubs.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "chip chip-muted";
      chip.textContent = item.name;
      subsRow.appendChild(chip);
    });
    container.appendChild(subsRow);
  }

  const listWrapper = document.createElement("div");

  if (state.home.isLoading && state.home.pageIndex === 1) {
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "加载中...";
    listWrapper.appendChild(loading);
  } else if (state.home.error && state.home.pageIndex === 1) {
    const err = document.createElement("div");
    err.className = "empty-state";
    err.innerHTML = `<div class="empty-state-title text-danger">${state.home.error}</div>`;
    const btn = document.createElement("button");
    btn.className = "button button-primary";
    btn.textContent = "重试";
    btn.addEventListener("click", () => loadHomeTopics(true));
    err.appendChild(btn);
    listWrapper.appendChild(err);
  } else if (state.home.topics.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-state-title">暂无内容</div>
      <div class="empty-state-desc">尝试切换订阅类型或前往搜索添加更多订阅</div>
      <button class="button button-outline" id="home-go-search">去添加订阅</button>
    `;
    setTimeout(() => {
      const btn = document.getElementById("home-go-search");
      if (btn) {
        btn.addEventListener("click", () => {
          state.currentTab = "search";
          renderApp();
        });
      }
    });
    listWrapper.appendChild(empty);
  } else {
    state.home.topics.forEach((topic) => {
      listWrapper.appendChild(renderTopicCard(topic));
    });

    const footer = document.createElement("div");
    footer.className = "empty-state";
    if (state.home.isLoading && state.home.pageIndex > 1) {
      footer.textContent = "加载中...";
    } else if (!state.home.hasMore) {
      footer.textContent = "已经到底啦";
    } else {
      const moreBtn = document.createElement("button");
      moreBtn.className = "button button-outline";
      moreBtn.textContent = "加载更多";
      moreBtn.addEventListener("click", () => loadHomeTopics(false));
      footer.appendChild(moreBtn);
    }
    listWrapper.appendChild(footer);
  }

  container.appendChild(listWrapper);
  return container;
}

function renderTopicCard(topic) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = topic.title;

  const summary = document.createElement("div");
  summary.className = "card-subtitle";
  summary.textContent = topic.summary;

  const tagsRow = document.createElement("div");
  tagsRow.className = "tag-row";
  (topic.entityList || []).slice(0, 3).forEach((e) => {
    const span = document.createElement("span");
    span.className = "badge badge-blue";
    span.textContent = e.name;
    tagsRow.appendChild(span);
  });

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML = `
    <span>${topic.siteNameDisplay} 等${topic.siteCount}家媒体</span>
    <span>${topic.formattedPublishTime || ""}</span>
  `;

  card.appendChild(title);
  card.appendChild(summary);
  if (tagsRow.childElementCount > 0) card.appendChild(tagsRow);
  card.appendChild(meta);

  card.addEventListener("click", () => {
    state.currentTopicUid = topic.uid;
    state.currentTab = "topicDetail";
    loadTopicDetail();
  });

  return card;
}

async function loadHomeTopics(refresh) {
  const allSubs = subscriptions.getAll();
  const nonTagSubs = allSubs.filter((s) => s.type.toLowerCase() !== "tag");
  const tagSubs = allSubs.filter((s) => s.type.toLowerCase() === "tag");

  if (allSubs.length === 0) {
    state.home.topics = [];
    state.home.error = "";
    state.home.pageIndex = 1;
    state.home.hasMore = false;
    renderApp();
    return;
  }

  const currentType = state.home.selectedType;
  const currentSubs = currentType === "normal" ? nonTagSubs : tagSubs;
  if (currentSubs.length === 0) {
    state.home.topics = [];
    state.home.error = "";
    state.home.pageIndex = 1;
    state.home.hasMore = false;
    renderApp();
    return;
  }

  const nextPage = refresh ? 1 : state.home.pageIndex + 1;

  state.home.isLoading = true;
  if (refresh) {
    state.home.error = "";
    state.home.hasMore = true;
  }
  renderApp();

  try {
    const ids = currentSubs.map((s) => s.id).join(",");
    const params = { page: nextPage, size: 10 };
    if (currentType === "normal") {
      params.entity_id = ids;
    } else {
      params.tag_id = ids;
    }
    const resp = await api.get("/topic/list_pro", params);
    const rawItems = resp.data.items || [];
    const newItems = rawItems.map((t) => ({
      ...t,
      formattedPublishTime: api.formatRelativeOrDate(t.publishDate),
    }));

    if (refresh) {
      state.home.topics = newItems;
    } else {
      state.home.topics = state.home.topics.concat(newItems);
    }

    state.home.pageIndex = resp.data.pageIndex || nextPage;
    state.home.hasMore = newItems.length > 0;
    state.home.error = "";
  } catch (e) {
    console.error(e);
    state.home.error = e.message || "加载失败";
    if (refresh) {
      state.home.topics = [];
      state.home.pageIndex = 1;
      state.home.hasMore = false;
    }
  } finally {
    state.home.isLoading = false;
    renderApp();
  }
}

function ensureHomeDataLoaded() {
  if (state.home.topics.length === 0 && subscriptions.getAll().length > 0) {
    loadHomeTopics(true);
  }
}

// ========== 搜索与订阅 ==========

function renderSearchPage() {
  const container = document.createElement("div");

  const searchBar = document.createElement("div");
  searchBar.className = "search-bar";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "输入关键词搜索";
  input.value = state.search.query;
  input.addEventListener("input", (e) => {
    state.search.query = e.target.value;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  const btn = document.createElement("button");
  btn.className = "button button-primary";
  btn.textContent = "搜索";
  btn.addEventListener("click", () => doSearch());

  searchBar.appendChild(input);
  searchBar.appendChild(btn);

  const segmented = document.createElement("div");
  segmented.className = "segmented";

  const btnResult = document.createElement("button");
  btnResult.textContent = "搜索结果";
  if (!state.search.showSubscriptions) btnResult.classList.add("active");
  btnResult.addEventListener("click", () => {
    state.search.showSubscriptions = false;
    renderApp();
  });

  const btnSubs = document.createElement("button");
  btnSubs.textContent = "我的订阅";
  if (state.search.showSubscriptions) btnSubs.classList.add("active");
  btnSubs.addEventListener("click", () => {
    state.search.showSubscriptions = true;
    renderApp();
  });

  segmented.appendChild(btnResult);
  segmented.appendChild(btnSubs);

  container.appendChild(searchBar);
  container.appendChild(segmented);

  const content = document.createElement("div");

  if (!state.search.showSubscriptions) {
    if (!state.search.query.trim()) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "请输入关键词搜索";
      content.appendChild(empty);
    } else if (state.search.isSearching) {
      const loading = document.createElement("div");
      loading.className = "empty-state";
      loading.textContent = "搜索中...";
      content.appendChild(loading);
    } else if (state.search.error) {
      const err = document.createElement("div");
      err.className = "empty-state";
      err.innerHTML = `<div class="empty-state-title text-danger">${state.search.error}</div>`;
      const btnRetry = document.createElement("button");
      btnRetry.className = "button button-primary";
      btnRetry.textContent = "重试";
      btnRetry.addEventListener("click", () => doSearch());
      err.appendChild(btnRetry);
      content.appendChild(err);
    } else if (state.search.results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "未找到相关结果";
      content.appendChild(empty);
    } else {
      state.search.results.forEach((item) => {
        content.appendChild(renderSearchItem(item));
      });
    }
  } else {
    const subs = subscriptions.getAll();
    if (subs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "暂无订阅内容";
      content.appendChild(empty);
    } else {
      subs.forEach((item) => {
        content.appendChild(renderSearchItem(item, true));
      });
    }
  }

  container.appendChild(content);
  return container;
}

function renderSearchItem(item, forceSubscribed = false) {
  const card = document.createElement("div");
  card.className = "card";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";

  const textCol = document.createElement("div");
  textCol.style.flex = "1";

  const name = document.createElement("div");
  name.className = "card-title";
  name.textContent = item.name;

  const tagRow = document.createElement("div");
  const badge = document.createElement("span");
  const lowerType = (item.type || "").toLowerCase();
  let label = item.type;
  let badgeClass = "badge badge-blue";
  switch (lowerType) {
    case "company":
      label = "公司";
      badgeClass = "badge badge-blue";
      break;
    case "product":
      label = "产品";
      badgeClass = "badge badge-green";
      break;
    case "person":
      label = "人物";
      badgeClass = "badge badge-purple";
      break;
    case "tag":
      label = "标签";
      badgeClass = "badge badge-orange";
      break;
  }
  badge.className = badgeClass;
  badge.textContent = label;
  tagRow.appendChild(badge);

  textCol.appendChild(name);
  textCol.appendChild(tagRow);

  const isSub = forceSubscribed || subscriptions.isSubscribed(item);

  const btn = document.createElement("button");
  btn.className = "button button-ghost";
  btn.style.borderRadius = "8px";
  btn.style.border = `1px solid ${isSub ? "#fa8c16" : "#1677ff"}`;
  btn.style.color = isSub ? "#fa8c16" : "#1677ff";
  btn.textContent = isSub ? "已订阅" : "订阅";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isSub) {
      subscriptions.remove(item);
    } else {
      subscriptions.add(item);
    }
    renderApp();
  });

  row.appendChild(textCol);
  row.appendChild(btn);
  card.appendChild(row);

  return card;
}

async function doSearch() {
  const q = state.search.query.trim();
  if (!q) return;

  state.search.isSearching = true;
  state.search.error = "";
  state.search.results = [];
  renderApp();

  try {
    const resp = await api.get("/tmt_entity/suggest", { q });
    const raw = resp.data || [];
    state.search.results = raw.map((d) => ({
      ...d,
      id: d.entityId || d.id,
      name: d.entityName || d.name,
      type: d.entityType || d.type,
    }));
  } catch (e) {
    console.error(e);
    state.search.error = e.message || "搜索失败";
  } finally {
    state.search.isSearching = false;
    renderApp();
  }
}

// ========== 活动列表 ==========

function renderActivityPage() {
  const container = document.createElement("div");

  if (state.activity.isLoading) {
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "加载中...";
    container.appendChild(loading);
    return container;
  }

  if (state.activity.error) {
    const err = document.createElement("div");
    err.className = "empty-state";
    err.innerHTML = `<div class="empty-state-title text-danger">${state.activity.error}</div>`;
    const btn = document.createElement("button");
    btn.className = "button button-primary";
    btn.textContent = "重试";
    btn.addEventListener("click", () => loadActivities());
    err.appendChild(btn);
    container.appendChild(err);
    return container;
  }

  if (!state.activity.items || state.activity.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无活动数据";
    container.appendChild(empty);
    return container;
  }

  state.activity.items.forEach((act) => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = act.name;

    const sub = document.createElement("div");
    sub.className = "card-subtitle";
    sub.textContent = `开始: ${act.formattedStartTime}`;

    const notify = document.createElement("div");
    notify.className = "card-subtitle";
    notify.textContent = `通知时间: ${act.formattedNotifyTime}`;

    const linkRow = document.createElement("div");
    linkRow.style.display = "flex";
    linkRow.style.justifyContent = "space-between";
    linkRow.style.alignItems = "center";

    const link = document.createElement("a");
    link.href = act.url;
    link.target = "_blank";
    link.className = "link";
    link.textContent = "查看活动网页";

    const btnDetail = document.createElement("button");
    btnDetail.className = "button button-outline";
    btnDetail.textContent = "查看话题";
    btnDetail.addEventListener("click", () => {
      if (act.topicId) {
        state.currentTopicUid = act.topicId;
        state.currentTab = "topicDetail";
        loadTopicDetail();
      }
    });

    linkRow.appendChild(link);
    linkRow.appendChild(btnDetail);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(notify);
    card.appendChild(linkRow);

    container.appendChild(card);
  });

  return container;
}

async function loadActivities() {
  state.activity.isLoading = true;
  state.activity.error = "";
  renderApp();

  try {
    const resp = await api.get("/activity/online/list");
    const items = resp.data || [];
    state.activity.items = items.map((it) => ({
      ...it,
      formattedStartTime: api.formatDate(it.startAt),
      formattedNotifyTime: api.formatDate(it.notifyAt),
    }));
  } catch (e) {
    console.error(e);
    state.activity.error = e.message || "加载失败";
  } finally {
    state.activity.isLoading = false;
    renderApp();
  }
}

function ensureActivityLoaded() {
  if (!state.activity.items || state.activity.items.length === 0) {
    loadActivities();
  }
}

// ========== 话题详情 ==========

function renderTopicDetailPage() {
  const container = document.createElement("div");

  if (!state.currentTopicUid) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "未指定话题";
    container.appendChild(empty);
    return container;
  }

  if (state.detail.isLoadingDetail && !state.detail.topic) {
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "加载中...";
    container.appendChild(loading);
    return container;
  }

  if (state.detail.detailError && !state.detail.topic) {
    const err = document.createElement("div");
    err.className = "empty-state";
    err.innerHTML = `<div class="empty-state-title text-danger">${state.detail.detailError}</div>`;
    const btn = document.createElement("button");
    btn.className = "button button-primary";
    btn.textContent = "重试";
    btn.addEventListener("click", () => loadTopicDetail());
    err.appendChild(btn);
    container.appendChild(err);
    return container;
  }

  if (state.detail.topic) {
    const t = state.detail.topic;

    const title = document.createElement("div");
    title.className = "card-title";
    title.style.marginBottom = "8px";
    title.textContent = t.title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.style.marginBottom = "8px";
    meta.innerHTML = `
      <span>${t.siteNameDisplay} 等${t.siteCount}家媒体</span>
      <span>${t.formattedPublishTime || ""}</span>
    `;

    const summary = document.createElement("div");
    summary.className = "card-subtitle";
    summary.style.marginBottom = "8px";
    summary.textContent = t.summary;

    container.appendChild(title);
    container.appendChild(meta);
    container.appendChild(summary);

    const entities = (t.entityList || []).slice(0, 3);
    if (entities.length > 0) {
      const row = document.createElement("div");
      row.className = "tag-row";
      entities.forEach((e) => {
        const tag = document.createElement("span");
        tag.className = "badge badge-blue";
        tag.textContent = e.name;
        row.appendChild(tag);
      });
      container.appendChild(row);
    }

    const tags = (t.tagList || []).slice(0, 3);
    if (tags.length > 0) {
      const row = document.createElement("div");
      row.className = "tag-row";
      tags.forEach((tg) => {
        const tag = document.createElement("span");
        tag.className = "badge badge-green";
        tag.textContent = tg.name || tg;
        row.appendChild(tag);
      });
      container.appendChild(row);
    }
  }

  const divider = document.createElement("div");
  divider.className = "section-title";
  divider.textContent = "相关报道";
  container.appendChild(divider);

  if (state.detail.isLoadingDetail && state.detail.topic) {
    const loading = document.createElement("div");
    loading.className = "text-muted";
    loading.textContent = "刷新中...";
    container.appendChild(loading);
  }

  if (state.detail.news && state.detail.news.length > 0) {
    state.detail.news.forEach((news) => {
      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = news.title;

      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.innerHTML = `
        <span>${news.siteName}</span>
        <span>${news.formattedPublishTime || ""}</span>
      `;

      card.appendChild(title);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        if (news.mobileUrl) {
          window.open(news.mobileUrl, "_blank");
        }
      });

      container.appendChild(card);
    });
  } else if (!state.detail.isLoadingDetail && !state.detail.detailError) {
    const empty = document.createElement("div");
    empty.className = "text-muted";
    empty.textContent = "暂无相关报道";
    container.appendChild(empty);
  }

  const tlTitle = document.createElement("div");
  tlTitle.className = "section-title";
  tlTitle.style.marginTop = "16px";
  tlTitle.textContent = state.detail.timelineTitle || "话题追踪";
  container.appendChild(tlTitle);

  if (state.detail.isLoadingTimeline) {
    const loading = document.createElement("div");
    loading.className = "text-muted";
    loading.textContent = "时间线加载中...";
    container.appendChild(loading);
  } else if (state.detail.timelineError) {
    const err = document.createElement("div");
    err.className = "text-danger";
    err.textContent = state.detail.timelineError;
    container.appendChild(err);
  } else if (!state.detail.timeline || state.detail.timeline.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-muted";
    empty.textContent = "暂无话题时间线数据";
    container.appendChild(empty);
  } else {
    state.detail.timeline.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "timeline-item";

      const line = document.createElement("div");
      line.className = "timeline-line";
      const dot = document.createElement("div");
      dot.className = "timeline-dot";
      line.appendChild(dot);
      if (idx !== state.detail.timeline.length - 1) {
        const conn = document.createElement("div");
        conn.className = "timeline-connector";
        line.appendChild(conn);
      }

      const body = document.createElement("div");
      const date = document.createElement("div");
      date.className = "text-muted";
      date.style.fontSize = "12px";
      date.textContent = item.formattedShortDate || item.date || "";

      const title = document.createElement("div");
      title.style.fontSize = "14px";
      title.textContent = item.title;

      body.appendChild(date);
      body.appendChild(title);

      row.appendChild(line);
      row.appendChild(body);

      container.appendChild(row);
    });
  }

  return container;
}

async function loadTopicDetail() {
  if (!state.currentTopicUid) return;

  state.detail.isLoadingDetail = true;
  state.detail.detailError = "";
  if (!state.detail.topic) {
    renderApp();
  }

  try {
    const resp = await api.get("/topic/detail", { uid: state.currentTopicUid });
    const items = resp.data.items || [];
    if (items.length === 0) {
      state.detail.detailError = "未找到话题详情";
      state.detail.topic = null;
      state.detail.news = [];
    } else {
      const t = items[0];
      const formatted = {
        ...t,
        formattedPublishTime: api.formatRelativeOrDate(t.publishDate),
      };
      const newsList = (t.newsAggList || []).map((n) => ({
        ...n,
        siteName: n.siteName || n.siteNameDisplay,
        mobileUrl: n.mobileUrl || n.url,
        formattedPublishTime: n.publishDate
          ? api.formatRelativeOrDate(n.publishDate)
          : "",
      }));
      state.detail.topic = formatted;
      state.detail.news = newsList;
      state.detail.detailError = "";
    }
  } catch (e) {
    console.error(e);
    state.detail.detailError = e.message || "加载失败";
  } finally {
    state.detail.isLoadingDetail = false;
    renderApp();
    loadTimeline();
  }
}

async function loadTimeline() {
  if (!state.currentTopicUid) return;

  state.detail.isLoadingTimeline = true;
  state.detail.timelineError = "";
  renderApp();

  try {
    const resp = await api.get("/topic/timeline/list", {
      topic_uid: state.currentTopicUid,
      size: 10,
    });
    const data = resp.data || {};
    state.detail.timeline = (data.items || []).map((it) => ({
      ...it,
      formattedShortDate: api.formatDate(it.date || it.publishDate),
    }));
    state.detail.timelineTitle = (data.sel && data.sel.title) || "";
  } catch (e) {
    console.error(e);
    state.detail.timelineError = e.message || "时间线加载失败";
  } finally {
    state.detail.isLoadingTimeline = false;
    renderApp();
  }
}

// ========== 启动 ==========

function bootstrap() {
  renderApp();
  ensureHomeDataLoaded();
}

document.addEventListener("DOMContentLoaded", bootstrap);
