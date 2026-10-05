(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    main = $("#main");
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const storage = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };
  let lang = storage.get("gutman-language", "en");
  if (!COPY[lang]) lang = "en";
  const savedIds = storage.get("gutman-saved", []);
  let saved = new Set(Array.isArray(savedIds) ? savedIds : []);
  let view = "home",
    filters = {},
    limit = 18,
    map = null,
    mapLoading = null,
    lastView = "#home",
    quizIndex = 0,
    quizScore = 0,
    quizAnswered = false,
    memory = [],
    flipped = [],
    matched = new Set(),
    moves = 0,
    memoryLocked = false,
    memoryTimer = null;
  const data = window.JOURNEY_DATA || { posts: [], chapters: [], stats: {} };
  const posts = data.posts,
    byId = new Map(posts.map((p) => [p.id, p]));
  const t = (key) => COPY[lang][key] || COPY.en[key] || key;
  const tr = (value) =>
    typeof value === "string" ? value : value?.[lang] || value?.en || "";
  const fold = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
  const date = (value, short = false) =>
    value
      ? new Intl.DateTimeFormat(
          lang === "he" ? "he-IL" : lang === "es" ? "es-AR" : "en-GB",
          {
            year: short ? undefined : "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          },
        ).format(new Date(value))
      : t("dateUnknown");
  const countryCodes = {
    Argentina: "AR",
    Greece: "GR",
    Canada: "CA",
    Czechia: "CZ",
    Colombia: "CO",
    Switzerland: "CH",
    Chile: "CL",
    Bolivia: "BO",
    Peru: "PE",
    Israel: "IL",
    "United States": "US",
    USA: "US",
    Brazil: "BR",
    Uruguay: "UY",
    Mexico: "MX",
    Spain: "ES",
  };
  const countryName = (c) =>
    countryCodes[c]
      ? new Intl.DisplayNames([lang], { type: "region" }).of(countryCodes[c])
      : c || t("unknown");
  const topics = {
    funny: "smile",
    hard: "cloud-rain",
    views: "mountain",
    camping: "tent-tree",
    school: "graduation-cap",
    food: "utensils",
    beaches: "umbrella",
    waterfalls: "waves",
    hiking: "footprints",
    people: "users",
    learning: "book-open",
    truck: "truck",
    cities: "building-2",
    friendship: "heart-handshake",
    celebrations: "party-popper",
  };
  const img = (p, cls = "", eager = false) =>
    p?.image
      ? `<img class="${cls}" src="${esc(p.image)}" alt="${esc(tr(p.title))}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : `<div class="placeholder ${cls}">${icon("notebook-pen")}</div>`;
  const available = () => posts.filter((p) => !p.pending);
  function refreshIcons() {
    window.lucide?.createIcons();
  }
  function toast(text) {
    $("#toast").textContent = text;
    $("#toast").classList.add("visible");
    setTimeout(() => $("#toast").classList.remove("visible"), 2400);
  }
  function placeMatches(p, place) {
    const value = fold(
      `${p.place || ""} ${Object.values(p.title).join(" ")} ${Object.values(p.summary).join(" ")}`,
    );
    return place[3].some((x) => {
      const name = fold(x);
      if (/[\u0590-\u05ff]/.test(name)) return value.includes(name);
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "u").test(
        value,
      );
    });
  }
  function places() {
    return PLACES.map((p) => ({
      info: p,
      posts: posts.filter((s) => !s.pending && placeMatches(s, p)),
    })).filter((p) => p.posts.length);
  }
  function shell() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    $("#language").value = lang;
    $("#navigation").classList.remove("open");
    $("#menu-toggle").ariaExpanded = "false";
    $("#menu-toggle").ariaLabel = t("openMenu");
    $("#close-reader").ariaLabel = t("closeStory");
    $(".skip").textContent = t("skip");
    const primary = ["home", "stories", "book", "map", "gallery"];
    $("#navigation").innerHTML =
      primary
        .map(
          (v) =>
            `<a href="#${v}" class="${view === v ? "active" : ""}" ${view === v ? 'aria-current="page"' : ""}>${t(v)}</a>`,
        )
        .join("") +
      `<details class="nav-more"><summary>${t("more")}${icon("chevron-down")}</summary><div class="nav-menu">${[
        ["alma", "truck"],
        ["school", "graduation-cap"],
        ["timeline", "route"],
        ["people", "users"],
        ["games", "puzzle"],
        ["social", "instagram"],
        ["saved", "bookmark"],
      ]
        .map(([v, i]) => `<a href="#${v}">${icon(i)}${t(v)}</a>`)
        .join("")}</div></details>`;
    $("#random-top").title = t("random");
    $("#random-top").ariaLabel = t("random");
    $("#footer").className = "footer";
    $("#footer").innerHTML =
      `<div class="follow-band"><div><p class="eyebrow">${t("followIntro")}</p><h2>${t("follow")}</h2></div><div class="follow-buttons"><a class="btn" href="https://www.instagram.com/gutmanslifejourney/" target="_blank" rel="noopener noreferrer">${icon("instagram")}${t("followInstagram")}${icon("arrow-up-right")}</a><a class="btn secondary" href="https://www.facebook.com/p/Gutmans-Life-Journey-100071825661805/" target="_blank" rel="noopener noreferrer">${icon("facebook")}${t("followFacebook")}${icon("arrow-up-right")}</a></div></div><div class="footer-inner"><div><a href="#home" class="brand"><img class="brand-logo" src="assets/logo.jpg" alt="Gutman's Life Journey logo"><span>GUTMAN'S<small>LIFE JOURNEY</small></span></a><p>${t("footer")}</p></div><div class="footer-links"><a href="#book">${t("book")}</a><a href="#alma">${t("alma")}</a><a href="#school">${t("school")}</a><a href="#social">${t("archiveStatus")}</a></div></div><div class="footer-bottom"><span>${t("strip")}</span><span>${t("footerNote")}</span></div>`;
  }
  function meta(p) {
    return `<div class="meta"><span>${esc(p.place || countryName(p.country) || t("placeUnknown"))}</span><span class="dot"></span><time>${date(p.date)}</time></div>`;
  }
  function card(p) {
    return `<article class="story-card"><button class="icon-button save ${saved.has(p.id) ? "saved" : ""}" data-save="${p.id}" aria-label="${t(saved.has(p.id) ? "unsave" : "save")}" title="${t(saved.has(p.id) ? "unsave" : "save")}">${icon("bookmark")}</button><a class="image-link" href="#story/${p.id}">${img(p)}<span class="source-stamp">${p.pending ? t("pending") : new Set(p.sources.map((s) => s.platform)).size > 1 ? t("bothSources") : p.sources[0]?.platform === "facebook" ? "Facebook" : "Instagram"}</span></a>${meta(p)}<h3><a href="#story/${p.id}">${esc(tr(p.title))}</a></h3><p>${esc(tr(p.summary))}</p></article>`;
  }
  function intro(key, description, extra = "") {
    return `<div class="container page-intro"><p class="eyebrow">GUTMAN'S LIFE JOURNEY</p><h1>${t(key)}</h1><p>${t(description)}</p>${extra}</div>`;
  }
  function home() {
    const good = available().filter((p) => p.image);
    const daily =
      good[Math.floor(Date.now() / 86400000) % Math.max(good.length, 1)];
    const latest = good
      .filter((p) => p.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
    const collections = [
      ["funny", "DalGAcyMkc1", "collectionFunny"],
      ["hard", "C8mfoj9sUrp", "collectionHard"],
      ["views", "DVJRr_sDClu", "collectionViews"],
    ];
    main.innerHTML = `<section class="hero"><img src="assets/DVJRr_sDClu.webp" alt="Patagonian peaks photographed during the Gutman family journey" fetchpriority="high"><div class="container hero-content"><p class="eyebrow">${t("journey")}</p><h1>${t("hero")}</h1><p>${t("motto")}</p><a class="btn" href="#stories">${t("explore")}${icon("arrow-up-right")}</a></div><a class="hero-caption" href="#story/DVJRr_sDClu">${icon("map-pin")} Patagonia · ${t("original")}</a></section><div class="journey-strip"><div class="container"><div class="strip-stat"><strong>2021–2026</strong><span>${t("years")}</span></div><div class="strip-stat"><strong>${posts.length}</strong><span>${t("storiesCount")}</span></div><div class="strip-stat"><strong>${places().length}</strong><span>${t("placesCount")}</span></div><span class="strip-motto">${t("strip")}</span></div></div>
    <section class="container section"><div class="section-heading"><div><p class="eyebrow">${t("collectionsEye")}</p><h2>${t("collections")}</h2></div><a class="text-link" href="#stories">${t("allStories")}${icon("arrow-right")}</a></div><div class="collections">${collections.map(([topic, id, sub]) => `<a class="collection" href="#stories?topic=${topic}"><img src="assets/${id}.webp" alt="" loading="lazy"><span>${t(sub)}</span><h3>${t(topic)}</h3><span class="icon-button">${icon("arrow-up-right")}</span></a>`).join("")}</div></section>
    ${daily ? `<section class="daily-band"><div class="container section daily"><a class="daily-media" href="#story/${daily.id}">${img(daily)}<span>${esc(daily.place || countryName(daily.country))}</span></a><div class="daily-copy"><p class="eyebrow">${t("daily")}</p><h2>${esc(tr(daily.title))}</h2><p>${esc(tr(daily.summary))}</p><a href="#story/${daily.id}" class="text-link">${t("readStory")}${icon("arrow-right")}</a></div></div></section>` : ""}
    <section class="container section"><div class="section-heading"><div><p class="eyebrow">${t("stories")}</p><h2>${t("latest")}</h2></div><button class="text-link" style="background:none;border:0;border-bottom:1px solid" data-random>${icon("shuffle")}${t("random")}</button></div><div class="grid">${latest.map(card).join("")}</div></section>
    <section class="book-band"><img src="assets/DHvf6cps1vS.webp" alt="Alma in the mountain landscape" loading="lazy"><div class="book-invite"><p class="eyebrow">${t("bookEye")}</p><h2>${t("bookTitle")}</h2><p>${t("bookIntro")}</p><a class="btn" href="#book">${t("readBook")}${icon("book-open")}</a></div></section>
    <section class="container section"><div class="section-heading"><div><p class="eyebrow">${t("everydayIntro")}</p><h2>${t("everyday")}</h2></div></div><div class="everyday-grid">${[
      ["camping", "DSGu-IcjF-u"],
      ["food", "C_0XGIAxMoB"],
      ["beaches", "DSszFLhD7JK"],
      ["school", "DR56dHiDBwQ"],
    ]
      .map(
        ([topic, id]) =>
          `<a class="everyday-item" href="${topic === "school" ? "#school" : "#stories?topic=" + topic}"><img src="assets/${id}.webp" alt="" loading="lazy"><div><span>${icon(topics[topic])}${t(topic + "Sub")}</span><h3>${t(topic)}${icon("arrow-up-right")}</h3></div></a>`,
      )
      .join(
        "",
      )}</div><a href="#alma" class="alma-link"><img src="assets/DEIQsM6pME8.webp" alt="Alma" loading="lazy"><span><span class="eyebrow">${t("alma")}</span><strong>${t("almaIntro")}</strong></span>${icon("arrow-up-right")}</a></section>`;
  }
  function filterUI() {
    const countries = [
      ...new Set(posts.map((p) => p.country).filter(Boolean)),
    ].sort();
    const years = [
      ...new Set(posts.map((p) => p.date?.slice(0, 4)).filter(Boolean)),
    ]
      .sort()
      .reverse();
    return `<form class="filters" id="filter-form" role="search"><label class="search-box">${icon("search")}<input type="search" name="q" value="${esc(filters.q || "")}" placeholder="${t("search")}" aria-label="${t("search")}" autocomplete="off"></label><select name="country" aria-label="${t("allCountries")}"><option value="">${t("allCountries")}</option>${countries.map((c) => `<option ${filters.country === c ? "selected" : ""} value="${esc(c)}">${esc(countryName(c))}</option>`).join("")}</select><select name="year" aria-label="${t("allYears")}"><option value="">${t("allYears")}</option>${years.map((y) => `<option ${filters.year === y ? "selected" : ""}>${y}</option>`).join("")}</select><select name="sort" aria-label="${t("newest")}"><option value="newest">${t("newest")}</option><option value="oldest" ${filters.sort === "oldest" ? "selected" : ""}>${t("oldest")}</option></select><button class="icon-button" type="button" data-reset title="${t("reset")}" aria-label="${t("reset")}">${icon("rotate-ccw")}</button></form><div class="topics"><button class="topic-chip ${!filters.topic ? "active" : ""}" data-topic="">${t("allTopics")}</button>${Object.entries(
      topics,
    )
      .map(
        ([key, i]) =>
          `<button class="topic-chip ${filters.topic === key ? "active" : ""}" data-topic="${key}">${icon(i)}${t(key)}</button>`,
      )
      .join(
        "",
      )}</div><div class="filter-bottom"><span id="result-count" aria-live="polite"></span>${filters.place ? `<button class="text-link" data-clear-place type="button" aria-label="${t("reset")}: ${esc(filters.place)}">${esc(filters.place)}${icon("x")}</button>` : ""}<a href="#social">${t("archiveStatus")}${icon("arrow-up-right")}</a></div>`;
  }
  function filtered() {
    return posts
      .filter((p) => {
        if (view === "saved" && !saved.has(p.id)) return false;
        if (view === "gallery" && !p.image) return false;
        if (filters.country && p.country !== filters.country) return false;
        if (filters.year && p.date?.slice(0, 4) !== filters.year) return false;
        if (filters.topic && !p.topics.includes(filters.topic)) return false;
        if (filters.place) {
          const place = PLACES.find((v) => v[0] === filters.place);
          if (!place || p.pending || !placeMatches(p, place)) return false;
        }
        const query = fold(filters.q).trim();
        if (
          query &&
          !fold(
            `${Object.values(p.title).join(" ")} ${Object.values(p.summary).join(" ")} ${p.place || ""} ${p.country || ""} ${p.topics.join(" ")}`,
          ).includes(query)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.date) return b.date ? 1 : 0;
        if (!b.date) return -1;
        return filters.sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
  }
  function timelineRows(rows) {
    let year = "";
    return rows
      .map((p) => {
        const next = p.date?.slice(0, 4) || t("dateUnknown");
        const header =
          year !== next ? `<h2 class="timeline-year">${next}</h2>` : "";
        year = next;
        return `${header}<article class="timeline-row"><time>${date(p.date, true)}</time><a href="#story/${p.id}">${img(p)}</a><div><h3><a href="#story/${p.id}">${esc(tr(p.title))}</a></h3><p>${esc(p.place || countryName(p.country))}${p.travelDate ? ` · ${t("travelDate")}: ${date(p.travelDate)}` : ""}</p></div><a href="#story/${p.id}" class="icon-button" aria-label="${t("readStory")}">${icon("arrow-up-right")}</a></article>`;
      })
      .join("");
  }
  function renderResults() {
    const all = filtered(),
      rows = all.slice(0, limit);
    $("#result-count").textContent = `${all.length} ${t("results")}`;
    const target = $("#results");
    target.className =
      view === "timeline"
        ? "timeline"
        : view === "gallery"
          ? "gallery"
          : "grid";
    if (!rows.length) {
      target.className = "empty";
      target.innerHTML = `<h2>${t(view === "saved" ? "savedEmpty" : "noResults")}</h2><p>${t(view === "saved" ? "savedHint" : "tryAgain")}</p>`;
    } else if (view === "timeline") target.innerHTML = timelineRows(rows);
    else if (view === "gallery")
      target.innerHTML = rows
        .map(
          (p) =>
            `<button data-story="${p.id}" aria-label="${esc(tr(p.title))}">${img(p)}<span>${esc(tr(p.title))}</span></button>`,
        )
        .join("");
    else target.innerHTML = rows.map(card).join("");
    $("#more-results").hidden = all.length <= limit;
    refreshIcons();
  }
  function archive() {
    const introKey =
      view === "gallery"
        ? "galleryIntro"
        : view === "timeline"
          ? "timelineIntro"
          : view === "saved"
            ? "savedIntro"
            : "storyIntro";
    main.innerHTML =
      intro(
        view === "stories" && topics[filters.topic] ? filters.topic : view,
        introKey,
      ) +
      `<section class="container">${filterUI()}<div id="results"></div><button id="more-results" class="btn secondary load-more">${t("loadMore")}${icon("arrow-down")}</button></section>`;
    renderResults();
  }
  function updateFilters() {
    limit = 18;
    const url = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v),
    );
    history.replaceState(null, "", `#${view}${url.size ? "?" + url : ""}`);
    lastView = location.hash;
    renderResults();
    if (view === "stories")
      $(".page-intro h1").textContent = t(
        topics[filters.topic] ? filters.topic : view,
      );
    document
      .querySelectorAll("[data-topic]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.topic === (filters.topic || "")),
      );
  }
  function chapterText(ch) {
    return tr(ch.body || ch.text || ch.content);
  }
  function book() {
    const chapters = data.chapters;
    const requested =
      filters.chapter === undefined
        ? storage.get("gutman-chapter", 0)
        : Number(filters.chapter);
    let index = Math.min(
      chapters.length - 1,
      Math.max(0, Math.floor(Number(requested))),
    );
    if (!Number.isFinite(index)) index = 0;
    const ch = chapters[index];
    if (ch) storage.set("gutman-chapter", index);
    const source = ch?.sources.map((id) => byId.get(id)).find((p) => p?.image);
    main.innerHTML =
      intro(
        "book",
        "bookDescription",
        `<button class="btn secondary" data-print>${icon("printer")}${t("print")}</button>`,
      ) +
      `<div class="container"><p class="editor-note">${t("bookNote")}</p><div class="book-layout"><aside class="contents"><h2>${t("contents")}</h2>${chapters.map((c, i) => `<a href="#book?chapter=${i}" class="${i === index ? "active" : ""}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(tr(c.title))}</a>`).join("")}</aside><article class="book-chapter">${
        ch
          ? `<p class="eyebrow">${t("chapter")} ${String(index + 1).padStart(2, "0")}</p><h2>${esc(tr(ch.title))}</h2>${source ? img(source, "chapter-photo") : ""}<div class="chapter-body">${chapterText(
              ch,
            )
              .split(/\n\s*\n/)
              .map((p) => `<p>${esc(p)}</p>`)
              .join(
                "",
              )}</div><div class="chapter-sources"><strong>${t("sources")}</strong><br>${ch.sources
              .filter((id) => byId.has(id))
              .map(
                (id) =>
                  `<a href="#story/${id}">${esc(tr(byId.get(id).title))}</a>`,
              )
              .join(
                "",
              )}</div><nav class="chapter-nav">${index > 0 ? `<a class="btn secondary" href="#book?chapter=${index - 1}">${icon("arrow-left")}${t("previous")}</a>` : "<span></span>"}${index < chapters.length - 1 ? `<a class="btn" href="#book?chapter=${index + 1}">${t("next")}${icon("arrow-right")}</a>` : ""}</nav>`
          : `<p>${t("chapterEmpty")}</p>`
      }</article></div></div><section class="print-book"><article><h1>Gutman’s Life Journey</h1><p>${t("bookDescription")}</p><p>${t("bookNote")}</p></article>${chapters
        .map(
          (c, i) =>
            `<article><p class="eyebrow">${t("chapter")} ${i + 1}</p><h2>${esc(tr(c.title))}</h2>${chapterText(
              c,
            )
              .split(/\n\s*\n/)
              .map((p) => `<p>${esc(p)}</p>`)
              .join("")}<h3>${t("sources")}</h3>${c.sources
              .map((id) => byId.get(id))
              .filter(Boolean)
              .map(
                (p) =>
                  `<p><a href="${p.sources[0].url}">${esc(tr(p.title))}: ${esc(p.sources[0].url)}</a></p>`,
              )
              .join("")}</article>`,
        )
        .join("")}</section>`;
  }
  async function mapPage() {
    const list = places();
    main.innerHTML =
      intro("map", "mapIntro") +
      `<section class="container"><div id="map-status" class="notice map-status" role="status" hidden><span>${t("mapError")}</span><button class="btn secondary" data-map-retry>${t("mapRetry")}</button></div><div class="map-layout"><div class="map-list">${list.map((p, i) => `<div class="place-row"><button class="place-button" data-place="${i}"><span>${esc(p.info[0])}<small>${p.posts.length} ${t("results")}</small></span></button><a class="icon-button" href="#stories?place=${encodeURIComponent(p.info[0])}" aria-label="${t("viewPlace")}: ${esc(p.info[0])}" title="${t("viewPlace")}: ${esc(p.info[0])}">${icon("arrow-up-right")}</a></div>`).join("")}</div><div id="journey-map" aria-label="${t("map")}"><p style="padding:25px">${t("mapLoading")}</p></div></div></section>`;
    refreshIcons();
    const mapElement = $("#journey-map");
    const status = $("#map-status");
    const fallback = () => {
      if (view !== "map" || $("#journey-map") !== mapElement) return;
      status.hidden = false;
      mapElement.innerHTML = "";
      document.querySelectorAll("[data-place]").forEach((b) => {
        b.onclick = () => {
          location.hash = `stories?place=${encodeURIComponent(list[Number(b.dataset.place)].info[0])}`;
        };
      });
    };
    // File URLs cannot send the HTTP referrer required by the tile provider.
    if (location.protocol === "file:") {
      fallback();
      status.querySelector("span").textContent = t("mapLocal");
      status.querySelector("button").hidden = true;
      return;
    }
    try {
      if (!window.L) {
        mapLoading ||= new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "vendor/leaflet.js";
          script.onload = resolve;
          script.onerror = () => {
            script.remove();
            mapLoading = null;
            reject(new Error("Map library unavailable"));
          };
          document.head.append(script);
        });
        await mapLoading;
      }
      if (view !== "map" || $("#journey-map") !== mapElement) return;
      $("#journey-map").innerHTML = "";
      map = L.map("journey-map", { scrollWheelZoom: false }).setView(
        [-29, -68],
        3,
      );
      const tiles = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 17,
          referrerPolicy: "strict-origin-when-cross-origin",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      );
      tiles.on("tileerror", () => {
        status.hidden = false;
      });
      tiles.addTo(map);
      map.zoomControl.setPosition(lang === "he" ? "topright" : "topleft");
      $(".leaflet-control-zoom-in").ariaLabel = t("zoomIn");
      $(".leaflet-control-zoom-out").ariaLabel = t("zoomOut");
      const pins = [];
      for (const p of list) {
        const m = L.circleMarker([p.info[1], p.info[2]], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#db583f",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(p.info[0])}</strong><p>${p.posts.length} ${t("results")}</p><a href="#stories?place=${encodeURIComponent(p.info[0])}">${t("viewPlace")}</a>`,
          );
        pins.push(m);
      }
      document.querySelectorAll("[data-place]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.place);
            document
              .querySelectorAll("[data-place]")
              .forEach((x) => x.classList.toggle("active", x === b));
            map.setView([list[i].info[1], list[i].info[2]], 8);
            pins[i].openPopup();
            if (window.innerWidth <= 760)
              mapElement.scrollIntoView({ block: "center" });
          }),
      );
    } catch {
      fallback();
    }
  }
  function people() {
    main.innerHTML =
      intro("people", "peopleIntro") +
      `<section class="container people-grid">${PEOPLE.map((p) => `<article class="person"><img src="assets/${p.image}.webp" alt="${esc(tr(p.name))}" loading="lazy"><h2>${esc(tr(p.name))}</h2><p>${esc(tr(p.text))}</p><a class="text-link" href="#stories?${p.topic ? "topic=" + p.topic : "q=" + encodeURIComponent(p.query)}">${t("stories")}${icon("arrow-right")}</a></article>`).join("")}</section>`;
  }
  function feature() {
    const isAlma = view === "alma",
      feature = data.features?.[view];
    const hero = isAlma ? "DSGu-IcjF-u" : "DR56dHiDBwQ";
    const topic = isAlma ? "truck" : "school";
    const sourcePosts = (feature?.sources || [])
      .map((id) => byId.get(data.aliases?.[id] || id))
      .filter(Boolean);
    const pictures = isAlma
      ? ["C8So7mmROYu", "DEVpiIaPHy1", "DHWng2dPk7C", "DSNGUVPjM0f"]
      : ["C9U4dzbRVj3", "DSNGUVPjM0f", "DR56dHiDBwQ"];
    main.innerHTML = `<section class="feature-cover ${isAlma ? "alma-cover" : "school-cover"}"><img src="assets/${hero}.webp" alt="${t(view)}" fetchpriority="high"><div class="container"><p class="eyebrow">GUTMAN'S LIFE JOURNEY</p><h1>${isAlma ? "Alma" : t("school")}</h1><p>${t(view + "Intro")}</p></div></section><div class="container"><div class="feature-intro"><p class="eyebrow">${t(view)}</p><p>${esc(tr(feature?.intro) || t(view + "Intro"))}</p>${isAlma ? '<img class="alma-signature" src="assets/DF0ycjvvGuL.webp" alt="Alma original name logo">' : ""}</div>${(
      feature?.sections || []
    )
      .map(
        (section, i) =>
          `<section class="feature-section"><div class="feature-number">${String(i + 1).padStart(2, "0")}</div><div><h2>${esc(tr(section.title))}</h2><p>${esc(tr(section.body))}</p><div class="chapter-sources">${(
            section.sources || []
          )
            .slice(0, 3)
            .map((id) => byId.get(data.aliases?.[id] || id))
            .filter(Boolean)
            .map(
              (p) =>
                `<a href="#story/${p.id}">${esc(tr(p.title))}${icon("arrow-up-right")}</a>`,
            )
            .join(
              "",
            )}</div></div><img src="assets/${pictures[i]}.webp" alt="" loading="lazy"></section>`,
      )
      .join(
        "",
      )}<section class="section"><div class="section-heading"><h2>${t("fromCollection")}</h2><a class="text-link" href="#stories?topic=${topic}">${t("allStories")}${icon("arrow-right")}</a></div><div class="grid">${sourcePosts
      .filter((p) => p.image)
      .slice(0, 6)
      .map(card)
      .join("")}</div></section></div>`;
  }
  function social() {
    const ranked = posts
      .filter((p) => p.instagramViews?.count !== null && p.instagramViews)
      .sort((a, b) => b.instagramViews.count - a.instagramViews.count);
    main.innerHTML =
      intro("social", "socialIntro") +
      `<div class="container"><section><p class="eyebrow">${t("ranking")} · ${data.stats.instagramViewCounts || 0} REELS</p><h2>${ranked.length ? t("mostViewed") : t("rankingUnavailable")}</h2><p class="editor-note">${t("viewCountNote")} ${date(data.stats.viewsCapturedAt)}. ${t("viewCountScope")}</p><div class="grid ranking-grid">${ranked
        .slice(0, 12)
        .map(
          (p, i) =>
            `<div class="ranked-story"><div class="rank-label"><strong>${String(i + 1).padStart(2, "0")}</strong><span>${icon("instagram")}${esc(p.instagramViews.label)} ${t("viewsLabel")}</span></div>${card(p)}</div>`,
        )
        .join(
          "",
        )}</div></section><section class="section"><div class="status-panel"><p class="eyebrow">${t("coverage")}</p><div class="status-grid"><div><strong>${posts.filter((p) => !p.pending).length}</strong><span>${t("complete")}</span></div><div><strong>${posts.filter((p) => p.pending).length}</strong><span>${t("pendingCount")}</span></div><div><strong>${posts.filter((p) => new Set(p.sources.map((s) => s.platform)).size > 1).length}</strong><span>${t("merged")}</span></div></div></div><p class="notice">${t("coverageNote")}</p></section></div>`;
  }
  function games() {
    main.innerHTML =
      intro("games", "gamesIntro") +
      `<section class="container"><div class="topics"><a class="topic-chip ${filters.mode !== "memory" ? "active" : ""}" href="#games">${icon("circle-help")}${t("quiz")}</a><a class="topic-chip ${filters.mode === "memory" ? "active" : ""}" href="#games?mode=memory">${icon("grid-2x2")}${t("memory")}</a></div><div class="game-shell" id="game"></div></section>`;
    if (filters.mode === "memory") {
      resetMemory();
      renderMemory();
    } else {
      quizIndex = 0;
      quizScore = 0;
      quizAnswered = false;
      renderQuiz();
    }
  }
  function renderQuiz() {
    const node = $("#game");
    if (quizIndex >= QUIZ.length) {
      node.innerHTML = `<div class="empty">${icon("flag")}<h2>${t("quizFinish")}</h2><p>${t("score")}: ${quizScore} / ${QUIZ.length}</p><button class="btn" data-restart>${t("playAgain")}</button></div>`;
      refreshIcons();
      return;
    }
    const q = QUIZ[quizIndex],
      p = byId.get(q.id);
    node.innerHTML = `<div class="game-top"><span>${t("question")} ${quizIndex + 1} / ${QUIZ.length}</span><span>${t("score")}: ${quizScore}</span></div>${img(p, "", true)}<h2>${esc(tr(q.q))}</h2><div class="answers">${(Array.isArray(q.options) ? q.options : tr(q.options)).map((a, i) => `<button data-answer="${i}">${esc(a)}</button>`).join("")}</div><div class="game-result" id="game-result" aria-live="polite"></div><button class="btn" id="next-question" hidden>${t("nextQuestion")}${icon("arrow-right")}</button>`;
    refreshIcons();
  }
  function resetMemory() {
    clearTimeout(memoryTimer);
    const cards = [
      "DVJRr_sDClu",
      "DYKmI1hsOrd",
      "DSGu-IcjF-u",
      "DVeL1WpCU2h",
      "DVY-w1jjOl9",
      "DHvf6cps1vS",
    ].flatMap((id) => [id, id]);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    memory = cards;
    flipped = [];
    matched = new Set();
    moves = 0;
    memoryLocked = false;
  }
  function renderMemory() {
    if (!$("#game")) return;
    $("#game").innerHTML =
      `<div class="game-top"><span>${t("moves")}: ${moves}</span><span>${t("pairs")}: ${matched.size / 2} / 6</span></div><div class="memory-board">${memory.map((id, i) => `<button class="memory-tile ${matched.has(i) ? "matched" : ""}" data-memory="${i}" aria-label="${flipped.includes(i) || matched.has(i) ? esc(tr(byId.get(id)?.title)) : t("memory") + " " + (i + 1)}" ${matched.has(i) ? "disabled" : ""}>${flipped.includes(i) || matched.has(i) ? `<img src="assets/${id}.webp" alt="">` : icon("compass")}</button>`).join("")}</div><div class="game-result" role="status">${matched.size === 12 ? t("memoryWin") : ""}</div><button class="btn secondary" data-memory-reset>${icon("rotate-ccw")}${t("playAgain")}</button>`;
    refreshIcons();
  }
  function random() {
    const list = available();
    if (list.length)
      location.hash = `story/${list[Math.floor(Math.random() * list.length)].id}`;
  }
  function toggleSave(id) {
    if (saved.has(id)) {
      saved.delete(id);
      toast(t("removedToast"));
    } else {
      saved.add(id);
      toast(t("savedToast"));
    }
    storage.set("gutman-saved", [...saved]);
    document.querySelectorAll("[data-save]").forEach((b) => {
      if (b.dataset.save === id) {
        b.classList.toggle("saved", saved.has(id));
        b.ariaLabel = t(saved.has(id) ? "unsave" : "save");
        b.title = b.ariaLabel;
      }
    });
    if (view === "saved") renderResults();
  }
  function openStory(id) {
    const p = byId.get(id);
    if (!p) {
      toast(t("noResults"));
      location.hash = "stories";
      return;
    }
    $("#reader-content").innerHTML =
      `${p.image ? img(p, "reader-photo", true) : ""}<article class="reader-copy">${meta(p)}<h1 id="reader-title">${esc(tr(p.title))}</h1>${p.travelDate ? `<p class="kicker">${t("travelDate")}: ${date(p.travelDate)}</p>` : ""}${p.pending ? `<p class="notice">${t("pendingNote")}</p>` : ""}<p class="summary">${esc(tr(p.summary))}</p><div class="topics">${p.topics.map((topic) => `<a class="topic-chip" href="#stories?topic=${topic}">${icon(topics[topic] || "tag")}${t(topic)}</a>`).join("")}</div>${p.excerpt ? `<p class="kicker">${t("sourceExcerpt")}</p><blockquote class="source-quote" dir="auto">${esc(p.excerpt)}</blockquote>` : ""}<p class="editor-note">${t("editorial")} ${t("published")}: ${date(p.date)}.</p><div class="reader-sources">${p.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon(s.platform === "instagram" ? "instagram" : "facebook")}${s.platform === "instagram" ? "Instagram" : "Facebook"}${icon("arrow-up-right")}</a>`).join("")}</div><div class="reader-actions"><button class="icon-button save ${saved.has(id) ? "saved" : ""}" data-save="${id}" title="${t(saved.has(id) ? "unsave" : "save")}" aria-label="${t(saved.has(id) ? "unsave" : "save")}">${icon("bookmark")}</button><button class="icon-button" data-copy title="${t("copyLink")}" aria-label="${t("copyLink")}">${icon("link")}</button><button class="btn secondary" data-random>${icon("shuffle")}${t("random")}</button></div></article>`;
    $("#reader").showModal();
    $("#reader").scrollTop = 0;
    document.body.style.overflow = "hidden";
    refreshIcons();
  }
  function closeStory() {
    if ($("#reader").open) $("#reader").close();
    document.body.style.overflow = "";
    if (location.hash.startsWith("#story/"))
      history.replaceState(null, "", lastView);
  }
  function route() {
    const hash = location.hash.slice(1) || "home";
    if (hash.startsWith("story/")) {
      if (!main.children.length) {
        view = "home";
        shell();
        home();
      }
      let id;
      try {
        id = decodeURIComponent(hash.slice(6));
      } catch {
        location.hash = "stories";
        return;
      }
      openStory(data.aliases?.[id] || id);
      return;
    }
    if ($("#reader").open) $("#reader").close();
    document.body.style.overflow = "";
    lastView = "#" + hash;
    const [path, query] = hash.split("?");
    view = [
      "home",
      "stories",
      "timeline",
      "book",
      "map",
      "gallery",
      "people",
      "games",
      "social",
      "saved",
      "alma",
      "school",
    ].includes(path)
      ? path
      : "home";
    filters = Object.fromEntries(new URLSearchParams(query));
    limit = 18;
    if (map) {
      map.remove();
      map = null;
    }
    clearTimeout(memoryTimer);
    shell();
    ({
      home,
      stories: archive,
      timeline: archive,
      gallery: archive,
      saved: archive,
      book,
      map: mapPage,
      people,
      games,
      social,
      alma: feature,
      school: feature,
    })[view]();
    refreshIcons();
    document.title = `${t(view)} | Gutman’s Life Journey`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  $("#language").addEventListener("change", (e) => {
    lang = e.target.value;
    storage.set("gutman-language", lang);
    const isStory = location.hash.startsWith("#story/");
    if (isStory) {
      const story = location.hash;
      history.replaceState(null, "", lastView);
      route();
      history.replaceState(null, "", story);
    }
    route();
  });
  $(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
  });
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#navigation").classList.toggle("open");
    $("#menu-toggle").ariaExpanded = String(open);
  });
  $("#random-top").addEventListener("click", random);
  $("#close-reader").addEventListener("click", closeStory);
  $("#reader").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeStory();
  });
  $("#reader").addEventListener("click", (e) => {
    if (e.target === $("#reader")) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeStory();
    }
  });
  document.addEventListener("click", async (e) => {
    if (e.target.closest("#navigation a")) {
      $("#navigation").classList.remove("open");
      $("#menu-toggle").ariaExpanded = "false";
      $(".nav-more").open = false;
    }
    const b = e.target.closest("button,[data-random]");
    if (!b) return;
    if (b.hasAttribute("data-random")) random();
    if (b.hasAttribute("data-map-retry")) route();
    if (b.hasAttribute("data-clear-place")) {
      delete filters.place;
      updateFilters();
      b.remove();
    }
    if (b.dataset.save) toggleSave(b.dataset.save);
    if (b.dataset.story) location.hash = "story/" + b.dataset.story;
    if (b.hasAttribute("data-topic")) {
      filters.topic = b.dataset.topic;
      updateFilters();
    }
    if (b.hasAttribute("data-reset")) {
      filters = {};
      history.replaceState(null, "", `#${view}`);
      lastView = location.hash;
      archive();
      refreshIcons();
    }
    if (b.id === "more-results") {
      limit += 18;
      renderResults();
    }
    if (b.hasAttribute("data-print")) window.print();
    if (b.hasAttribute("data-copy")) {
      try {
        await navigator.clipboard.writeText(location.href);
        toast(t("copied"));
      } catch {
        toast(t("copyFailed"));
      }
    }
    if (b.hasAttribute("data-answer") && !quizAnswered) {
      quizAnswered = true;
      const answer = Number(b.dataset.answer),
        q = QUIZ[quizIndex];
      if (answer === q.answer) quizScore++;
      $(".game-top span:last-child").textContent = `${t("score")}: ${quizScore}`;
      document.querySelectorAll("[data-answer]").forEach((button) => {
        button.disabled = true;
        button.classList.toggle(
          "correct",
          Number(button.dataset.answer) === q.answer,
        );
        button.classList.toggle("wrong", button === b && answer !== q.answer);
      });
      $("#game-result").innerHTML =
        `${t(answer === q.answer ? "correct" : "incorrect")}<br><a class="text-link" href="#story/${q.id}">${t("readStory")}</a>`;
      $("#next-question").hidden = false;
    }
    if (b.id === "next-question") {
      quizIndex++;
      quizAnswered = false;
      renderQuiz();
    }
    if (b.hasAttribute("data-restart")) {
      quizIndex = 0;
      quizScore = 0;
      quizAnswered = false;
      renderQuiz();
    }
    if (b.hasAttribute("data-memory-reset")) {
      resetMemory();
      renderMemory();
    }
    if (b.hasAttribute("data-memory") && !memoryLocked) {
      const i = Number(b.dataset.memory);
      if (flipped.includes(i) || matched.has(i)) return;
      flipped.push(i);
      renderMemory();
      if (flipped.length === 2) {
        moves++;
        renderMemory();
        if (memory[flipped[0]] === memory[flipped[1]]) {
          flipped.forEach((j) => matched.add(j));
          flipped = [];
          renderMemory();
        } else {
          memoryLocked = true;
          memoryTimer = setTimeout(() => {
            flipped = [];
            memoryLocked = false;
            if (view === "games" && filters.mode === "memory") renderMemory();
          }, 900);
        }
      }
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.closest("#filter-form") && e.target.name === "q") {
      filters.q = e.target.value;
      updateFilters();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.closest("#filter-form")) {
      filters[e.target.name] = e.target.value;
      updateFilters();
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "filter-form") e.preventDefault();
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#reader").open) {
      $("#navigation").classList.remove("open");
      $("#menu-toggle").ariaExpanded = "false";
      $(".nav-more").open = false;
    }
  });
  route();
})();
