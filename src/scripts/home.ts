import type { ContactSettings } from "@/types";
import type { LegacyProperty } from "@/lib/viewModel";
import { DEFAULT_CONTACT, cleanPhone, defaultWhatsappText, formatPhone } from "@/lib/format";
import { legacyWhatsappBase } from "@/lib/viewModel";
import { byId, setStatus, formatPhoneInput } from "./dom";
import { featuredHtml, propertyCardHtml } from "./renderProperty";

let properties: LegacyProperty[] = [];
let contact: ContactSettings = DEFAULT_CONTACT;
const propertyCardPhotoIndex: Record<string, number> = {};
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type HomeInitialData = {
  properties: LegacyProperty[];
  contact: ContactSettings;
};

function readInitialData<T>(): T | null {
  const el = document.getElementById("__INITIAL_DATA__");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return null;
  }
}

function waBase() {
  return legacyWhatsappBase(contact);
}

function hydrateContactLinks() {
  const defaultUrl = `${waBase()}?text=${encodeURIComponent(defaultWhatsappText())}`;
  ["headerWhatsapp", "heroWhatsapp", "contactWhatsapp", "floatingWaLink"].forEach((id) => {
    const link = byId<HTMLAnchorElement>(id);
    if (link) link.href = defaultUrl;
  });

  const telLinks = document.querySelectorAll<HTMLAnchorElement>(
    '[data-contact-phone], .contact-info a[href^="tel:"]'
  );
  telLinks.forEach((link) => {
    link.href = `tel:+${cleanPhone(contact.phone)}`;
  });
  const waLinks = document.querySelectorAll<HTMLAnchorElement>(
    '[data-contact-whatsapp], .contact-info a[href*="wa.me"]'
  );
  waLinks.forEach((link) => {
    link.href = defaultUrl;
  });
  const mailLinks = document.querySelectorAll<HTMLAnchorElement>(
    '[data-contact-email], .contact-info a[href^="mailto:"]'
  );
  mailLinks.forEach((link) => {
    link.href = `mailto:${contact.email}`;
  });

  const footerPhoneLink = byId<HTMLAnchorElement>("footerPhoneLink");
  const footerWaLink = byId<HTMLAnchorElement>("footerWaLink");
  const footerWaLink2 = byId<HTMLAnchorElement>("footerWaLink2");
  const footerEmailLink = byId<HTMLAnchorElement>("footerEmailLink");
  const footerEmailLink2 = byId<HTMLAnchorElement>("footerEmailLink2");
  if (footerPhoneLink) footerPhoneLink.href = `tel:+${cleanPhone(contact.phone)}`;
  if (footerWaLink) footerWaLink.href = defaultUrl;
  if (footerWaLink2) footerWaLink2.href = defaultUrl;
  if (footerEmailLink) footerEmailLink.href = `mailto:${contact.email}`;
  if (footerEmailLink2) footerEmailLink2.href = `mailto:${contact.email}`;

  document
    .querySelectorAll<HTMLElement>(".ci-value[data-kind='phone'], #footerPhone")
    .forEach((el) => {
      el.textContent = formatPhone(contact.phone);
    });
  document
    .querySelectorAll<HTMLElement>(".ci-value[data-kind='whatsapp'], #footerWhatsapp")
    .forEach((el) => {
      el.textContent = formatPhone(contact.whatsapp);
    });
  document
    .querySelectorAll<HTMLElement>(".ci-value[data-kind='email'], #footerEmail")
    .forEach((el) => {
      el.textContent = contact.email;
    });
}

function renderFeaturedProperty() {
  const grid = document.querySelector<HTMLDivElement>("#destaque .featured-grid");
  if (!grid) return;
  const featured = properties.find((property) => property.isFeatured) || properties[0];
  if (!featured) {
    grid.innerHTML =
      '<div class="empty-state empty-state-wide"><strong>Nenhum imóvel em destaque.</strong><span>Escolha um imóvel no painel administrativo.</span></div>';
    return;
  }
  grid.innerHTML = featuredHtml(featured, contact);
  initReveal();
  fitSpecText();
}

function buildPropertyCards(list = properties) {
  const grid = byId<HTMLDivElement>("propertyGrid");
  const status = byId<HTMLElement>("propertyStatus");
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML =
      '<div class="empty-state"><strong>Nenhum imóvel encontrado.</strong><span>Tente mudar os filtros de busca para ver mais opções.</span></div>';
    setStatus(status, "0 imóveis encontrados.");
    return;
  }

  grid.innerHTML = list
    .map((property, index) =>
      propertyCardHtml(property, contact, index, propertyCardPhotoIndex[property.id] || 0)
    )
    .join("");
  setStatus(status, `${list.length} imóveis exibidos.`);
  initReveal();
}

function renderPropertyGridSkeleton(count = 6) {
  const grid = byId<HTMLDivElement>("propertyGrid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
    <article class="property-card skeleton-card">
      <div class="pc-media skeleton-image"></div>
      <div class="pc-body">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-text"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-footer"></div>
      </div>
    </article>
  `
    )
    .join("");
}

function renderFeaturedSkeleton() {
  const grid = document.querySelector<HTMLDivElement>("#destaque .featured-grid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="featured-media skeleton-card">
      <div class="skeleton-image"></div>
    </div>
    <div class="featured-info skeleton-card">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-text"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line skeleton-footer"></div>
    </div>
  `;
}

function renderPublicErrorStates() {
  const featuredGrid = document.querySelector<HTMLDivElement>("#destaque .featured-grid");
  const propertyGrid = byId<HTMLDivElement>("propertyGrid");
  const card = `
    <div class="error-state-card">
      <span class="error-icon" aria-hidden="true">!</span>
      <strong>Nao foi possivel carregar os imoveis</strong>
      <p>Verifique sua conexao e tente novamente. Se o erro persistir, o Supabase pode estar indisponivel.</p>
      <button class="btn btn-primary" type="button" data-public-retry-properties>Tentar novamente</button>
    </div>
  `;
  if (featuredGrid) featuredGrid.innerHTML = card;
  if (propertyGrid) propertyGrid.innerHTML = card;
  setStatus(byId("propertyStatus"), "Falha ao carregar imoveis.");
}

function getPropertyById(id: string) {
  return properties.find((property) => property.id === id) || null;
}

function clampPhotoIndex(index: number, photos: string[]) {
  if (!photos.length) return 0;
  if (index < 0) return photos.length - 1;
  if (index >= photos.length) return 0;
  return index;
}

function loadDeferredImage(img: HTMLImageElement | null | undefined) {
  const src = img?.dataset.src;
  if (!img || !src) return;
  img.src = src;
  if (img.dataset.srcset) {
    img.srcset = img.dataset.srcset;
    delete img.dataset.srcset;
  }
  delete img.dataset.src;
}

function updatePropertyCardPhoto(card: HTMLElement) {
  const property = getPropertyById(card.dataset.propertyId || "");
  if (!property) return;
  const photos = property.photoCards || property.photos || [];
  const index = clampPhotoIndex(propertyCardPhotoIndex[property.id] || 0, photos);
  const track = card.querySelector<HTMLElement>(".pc-carousel-track");
  const count = card.querySelector<HTMLElement>(".pc-photo-count");
  loadDeferredImage(card.querySelectorAll<HTMLImageElement>(".pc-carousel-slide img")[index]);
  if (track) track.style.transform = `translateX(-${index * 100}%)`;
  if (count) count.textContent = `${index + 1} / ${photos.length}`;
}

function initPropertyInteractions() {
  const grid = byId<HTMLDivElement>("propertyGrid");
  if (!grid) return;
  grid.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const photoButton = target.closest<HTMLElement>("[data-photo-action]");
    const card = target.closest<HTMLElement>(".property-card[data-property-id]");
    if (!photoButton || !card) return;
    event.preventDefault();
    event.stopPropagation();
    const property = getPropertyById(card.dataset.propertyId || "");
    if (!property) return;
    const direction = photoButton.dataset.photoAction === "next" ? 1 : -1;
    propertyCardPhotoIndex[property.id] = clampPhotoIndex(
      (propertyCardPhotoIndex[property.id] || 0) + direction,
      property.photos
    );
    updatePropertyCardPhoto(card);
  });
}

function initHeaderScroll() {
  const header = byId<HTMLElement>("siteHeader");
  if (!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 30);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initHamburger() {
  const btn = byId<HTMLButtonElement>("hamburger");
  const nav = byId<HTMLElement>("mainNav");
  if (!btn || !nav) return;
  const close = () => {
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Abrir menu");
  };
  const open = () => {
    nav.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Fechar menu");
  };
  btn.addEventListener("click", () => (nav.classList.contains("open") ? close() : open()));
  nav.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) close();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) close();
  });
}

function initActiveLinks() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".nav-link"));
  const sections = links
    .map((link) => {
      const href = link.getAttribute("href") || "";
      const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
      return hash ? document.querySelector(hash) : null;
    })
    .filter(Boolean) as Element[];
  if (!("IntersectionObserver" in window) || !sections.length) return;
  const byHash = new Map(
    links.map((link) => [link.getAttribute("href")?.replace("/", "") || "", link])
  );
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = byHash.get(`#${entry.target.id}`);
        if (!link) return;
        links.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((section) => observer.observe(section));
}

export function initReveal() {
  const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
  if (!items.length) return;
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  items.forEach((el) => observer.observe(el));
}

function initParallax() {
  if (prefersReducedMotion) return;
  const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!layers.length) return;
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    layers.forEach((layer) => {
      const section = layer.parentElement;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) return;
      const speed = Number(layer.getAttribute("data-speed") || 0.3);
      const offset = rect.top + rect.height / 2 - vh / 2;
      layer.style.transform = `translate3d(0,${(-offset * speed).toFixed(1)}px,0)`;
    });
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
}

function animateCounter(el: HTMLElement) {
  const target = parseInt(el.getAttribute("data-count") || "0", 10) || 0;
  const suffix = el.getAttribute("data-suffix") || "";
  if (prefersReducedMotion) {
    el.textContent = target + suffix;
    return;
  }
  const start = Date.now();
  const duration = 1600;
  const tick = () => {
    const progress = Math.min((Date.now() - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };
  tick();
}

function initCounters() {
  const nums = Array.from(document.querySelectorAll<HTMLElement>(".stat-num"));
  if (!("IntersectionObserver" in window)) {
    nums.forEach(animateCounter);
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target as HTMLElement);
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );
  nums.forEach((num) => observer.observe(num));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function initFilters() {
  const searchInput = byId<HTMLInputElement>("filterSearch");
  const typeSelect = byId<HTMLSelectElement>("filterType");
  const bedsSelect = byId<HTMLSelectElement>("filterBeds");
  const bathsSelect = byId<HTMLSelectElement>("filterBaths");
  const parkingSelect = byId<HTMLSelectElement>("filterParking");
  const btnSearch = byId<HTMLButtonElement>("btnSearch");
  if (!searchInput || !typeSelect || !bedsSelect || !btnSearch) return;

  const applyFilters = () => {
    const cleanTerm = normalizeText(searchInput.value)
      .replace(/\b(rua|av|avenida|travessa|bairro|de|do|da|em|no|na)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = cleanTerm.split(" ").filter(Boolean);
    const type = typeSelect.value;
    const beds = Number(bedsSelect.value || 0);
    const baths = Number(bathsSelect?.value || 0);
    const parking = Number(parkingSelect?.value || 0);

    let visibleCount = 0;

    properties.forEach((property) => {
      const card = document.querySelector(
        `.property-card[data-property-id="${property.id}"]`
      ) as HTMLElement;
      if (!card) return;

      const haystack = normalizeText(
        `${property.title} ${property.location} ${property.description} ${property.features.join(" ")}`
      );
      const matches =
        tokens.every((token) => haystack.includes(token)) &&
        (!type || property.type === type) &&
        (!beds || property.beds >= beds) &&
        (!baths || property.baths >= baths) &&
        (!parking || property.parking >= parking);

      if (matches) {
        card.style.display = "";
        card.classList.add("visible");
        visibleCount++;
      } else {
        card.style.display = "none";
        card.classList.remove("visible");
      }
    });

    const status = byId("propertyStatus");
    const grid = byId<HTMLDivElement>("propertyGrid");

    let emptyStateEl = grid?.querySelector(".empty-state-filtered") as HTMLElement;
    if (visibleCount === 0) {
      if (grid && !emptyStateEl) {
        emptyStateEl = document.createElement("div");
        emptyStateEl.className = "empty-state empty-state-filtered";
        emptyStateEl.innerHTML =
          "<strong>Nenhum imóvel encontrado.</strong><span>Tente mudar os filtros de busca para ver mais opções.</span>";
        grid.appendChild(emptyStateEl);
      } else if (emptyStateEl) {
        emptyStateEl.style.display = "";
      }
      setStatus(status, "0 imóveis encontrados.");
    } else {
      if (emptyStateEl) {
        emptyStateEl.style.display = "none";
      }
      setStatus(status, `${visibleCount} imóveis exibidos.`);
    }
  };

  btnSearch.addEventListener("click", applyFilters);
  searchInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") applyFilters();
  });
  [typeSelect, bedsSelect, bathsSelect, parkingSelect].forEach((field) =>
    field?.addEventListener("change", applyFilters)
  );
}

function initContactForm() {
  const form = byId<HTMLFormElement>("contactForm");
  if (!form) return;
  const nome = byId<HTMLInputElement>("nome");
  const telefone = byId<HTMLInputElement>("telefone");
  const mensagem = byId<HTMLTextAreaElement>("mensagem");
  if (!nome || !telefone || !mensagem) return;

  telefone.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    input.value = formatPhoneInput(input.value);
  });

  const charCount = byId("charCount");
  mensagem.addEventListener("input", () => {
    if (charCount) {
      charCount.textContent = String(mensagem.value.length);
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const invalid = [
      [nome, "Informe seu nome."],
      [telefone, "Informe um telefone válido."],
      [mensagem, "Escreva uma mensagem."]
    ].find(([field]) => !(field as HTMLInputElement | HTMLTextAreaElement).value.trim());
    form.querySelectorAll(".field").forEach((field) => field.classList.remove("invalid"));
    if (invalid) {
      const field = invalid[0] as HTMLInputElement | HTMLTextAreaElement;
      field.closest(".field")?.classList.add("invalid");
      field.focus();
      return;
    }
    const msg = `Olá Júlio, vi seu site!\n\nNome: ${nome.value.trim()}\nTelefone: ${telefone.value.trim()}\nMensagem: ${mensagem.value.trim()}`;
    window.open(`${waBase()}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    form.reset();
    if (charCount) {
      charCount.textContent = "0";
    }
  });
}

// Reduz a fonte dos specs do imóvel em destaque para caber em uma linha quando a
// tela é estreita, em vez de deixar o texto quebrar. Só encolhe se necessário e
// respeita um piso de legibilidade — em telas largas não altera nada.
function fitSpecText() {
  const items = Array.from(document.querySelectorAll<HTMLElement>(".specs li"));
  items.forEach((li) => {
    li.style.whiteSpace = "nowrap";
    li.style.fontSize = "";
    const base = parseFloat(getComputedStyle(li).fontSize) || 14;
    const min = base * 0.66;
    let size = base;
    let guard = 32;
    while (li.scrollWidth > li.clientWidth && size > min && guard-- > 0) {
      size -= 0.5;
      li.style.fontSize = `${size}px`;
    }
  });
}

function initSpecFit() {
  fitSpecText();
  // Recalcula quando as fontes web carregam (a medição muda com a fonte final).
  document.fonts?.ready.then(fitSpecText).catch(() => {});
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitSpecText, 150);
  });
}

async function init() {
  const initialData = readInitialData<HomeInitialData>();
  if (initialData) {
    properties = initialData.properties;
    contact = initialData.contact;
    hydrateContactLinks();

    const status = byId("propertyStatus");
    if (status) {
      setStatus(status, `${properties.length} imóveis exibidos.`);
    }
  } else {
    await loadPublicData();
  }

  initPropertyInteractions();
  initFilters();
  initHeaderScroll();
  initHamburger();
  initActiveLinks();
  initReveal();
  initCounters();
  initParallax();
  initContactForm();
  initSpecFit();
}

async function loadPublicData() {
  setStatus(byId("propertyStatus"), "Carregando imoveis...");
  renderFeaturedSkeleton();
  renderPropertyGridSkeleton();
  try {
    const response = await fetch("/api/public/home-data", {
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Public home-data failed: ${response.status}`);
    const data = (await response.json()) as HomeInitialData;
    properties = Array.isArray(data.properties) ? data.properties : [];
    contact = data.contact || DEFAULT_CONTACT;
    Object.keys(propertyCardPhotoIndex).forEach((key) => delete propertyCardPhotoIndex[key]);
    hydrateContactLinks();
    renderFeaturedProperty();
    buildPropertyCards();
  } catch (error) {
    console.error("Falha ao carregar dados publicos:", error);
    contact = DEFAULT_CONTACT;
    hydrateContactLinks();
    renderPublicErrorStates();
  }
}

document.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("[data-public-retry-properties]")) {
    void loadPublicData();
  }
});

void init();
