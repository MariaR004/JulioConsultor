import type { ContactSettings } from "@/types";
import type { LegacyProperty } from "@/lib/viewModel";
import { escapeHtml } from "./dom";
import { legacyWhatsappBase, publicFeatureLabels } from "@/lib/viewModel";

export const ICONS = {
  pin: '<svg class="ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>',
  bed: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M21 10V7a2 2 0 0 0-2-2h-5v3h-4V5H5a2 2 0 0 0-2 2v3a3 3 0 0 0 0 6v3h2v-2h14v2h2v-3a3 3 0 0 0 0-6Z"/></svg>',
  bath: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 4a3 3 0 0 0-3 3v5H3a1 1 0 0 0 0 2h1v1a4 4 0 0 0 2 3.46V20a1 1 0 0 0 2 0v-1h8v1a1 1 0 0 0 2 0v-1.54A4 4 0 0 0 20 15v-1h1a1 1 0 0 0 0-2h-9V7a1 1 0 0 1 2 0 1 1 0 0 0 2 0 3 3 0 0 0-6 0v5H6V7a1 1 0 0 1 1-1 1 1 0 0 0 0-2Z"/></svg>',
  area: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"/></svg>',
  car: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h1Zm2.2 0h9.6l-1-3H8.2l-1 3Z"/></svg>',
  wa: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg>'
};

export function roomsText(property: LegacyProperty) {
  const beds = property.beds || 0;
  if (!property.suites) return `${beds} quartos`;
  return `${beds} quartos (${property.suites} ${property.suites === 1 ? "suíte" : "suítes"})`;
}

export function featureItems(
  property: Pick<LegacyProperty, "features" | "solarKwhMonth">,
  className = ""
) {
  const items = publicFeatureLabels(property);
  return items
    .map((feature) => `<li${className ? ` class="${className}"` : ""}>${escapeHtml(feature)}</li>`)
    .join("");
}

export function propertyCardHtml(
  property: LegacyProperty,
  contact: ContactSettings,
  index = 0,
  photoIndex = 0
) {
  const photos = property.photoCards || property.photos || [];
  const thumbs = property.photoThumbs || photos;
  const currentIndex = photos.length ? Math.max(0, Math.min(photoIndex, photos.length - 1)) : 0;
  const hasGallery = photos.length > 1;
  const tagClass = property.type === "Aluguel" ? "aluguel" : "venda";
  const waMsg = encodeURIComponent(
    `Olá Júlio, vi seu site e tenho interesse no imóvel: ${property.title} (${property.location}). Pode me passar mais informações?`
  );
  const slides = photos
    .map(
      (photo, index) =>
        `<div class="pc-carousel-slide"><img ${index === currentIndex ? `src="${escapeHtml(photo)}" srcset="${escapeHtml(thumbs[index] || photo)} 320w, ${escapeHtml(photo)} 800w"` : `data-src="${escapeHtml(photo)}" data-srcset="${escapeHtml(thumbs[index] || photo)} 320w, ${escapeHtml(photo)} 800w"`} sizes="(max-width: 760px) 100vw, 420px" alt="${escapeHtml(property.title)}" loading="lazy" /></div>`
    )
    .join("");

  return `
    <article class="property-card reveal clickable-card" data-property-id="${escapeHtml(property.id)}" style="--delay: ${(index % 3) * 0.08}s">
      <a href="/imovel/${encodeURIComponent(property.slug)}" class="pc-overlay-link" aria-label="Ver detalhes de ${escapeHtml(property.title)}"></a>
      <div class="pc-media${photos.length ? "" : " placeholder"}">
        ${photos.length ? `<div class="pc-carousel-track" style="transform: translateX(-${currentIndex * 100}%);">${slides}</div>` : ""}
        <span class="pc-tag ${tagClass}">${escapeHtml(property.type)}</span>
        ${hasGallery ? '<button class="pc-photo-btn prev" type="button" data-photo-action="prev" aria-label="Foto anterior">&lsaquo;</button>' : ""}
        ${hasGallery ? '<button class="pc-photo-btn next" type="button" data-photo-action="next" aria-label="Próxima foto">&rsaquo;</button>' : ""}
        ${hasGallery ? `<span class="pc-photo-count">${currentIndex + 1} / ${photos.length}</span>` : ""}
      </div>
      <div class="pc-body">
        <h3 class="pc-title">${escapeHtml(property.title)}</h3>
        <p class="pc-location">${ICONS.pin}${escapeHtml(property.location)}</p>
        <div class="pc-specs">
          <span>${ICONS.bed}${roomsText(property)}</span>
          <span>${ICONS.bath}${property.baths || 0} banh.</span>
          <span>${ICONS.car}${property.parking || 0} vagas na garagem</span>
          <span>${ICONS.area}${property.area || 0} m²</span>
        </div>
        <div class="pc-footer">
          <span class="pc-price">${escapeHtml(property.price)}<small>${escapeHtml(property.type)}</small></span>
          <a class="btn btn-whatsapp btn-sm" href="${legacyWhatsappBase(contact)}?text=${waMsg}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp sobre ${escapeHtml(property.title)}">
            ${ICONS.wa}Interesse
          </a>
        </div>
      </div>
    </article>
  `;
}

export function featuredHtml(property: LegacyProperty, contact: ContactSettings) {
  const photo = property.photoCards?.[0] || property.photos?.[0] || property.img;
  const thumb = property.photoThumbs?.[0] || photo;
  const tagClass = property.type === "Aluguel" ? "aluguel" : "venda";
  const waMsg = encodeURIComponent(
    `Olá Júlio, tenho interesse no imóvel em destaque: ${property.title} (${property.location}).`
  );

  return `
    <div class="featured-media reveal">
      ${photo ? `<img src="${escapeHtml(photo)}" srcset="${escapeHtml(thumb)} 320w, ${escapeHtml(photo)} 800w" sizes="(max-width: 760px) 100vw, 52vw" alt="${escapeHtml(`${property.title} - ${property.location}`)}" loading="lazy" />` : ""}
      <span class="featured-flag ${tagClass}">${escapeHtml(property.type)}</span>
    </div>
    <div class="featured-info reveal">
      <h3 class="featured-title">${escapeHtml(property.title)}</h3>
      <p class="featured-location">${ICONS.pin}${escapeHtml(property.location)}</p>
      <p class="featured-desc">${escapeHtml(property.description || "Fale com o Júlio para receber mais detalhes sobre este imóvel.")}</p>
      <ul class="specs">
        <li>${ICONS.bed}<span><strong>${property.beds || 0}</strong> Quartos${property.suites ? ` (${property.suites} ${property.suites === 1 ? "Suíte" : "Suítes"})` : ""}</span></li>
        <li>${ICONS.bath}<span><strong>${property.baths || 0}</strong> banheiros</span></li>
        <li>${ICONS.area}<span><strong>${property.area || 0}</strong> m²</span></li>
        <li>${ICONS.car}<span><strong>${property.parking || 0}</strong> vagas na garagem</span></li>
      </ul>
      <h4 class="features-title">Diferenciais do imóvel</h4>
      <ul class="feature-badges">${featureItems(property, "feature-badge")}</ul>
      <div class="featured-footer">
        <div class="price-block"><span class="price-label">Valor</span><span class="price">${escapeHtml(property.price)}</span></div>
        <div class="featured-actions">
          <a class="btn btn-outline-primary btn-lg" href="/imovel/${encodeURIComponent(property.slug)}">Ver detalhes</a>
          <a class="btn btn-whatsapp btn-lg" href="${legacyWhatsappBase(contact)}?text=${waMsg}" target="_blank" rel="noopener">${ICONS.wa}Tenho interesse</a>
        </div>
      </div>
    </div>
  `;
}
