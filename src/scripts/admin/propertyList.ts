import type { Property } from "@/types";
import { toLegacyProperties } from "@/lib/viewModel";
import { byId, escapeHtml } from "../dom";
import { adminApi, adminJson } from "./api";
import { confirmAction, showToast } from "./ui";
import { PROPERTIES_PER_PAGE, state } from "./state";

export async function loadProperties(page = state.currentPage) {
  if (!state.isAdmin) return;
  renderPropertyListSkeleton();
  try {
    const response = await adminApi<{
      properties: Property[];
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    }>(`/api/admin/properties?page=${page}&per_page=${PROPERTIES_PER_PAGE}`);
    // Página solicitada além do intervalo (ex.: excluir o último item da última página).
    if (response.totalPages >= 1 && page > response.totalPages) {
      await loadProperties(response.totalPages);
      return;
    }
    state.currentPage = response.page;
    state.totalPages = response.totalPages;
    state.totalProperties = response.total;
    state.properties = response.properties.map((property: Property) => ({
      ...property,
      photos: (property.photos || []).sort((a, b) => a.position - b.position)
    }));
    state.legacyProperties = toLegacyProperties(state.properties);
    renderAll();
  } catch {
    showToast("Nao foi possivel carregar os imoveis.", "danger");
    renderPropertyListError();
  }
}

function renderPropertyListSkeleton() {
  const count = byId<HTMLElement>("propertyCount");
  const list = byId<HTMLElement>("propertyList");
  if (count) count.textContent = "Carregando...";
  if (!list) return;
  list.innerHTML = `
    <div class="skeleton-list" aria-label="Carregando imoveis">
      ${Array.from({ length: 4 })
        .map(
          () => `
        <article class="admin-property-item skeleton-card">
          <div class="admin-thumb skeleton-image"></div>
          <div class="admin-item-main">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-footer"></div>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

function renderPropertyListError() {
  const count = byId<HTMLElement>("propertyCount");
  const list = byId<HTMLElement>("propertyList");
  if (count) count.textContent = "Falha ao carregar";
  if (!list) return;
  list.innerHTML = `
    <div class="error-state-card">
      <span class="error-icon" aria-hidden="true">!</span>
      <strong>Nao foi possivel carregar os imoveis</strong>
      <p>Verifique sua conexao e tente novamente. Se o erro persistir, confira o status do Supabase.</p>
      <button class="btn btn-primary" type="button" data-admin-retry-properties>Tentar novamente</button>
    </div>
  `;
}

function renderPaginationControls() {
  if (state.totalPages <= 1) return "";
  return `
    <nav class="admin-pagination" aria-label="Paginação de imóveis">
      <button class="action-btn" type="button" data-page-prev ${state.currentPage <= 1 ? "disabled" : ""}>Anterior</button>
      <span class="admin-pagination-status">Página ${state.currentPage} de ${state.totalPages}</span>
      <button class="action-btn" type="button" data-page-next ${state.currentPage >= state.totalPages ? "disabled" : ""}>Próxima</button>
    </nav>
  `;
}

function renderPropertyList() {
  const count = byId<HTMLElement>("propertyCount");
  const list = byId<HTMLElement>("propertyList");
  if (count)
    count.textContent = `${state.totalProperties} ${state.totalProperties === 1 ? "imóvel" : "imóveis"}`;
  if (!list) return;
  if (!state.legacyProperties.length) {
    list.innerHTML = '<div class="empty-admin">Nenhum imóvel cadastrado.</div>';
    return;
  }
  const items = state.legacyProperties
    .map(
      (property, index) => `
    <article class="admin-property-item admin-list-animate" style="--delay: ${(index % 6) * 0.04}s">
      <div class="admin-thumb">${property.img ? `<img src="${escapeHtml(property.img)}" alt="">` : ""}</div>
      <div class="admin-item-main">
        <div class="item-title">
          <strong>${escapeHtml(property.title)}</strong>
          <span class="tag ${property.type === "Venda" ? "sale" : ""}">${escapeHtml(property.type)}</span>
          ${property.isFeatured ? '<span class="tag featured">Destaque</span>' : ""}
        </div>
        <div class="item-meta">
          <span>${escapeHtml(property.location)}</span>
          <span>${escapeHtml(property.price)}</span>
          <span>${property.beds} quartos</span>
          <span>${property.baths} banheiros</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn" type="button" data-action="edit" data-id="${property.id}">Editar</button>
        <button class="action-btn" type="button" data-action="featured" data-id="${property.id}">Destaque</button>
        <button class="action-btn danger" type="button" data-action="delete" data-id="${property.id}">Remover</button>
      </div>
    </article>
  `
    )
    .join("");
  list.innerHTML = items + renderPaginationControls();
}

export function renderAll() {
  renderPropertyList();
}

export async function deleteProperty(id: string) {
  const property = state.properties.find((item) => item.id === id);
  if (!property) return;
  const confirmed = await confirmAction({
    title: "Remover imovel?",
    message: `Esta acao remove "${property.title}" da lista publica e apaga as fotos vinculadas.`,
    confirmLabel: "Remover imovel"
  });
  if (!confirmed) return;

  try {
    await adminApi(`/api/admin/properties/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    console.error("Erro ao excluir imovel:", error);
    showToast("Nao foi possivel excluir o imovel.", "danger");
    return;
  }

  await loadProperties();
  showToast("Imovel removido.", "success");
}

export async function setFeatured(id: string) {
  try {
    await adminJson(`/api/admin/properties/${encodeURIComponent(id)}`, "PATCH", {
      is_featured: true
    });
  } catch {
    showToast("Falha ao definir destaque.", "danger");
    return;
  }
  await loadProperties();
  showToast("Imovel em destaque atualizado.", "success");
}
