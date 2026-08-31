const one = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];

const menu = one("[data-menu]");
const navigation = one("[data-primary-nav]");
const menuLabel = one("[data-menu-label]", menu);

const setMenuState = (open) => {
  menu?.setAttribute("aria-expanded", String(open));
  if (menuLabel) menuLabel.textContent = open ? "Close navigation" : "Open navigation";
};

const closeMenu = () => {
  navigation?.classList.remove("open");
  setMenuState(false);
};

menu?.addEventListener("click", () => {
  const open = navigation?.classList.toggle("open") ?? false;
  setMenuState(open);
});

for (const link of all("a", navigation)) link.addEventListener("click", closeMenu);

const copyText = async (button, text) => {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text.trim());
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1500);
};

for (const button of all("[data-copy-target]")) {
  button.addEventListener("click", () => {
    const target = one(button.dataset.copyTarget);
    if (target) copyText(button, target.textContent ?? "");
  });
}

for (const pre of all(".article pre, .quickcode pre")) {
  const code = one("code", pre);
  if (!code) continue;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copycode";
  button.textContent = "Copy";
  button.addEventListener("click", () => copyText(button, code.textContent ?? ""));
  pre.append(button);
}

const filterList = (input, items, empty) => {
  const query = input.value.trim().toLowerCase();
  let visible = 0;
  for (const item of items) {
    const matches = !query || (item.getAttribute("aria-label") ?? item.textContent ?? "").toLowerCase().includes(query);
    item.hidden = !matches;
    if (matches) visible++;
  }
  if (empty) empty.hidden = visible > 0;
};

const mapFilter = one("[data-map-filter]");
const mapNodes = all("[data-package]");
const mapEmpty = one("[data-map-empty]");
mapFilter?.addEventListener("input", () => filterList(mapFilter, mapNodes, mapEmpty));

const packageFilter = one("[data-package-filter]");
const packageRows = all("[data-package-list] .packagerow");
const packageEmpty = one("[data-package-empty]");
packageFilter?.addEventListener("input", () => filterList(packageFilter, packageRows, packageEmpty));

const constellation = one("[data-constellation]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (constellation && !reduceMotion.matches) {
  constellation.addEventListener("pointermove", (event) => {
    const box = constellation.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - 0.5) * 12;
    const y = ((event.clientY - box.top) / box.height - 0.5) * 12;
    constellation.style.setProperty("--orbit-x", `${x}px`);
    constellation.style.setProperty("--orbit-y", `${y}px`);
  });
  constellation.addEventListener("pointerleave", () => {
    constellation.style.setProperty("--orbit-x", "0px");
    constellation.style.setProperty("--orbit-y", "0px");
  });
}

const dialog = one("[data-search-dialog]");
const searchInput = one("[data-search-input]", dialog);
const searchStatus = one("[data-search-status]", dialog);
const searchResults = one("[data-search-results]", dialog);
let searchIndex;

const loadSearch = async () => {
  if (searchIndex) return searchIndex;
  const base = dialog?.dataset.base ?? "";
  const response = await fetch(`${base}/search.json`);
  if (!response.ok) throw new Error(`search index returned ${response.status}`);
  searchIndex = await response.json();
  return searchIndex;
};

const resultNode = (item) => {
  const entry = document.createElement("li");
  const link = document.createElement("a");
  const title = document.createElement("strong");
  const kind = document.createElement("i");
  const description = document.createElement("p");
  link.href = item.url;
  title.textContent = item.title;
  kind.textContent = item.kind;
  description.textContent = item.description;
  link.append(title, kind, description);
  entry.append(link);
  return entry;
};

const search = async () => {
  const query = searchInput?.value.trim().toLowerCase() ?? "";
  if (!searchStatus || !searchResults) return;
  searchResults.replaceChildren();
  if (query.length < 2) {
    searchStatus.textContent = "Enter at least two characters.";
    return;
  }

  searchStatus.textContent = "Scanning field records…";
  try {
    const index = await loadSearch();
    const terms = query.split(/\s+/);
    const matches = index
      .filter((item) => {
        const haystack = `${item.title} ${item.description} ${item.text}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 12);
    searchStatus.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? "coordinate" : "coordinates"} found.`
      : "No matching coordinate. Try a package name or exported function.";
    searchResults.append(...matches.map(resultNode));
  } catch {
    searchStatus.textContent = "The search index could not be loaded. Use the field guide navigation instead.";
  }
};

const openSearch = async () => {
  if (!dialog || !searchInput) return;
  closeMenu();
  dialog.showModal();
  searchInput.focus();
  if (!searchIndex) {
    searchStatus.textContent = "Loading field records…";
    try {
      await loadSearch();
      searchStatus.textContent = "Type to search guides and package references.";
    } catch {
      searchStatus.textContent = "The search index could not be loaded. Use the field guide navigation instead.";
    }
  }
};

for (const button of all("[data-search-open]")) button.addEventListener("click", openSearch);
searchInput?.addEventListener("input", search);
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  } else if (event.key === "/" && !typing && !dialog?.open) {
    event.preventDefault();
    openSearch();
  } else if (event.key === "Escape") {
    closeMenu();
  }
});

const tocLinks = all(".toc a");
const tocSections = tocLinks.map((link) => one(link.getAttribute("href"))).filter(Boolean);
if (tocSections.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (!visible) return;
      for (const link of tocLinks) link.classList.toggle("active", link.hash === `#${visible.target.id}`);
    },
    { rootMargin: "-18% 0px -72%", threshold: 0 },
  );
  for (const section of tocSections) observer.observe(section);
}
