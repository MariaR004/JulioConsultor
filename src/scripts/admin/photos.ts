import { byId, escapeHtml } from "../dom";
import { adminApi, adminJson } from "./api";
import { confirmAction, showToast } from "./ui";
import { state, type DraftPhoto } from "./state";
import { renderPreview } from "./propertyForm";

export function renderPhotoList() {
  const list = byId<HTMLElement>("photoList");
  if (!list) return;
  if (!state.photoDrafts.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = state.photoDrafts
    .map(
      (photo, index) => `
    <div class="photo-item" draggable="true" data-index="${index}" data-photo-id="${photo.id || ""}" data-photo-key="${escapeHtml(photo.id || photo.url)}">
      <div class="photo-thumb">
        <img src="${escapeHtml(photo.thumb_url || photo.card_url || photo.url)}" alt="">
        ${index === 0 ? '<span class="photo-badge-cover">Capa</span>' : ""}
      </div>
      <button class="photo-remove" type="button" data-index="${index}" aria-label="Remover foto">&times;</button>
    </div>
  `
    )
    .join("");
}

function capturePhotoPositions() {
  return Array.from(document.querySelectorAll<HTMLElement>("#photoList .photo-item")).map(
    (item) => {
      const rect = item.getBoundingClientRect();
      return {
        key: item.dataset.photoKey || "",
        left: rect.left,
        top: rect.top
      };
    }
  );
}

function animatePhotoReorder(firstPositions: ReturnType<typeof capturePhotoPositions>) {
  const firstByKey = new Map(firstPositions.map((item) => [item.key, item]));
  document.querySelectorAll<HTMLElement>("#photoList .photo-item").forEach((item) => {
    const previous = firstByKey.get(item.dataset.photoKey || "");
    if (!previous) return;
    const rect = item.getBoundingClientRect();
    const dx = previous.left - rect.left;
    const dy = previous.top - rect.top;
    if (!dx && !dy) return;
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    item.style.transition = "none";
    void item.offsetHeight;
    requestAnimationFrame(() => {
      item.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
      item.style.transform = "translate(0, 0)";
    });
    window.setTimeout(() => {
      item.style.transform = "";
      item.style.transition = "";
    }, 400);
  });
}

export function reorderPhotos(sourceIndex: number, targetIndex: number) {
  if (sourceIndex === targetIndex) return;
  const firstPositions = capturePhotoPositions();
  const [moved] = state.photoDrafts.splice(sourceIndex, 1);
  if (!moved) return;
  state.photoDrafts.splice(targetIndex, 0, moved);
  renderPhotoList();
  renderPreview();
  animatePhotoReorder(firstPositions);
}

async function imageBitmapToWebp(
  bitmap: ImageBitmap,
  file: File,
  options: { maxSize: number; quality: number; suffix: string }
): Promise<File> {
  const scale = Math.min(1, options.maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", options.quality)
  );
  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-");
  return new File([blob], `${baseName}-${options.suffix}.webp`, { type: "image/webp" });
}

async function compressImageVariants(file: File) {
  const fallback = { thumb: file, card: file, full: file };
  if (!file.type.startsWith("image/")) return fallback;
  try {
    const bitmap = await createImageBitmap(file);
    const variants = {
      thumb: await imageBitmapToWebp(bitmap, file, {
        maxSize: 320,
        quality: 0.72,
        suffix: "thumb"
      }),
      card: await imageBitmapToWebp(bitmap, file, { maxSize: 800, quality: 0.76, suffix: "card" }),
      full: await imageBitmapToWebp(bitmap, file, { maxSize: 1600, quality: 0.82, suffix: "full" })
    };
    bitmap.close();
    return variants;
  } catch {
    return fallback;
  }
}

export async function uploadAndSyncPhotos(propertyId: string) {
  for (let index = 0; index < state.photoDrafts.length; index += 1) {
    const draft = state.photoDrafts[index];
    if (!draft.file || draft.id) continue;
    const files = await compressImageVariants(draft.file);
    const formData = new FormData();
    formData.set("thumb", files.thumb);
    formData.set("card", files.card);
    formData.set("full", files.full);
    formData.set("alt", draft.alt || files.full.name);
    formData.set("position", String(index));

    const { photo } = await adminApi<{ photo: DraftPhoto }>(
      `/api/admin/properties/${encodeURIComponent(propertyId)}/photos`,
      {
        body: formData,
        method: "POST"
      }
    );

    Object.assign(draft, photo);
  }

  const photoIds = state.photoDrafts.map((photo) => photo.id).filter(Boolean) as string[];
  if (photoIds.length) {
    await adminJson(
      `/api/admin/properties/${encodeURIComponent(propertyId)}/photos/order`,
      "PATCH",
      {
        photoIds
      }
    );
  }
}

export async function removePhoto(index: number) {
  const draft = state.photoDrafts[index];
  if (!draft) return;
  if (draft.id) {
    const confirmed = await confirmAction({
      title: "Remover foto?",
      message: "Esta acao remove a foto deste imovel no Storage e na galeria.",
      confirmLabel: "Remover"
    });
    if (!confirmed) return;

    try {
      await adminApi(`/api/admin/photos/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    } catch (error) {
      console.error("Erro ao remover foto:", error);
      showToast("Nao foi possivel excluir a foto.", "danger");
      return;
    }
  }

  if (draft.file) URL.revokeObjectURL(draft.url);
  state.photoDrafts.splice(index, 1);
  renderPhotoList();
  renderPreview();
  showToast("Foto removida.", "success");
}
