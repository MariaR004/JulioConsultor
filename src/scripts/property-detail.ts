import type { ContactSettings } from "@/types";
import type { LegacyProperty } from "@/lib/viewModel";
import { DEFAULT_CONTACT, cleanPhone, defaultWhatsappText, formatPhone } from "@/lib/format";
import { legacyWhatsappBase } from "@/lib/viewModel";
import { byId, escapeHtml, formatPhoneInput } from "./dom";
import { ICONS, featureItems } from "./renderProperty";

let property: LegacyProperty | null = null;
let contact: ContactSettings = DEFAULT_CONTACT;
let photoIndex = 0;
let lightboxDidSwipe = false;
let lightboxTouchStartX = 0;
let lightboxTouchStartY = 0;
let lightboxDragStartIndex = 0;
let galleryTouchStartX = 0;
let galleryTouchStartY = 0;
let galleryDragStartIndex = 0;

type PropertyInitialData = {
  property: LegacyProperty;
  contact: ContactSettings;
};

type PropertyApiData = {
  property: LegacyProperty | null;
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

function currentPropertyLookupUrl() {
  const apiUrl = new URL("/api/public/property-data", window.location.origin);
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || "";
  const slug = window.location.pathname.split("/").filter(Boolean).pop() || "";
  if (id) {
    apiUrl.searchParams.set("id", id);
  } else if (slug && slug !== "imovel") {
    apiUrl.searchParams.set("slug", slug);
  }
  return apiUrl.toString();
}

async function fetchPublicPropertyData() {
  const response = await fetch(currentPropertyLookupUrl(), {
    headers: { accept: "application/json" }
  });
  const data = (await response.json()) as PropertyApiData;
  if (!response.ok && response.status !== 404) {
    throw new Error(`Public property-data failed: ${response.status}`);
  }
  return data;
}

function waBase() {
  return legacyWhatsappBase(contact);
}

function clampPhotoIndex(index: number, photos: string[]) {
  if (!photos.length) return 0;
  if (index < 0) return photos.length - 1;
  if (index >= photos.length) return 0;
  return index;
}

function galleryPhotos() {
  return property?.photoCards?.length ? property.photoCards : property?.photos || [];
}

function fullPhotos() {
  return property?.photoFull?.length ? property.photoFull : property?.photos || [];
}

function thumbPhotos(fallback: string[]) {
  return property?.photoThumbs?.length ? property.photoThumbs : fallback;
}

function deferredImageAttrs(src: string, index: number, activeIndex: number, srcset = "") {
  const escapedSrc = escapeHtml(src);
  const escapedSrcset = srcset ? escapeHtml(srcset) : "";
  const srcsetAttr = escapedSrcset
    ? index === activeIndex
      ? ` srcset="${escapedSrcset}"`
      : ` data-srcset="${escapedSrcset}"`
    : "";
  return index === activeIndex
    ? `src="${escapedSrc}"${srcsetAttr}`
    : `data-src="${escapedSrc}"${srcsetAttr}`;
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

function loadGalleryPhoto(index: number) {
  const images = document.querySelectorAll<HTMLImageElement>(".pm-carousel-slide img");
  loadDeferredImage(images[index]);
}

function buildMapQuery(item: LegacyProperty) {
  return [item.street, item.number, item.neighborhood, item.city, item.state, item.postalCode]
    .filter(Boolean)
    .join(" ");
}

function mapSrcFor(item: LegacyProperty) {
  return `https://www.google.com/maps?q=${encodeURIComponent(buildMapQuery(item) || "Cuiabá MT")}&output=embed`;
}

function hydrateGlobalContacts() {
  const url = `${waBase()}?text=${encodeURIComponent(defaultWhatsappText())}`;
  ["headerWhatsapp", "floatingWaLink"].forEach((id) => {
    const link = byId<HTMLAnchorElement>(id);
    if (link) link.href = url;
  });
  const footerWaLink = byId<HTMLAnchorElement>("footerWaLink");
  const footerWaLink2 = byId<HTMLAnchorElement>("footerWaLink2");
  const footerPhoneLink = byId<HTMLAnchorElement>("footerPhoneLink");
  const footerEmailLink = byId<HTMLAnchorElement>("footerEmailLink");
  const footerEmailLink2 = byId<HTMLAnchorElement>("footerEmailLink2");
  if (footerWaLink) footerWaLink.href = url;
  if (footerWaLink2) footerWaLink2.href = url;
  if (footerPhoneLink) footerPhoneLink.href = `tel:+${cleanPhone(contact.phone)}`;
  if (footerEmailLink) footerEmailLink.href = `mailto:${contact.email}`;
  if (footerEmailLink2) footerEmailLink2.href = `mailto:${contact.email}`;
  const footerPhone = byId<HTMLElement>("footerPhone");
  const footerWhatsapp = byId<HTMLElement>("footerWhatsapp");
  const footerEmail = byId<HTMLElement>("footerEmail");
  if (footerPhone) footerPhone.textContent = formatPhone(contact.phone);
  if (footerWhatsapp) footerWhatsapp.textContent = formatPhone(contact.whatsapp);
  if (footerEmail) footerEmail.textContent = contact.email;
}

function renderNotFound() {
  const showcase = byId<HTMLElement>("propertyShowcase");
  const mainInfo = byId<HTMLElement>("propertyMainInfo");
  const sidebar = byId<HTMLElement>("propertySidebar");
  if (showcase) {
    showcase.innerHTML = `
      <div style="padding: 64px 32px; text-align: center; width: 100%;">
        <div style="font-size: 3rem; margin-bottom: 16px; color: var(--red);">⌂</div>
        <h3 style="font-size: 1.5rem; font-family: var(--ff-head); margin-bottom: 8px;">Imóvel não encontrado</h3>
        <p style="color: var(--muted); margin-bottom: 24px;">O imóvel solicitado não pôde ser localizado ou não está publicado.</p>
        <a href="/#imoveis" class="btn btn-primary">Voltar para a página inicial</a>
      </div>
    `;
  }
  if (mainInfo) mainInfo.innerHTML = "";
  if (sidebar) sidebar.innerHTML = "";
}

function renderPropertyDetails() {
  const showcase = byId<HTMLElement>("propertyShowcase");
  const mainInfo = byId<HTMLElement>("propertyMainInfo");
  const sidebar = byId<HTMLElement>("propertySidebar");
  if (!showcase || !mainInfo || !sidebar) return;
  if (!property) {
    renderNotFound();
    return;
  }

  document.title = `${property.title} — Júlio | Consultor Imobiliário`;
  const breadcrumbTitle = byId<HTMLElement>("breadcrumbTitle");
  if (breadcrumbTitle) breadcrumbTitle.textContent = property.title;

  const photos = galleryPhotos();
  const thumbsPhotos = thumbPhotos(photos);
  photoIndex = clampPhotoIndex(photoIndex, photos);
  const hasGallery = photos.length > 1;
  const thumbs = thumbsPhotos
    .map(
      (photo, index) => `
    <button class="pm-thumb${index === photoIndex ? " active" : ""}" type="button" data-detail-photo="${index}" aria-label="Ver foto ${index + 1}">
      <img src="${escapeHtml(photo)}" alt="" loading="lazy" />
    </button>
  `
    )
    .join("");
  const slides = photos
    .map(
      (photo, index) => `
    <div class="pm-carousel-slide">
      <img ${deferredImageAttrs(photo, index, photoIndex, `${thumbsPhotos[index] || photo} 320w, ${photo} 800w`)} sizes="(max-width: 760px) 100vw, min(100vw, 920px)" alt="${escapeHtml(property!.title)}" loading="${index === photoIndex ? "eager" : "lazy"}" />
    </div>
  `
    )
    .join("");

  showcase.innerHTML = `
    <div class="pm-gallery">
      <div class="pm-main-photo${photos.length ? "" : " placeholder"}">
        ${photos.length ? `<div class="pm-carousel-track" id="carouselTrack" style="transform: translateX(-${photoIndex * 100}%);">${slides}</div>` : ""}
        ${hasGallery ? '<button class="pm-nav prev" type="button" data-detail-gallery="prev" aria-label="Foto anterior">&lsaquo;</button>' : ""}
        ${hasGallery ? '<button class="pm-nav next" type="button" data-detail-gallery="next" aria-label="Próxima foto">&rsaquo;</button>' : ""}
        ${hasGallery ? `<span class="pm-counter" id="carouselCounter">${photoIndex + 1} / ${photos.length}</span>` : ""}
      </div>
      ${thumbs ? `<div class="pm-thumbs">${thumbs}</div>` : ""}
    </div>
  `;

  mainInfo.innerHTML = `
    <div class="info-header">
      <span class="pm-type">${escapeHtml(property.type)}</span>
      <h2>${escapeHtml(property.title)}</h2>
      <p class="pm-location">${ICONS.pin}${escapeHtml(property.location)}</p>
    </div>
    <div class="pm-specs">
      <span>${ICONS.bed}<strong>${property.beds || 0}</strong> Quartos${property.suites ? ` (${property.suites} ${property.suites === 1 ? "Suíte" : "Suítes"})` : ""}</span>
      <span>${ICONS.bath}<strong>${property.baths || 0}</strong> banheiros</span>
      <span>${ICONS.car}<strong>${property.parking || 0}</strong> vagas</span>
      <span>${ICONS.area}<strong>${property.area || 0}</strong> m²</span>
    </div>
    <div class="info-section">
      <h3>Descrição do imóvel</h3>
      <p class="pm-description">${escapeHtml(property.description || "Fale com o Júlio para receber a descrição completa deste imóvel.")}</p>
    </div>
    <div class="pm-features info-section">
      <h3>Diferenciais</h3>
      <ul>${featureItems(property)}</ul>
    </div>
    <div class="pm-map info-section">
      <h3>Localização aproximada</h3>
      <iframe title="Mapa de ${escapeHtml(property.title)}" src="${mapSrcFor(property)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  `;

  sidebar.innerHTML = `
    <div class="sticky-contact-card">
      <div class="card-price-section">
        <span class="card-price-label">Valor do imóvel</span>
        <strong class="card-price">${escapeHtml(property.price)}</strong>
        <span class="card-tag ${property.type === "Aluguel" ? "aluguel" : "venda"}">${escapeHtml(property.type)}</span>
      </div>
      <form class="contact-form-sidebar" id="sidebarContactForm" novalidate>
        <h4>Gostou deste imóvel?</h4>
        <p>Fale diretamente com o Júlio enviando uma mensagem no WhatsApp.</p>
        <div class="field">
          <label for="leadName">Nome</label>
          <input type="text" id="leadName" name="nome" placeholder="Seu nome completo" required />
        </div>
        <div class="field">
          <label for="leadPhone">WhatsApp / Telefone</label>
          <input type="tel" id="leadPhone" name="telefone" placeholder="(65) 90000-0000" required />
        </div>
        <button type="submit" class="btn btn-whatsapp btn-block btn-lg" id="submitLeadBtn">${ICONS.wa}Enviar proposta</button>
      </form>
      <div class="broker-info-card">
        <div class="broker-profile">
          <img src="/img/logo-nova-sem-fundo.png" alt="Júlio Consultor Imobiliário" class="broker-logo" />
          <div>
            <h5>Júlio</h5>
            <p>Consultor Imobiliário</p>
            <span class="broker-creci">CRECI-F 3098</span>
          </div>
        </div>
      </div>
    </div>
  `;

  bindSidebarForm();
}

function updateGalleryView(skipAnimation = false) {
  const track = byId<HTMLElement>("carouselTrack");
  const counter = byId<HTMLElement>("carouselCounter");
  if (!track || !property) return;
  const photos = galleryPhotos();
  photoIndex = clampPhotoIndex(photoIndex, photos);
  loadGalleryPhoto(photoIndex);
  if (skipAnimation) track.style.transition = "none";
  track.style.transform = `translateX(-${photoIndex * 100}%)`;
  if (skipAnimation) {
    void track.offsetHeight;
    track.style.transition = "";
  }
  if (counter) counter.textContent = `${photoIndex + 1} / ${photos.length}`;
  document.querySelectorAll<HTMLElement>(".pm-thumbs .pm-thumb").forEach((thumb, index) => {
    thumb.classList.toggle("active", index === photoIndex);
  });
}

function changePhoto(direction: number) {
  if (!property) return;
  photoIndex = clampPhotoIndex(photoIndex + direction, galleryPhotos());
  updateGalleryView();
}

function ensureLightbox() {
  if (byId("lightboxModal")) return;
  const lb = document.createElement("div");
  lb.className = "lightbox-modal";
  lb.id = "lightboxModal";
  lb.innerHTML = `
    <button class="lightbox-close" id="lightboxClose" aria-label="Fechar">&times;</button>
    <div class="lightbox-content" id="lightboxContent"><div class="lightbox-track" id="lightboxTrack"></div></div>
    <div class="lightbox-controls">
      <div class="lightbox-thumbs" id="lightboxThumbs" aria-label="Miniaturas das fotos"></div>
      <div class="lightbox-actions">
        <button class="lightbox-nav prev" id="lightboxPrev" aria-label="Anterior">&lsaquo;</button>
        <div class="lightbox-counter" id="lightboxCounter"></div>
        <button class="lightbox-nav next" id="lightboxNext" aria-label="Próxima">&rsaquo;</button>
      </div>
    </div>
    <div class="lightbox-hint">Clique para dar zoom • Mova o mouse para navegar</div>
  `;
  document.body.appendChild(lb);
  initLightboxEvents();
}

function renderLightbox() {
  if (!property) return;
  const track = byId<HTMLElement>("lightboxTrack");
  const counter = byId<HTMLElement>("lightboxCounter");
  const thumbs = byId<HTMLElement>("lightboxThumbs");
  if (!track || !counter || !thumbs) return;
  const photos = fullPhotos();
  const thumbsPhotos = thumbPhotos(photos);
  photoIndex = clampPhotoIndex(photoIndex, photos);
  track.innerHTML = photos
    .map(
      (photo, index) => `
    <div class="lightbox-slide${index === photoIndex ? " active" : ""}">
      <img ${deferredImageAttrs(photo, index, photoIndex)} alt="" loading="${index === photoIndex ? "eager" : "lazy"}" />
    </div>
  `
    )
    .join("");
  track.style.transform = `translateX(-${photoIndex * 100}%)`;
  counter.textContent = `${photoIndex + 1} / ${photos.length}`;
  thumbs.innerHTML = thumbsPhotos
    .map(
      (photo, index) => `
    <button class="lightbox-thumb${index === photoIndex ? " active" : ""}" type="button" data-lightbox-photo="${index}" aria-label="Ver foto ${index + 1}">
      <img src="${escapeHtml(photo)}" alt="" loading="lazy" />
    </button>
  `
    )
    .join("");
}

function openLightbox() {
  if (!property || fullPhotos().length <= 0) return;
  ensureLightbox();
  renderLightbox();
  byId<HTMLElement>("lightboxModal")?.classList.add("open");
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  byId<HTMLElement>("lightboxModal")?.classList.remove("open");
  document.body.classList.remove("lightbox-open");
}

function changeLightboxPhoto(direction: number) {
  if (!property) return;
  photoIndex = clampPhotoIndex(photoIndex + direction, fullPhotos());
  renderLightbox();
  updateGalleryView(true);
}

function initLightboxEvents() {
  const lb = byId<HTMLElement>("lightboxModal");
  const content = byId<HTMLElement>("lightboxContent");
  if (!lb || !content) return;
  lb.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("#lightboxClose") || target === lb || target === content) closeLightbox();
    if (target.closest("#lightboxPrev")) changeLightboxPhoto(-1);
    if (target.closest("#lightboxNext")) changeLightboxPhoto(1);
    const thumb = target.closest<HTMLElement>("[data-lightbox-photo]");
    if (thumb) {
      photoIndex = Number(thumb.dataset.lightboxPhoto || 0);
      renderLightbox();
      updateGalleryView(true);
    }
    const img = target.closest<HTMLImageElement>(".lightbox-slide.active img");
    if (img && !lightboxDidSwipe) img.classList.toggle("zoomed");
  });
  content.addEventListener(
    "touchstart",
    (event) => {
      lightboxTouchStartX = event.touches[0].clientX;
      lightboxTouchStartY = event.touches[0].clientY;
      lightboxDragStartIndex = photoIndex;
      lightboxDidSwipe = false;
    },
    { passive: true }
  );
  content.addEventListener(
    "touchend",
    (event) => {
      const dx = event.changedTouches[0].clientX - lightboxTouchStartX;
      const dy = event.changedTouches[0].clientY - lightboxTouchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
        lightboxDidSwipe = true;
        photoIndex = clampPhotoIndex(lightboxDragStartIndex + (dx < 0 ? 1 : -1), fullPhotos());
        renderLightbox();
        updateGalleryView(true);
        setTimeout(() => {
          lightboxDidSwipe = false;
        }, 80);
      }
    },
    { passive: true }
  );
  document.addEventListener("keydown", (event) => {
    if (!lb.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") changeLightboxPhoto(-1);
    if (event.key === "ArrowRight") changeLightboxPhoto(1);
  });
}

function initGalleryEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const nav = target.closest<HTMLElement>("[data-detail-gallery]");
    if (nav) changePhoto(nav.dataset.detailGallery === "next" ? 1 : -1);
    const thumb = target.closest<HTMLElement>("[data-detail-photo]");
    if (thumb) {
      photoIndex = Number(thumb.dataset.detailPhoto || 0);
      updateGalleryView();
    }
    if (target.closest(".pm-main-photo img, .pm-carousel-slide img")) openLightbox();
  });

  document.addEventListener(
    "touchstart",
    (event) => {
      const photo = (event.target as HTMLElement).closest(".pm-main-photo");
      if (!photo || !property || galleryPhotos().length <= 1) return;
      galleryTouchStartX = event.touches[0].clientX;
      galleryTouchStartY = event.touches[0].clientY;
      galleryDragStartIndex = photoIndex;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (event) => {
      const photo = (event.target as HTMLElement).closest(".pm-main-photo");
      if (!photo || !property || galleryPhotos().length <= 1) return;
      const dx = event.changedTouches[0].clientX - galleryTouchStartX;
      const dy = event.changedTouches[0].clientY - galleryTouchStartY;
      const threshold = Math.min(90, Math.max(44, (photo as HTMLElement).clientWidth * 0.18));
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        photoIndex = clampPhotoIndex(galleryDragStartIndex + (dx < 0 ? 1 : -1), galleryPhotos());
        updateGalleryView();
      }
    },
    { passive: true }
  );
}

function bindSidebarForm() {
  const form = byId<HTMLFormElement>("sidebarContactForm");
  if (!form || !property) return;
  const phoneInput = byId<HTMLInputElement>("leadPhone");
  phoneInput?.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement;
    el.value = formatPhoneInput(el.value);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameInput = byId<HTMLInputElement>("leadName");
    const phoneInput = byId<HTMLInputElement>("leadPhone");
    if (!nameInput || !phoneInput || !property) return;
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!name || !phone) {
      alert("Por favor, preencha seu nome e telefone para enviar a proposta.");
      return;
    }
    const msg = `Olá Júlio! Me chamo ${name} (WhatsApp: ${phone}). Gostei muito do imóvel '${property.title}' (${property.location}) listado no seu site e gostaria de obter mais informações sobre a negociação.`;
    window.open(`${waBase()}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });
}

function initHamburgerMenu() {
  const hamburger = byId<HTMLButtonElement>("hamburger");
  const mainNav = byId<HTMLElement>("mainNav");
  if (!hamburger || !mainNav) return;
  hamburger.addEventListener("click", () => {
    const active = hamburger.getAttribute("aria-expanded") === "true" ? "false" : "true";
    hamburger.setAttribute("aria-expanded", active);
    mainNav.classList.toggle("open", active === "true");
  });
  mainNav.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) {
      mainNav.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    }
  });
}

async function init() {
  const initialData = readInitialData<PropertyInitialData>();
  if (initialData) {
    property = initialData.property;
    contact = initialData.contact;
    hydrateGlobalContacts();
    bindSidebarForm();
  } else {
    const data = await fetchPublicPropertyData();
    contact = data.contact || DEFAULT_CONTACT;
    hydrateGlobalContacts();
    // Página sem container de detalhe (ex.: imóvel indisponível): só hidrata os
    // contatos do header/footer e encerra, sem buscar nem renderizar imóvel.
    if (!byId("propertyShowcase") && !byId("propertyMainInfo")) return;
    property = data.property;
    renderPropertyDetails();
  }
  initGalleryEvents();
  initHamburgerMenu();
}

void init();
