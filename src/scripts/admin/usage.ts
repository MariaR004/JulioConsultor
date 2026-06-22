import { byId, setStatus } from "../dom";
import { adminApi } from "./api";
import { PROPERTY_PHOTOS_BUCKET, state } from "./state";

type UsageSummary = {
  database_used_bytes: number | null;
  database_limit_bytes: number | null;
  bucket_used_bytes: number | null;
  bucket_limit_bytes: number | null;
  bucket_file_count: number | null;
};

function formatBytes(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes) || bytes === null || bytes === undefined || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: fractionDigits })} ${units[unitIndex]}`;
}

function usagePercent(used: number | null | undefined, limit: number | null | undefined) {
  if (!used || !limit || limit <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

function renderUsageCard(
  key: "database" | "bucket",
  options: { used?: number | null; limit?: number | null; meta: string; unavailable?: boolean }
) {
  const card = byId<HTMLElement>(`${key}UsageCard`);
  const label = byId<HTMLElement>(`${key}UsageLabel`);
  const bar = byId<HTMLElement>(`${key}UsageBar`);
  const meta = byId<HTMLElement>(`${key}UsageMeta`);
  if (!card || !label || !bar || !meta) return;

  const percent = usagePercent(options.used, options.limit);
  card.classList.toggle("warning", percent >= 75 && percent < 90);
  card.classList.toggle("danger", percent >= 90);
  label.textContent = options.unavailable
    ? "Indisponível"
    : `${formatBytes(options.used)} de ${formatBytes(options.limit)} (${percent}%)`;
  bar.style.width = options.unavailable ? "0%" : `${percent}%`;
  meta.textContent = options.meta;
}

function renderUsageLoading() {
  renderUsageCard("database", { used: 0, limit: 0, meta: "Carregando uso do banco de dados." });
  renderUsageCard("bucket", { used: 0, limit: 0, meta: "Carregando uso do bucket de fotos." });
  setStatus(byId("usageStatus"), "");
}

export async function loadUsageIndicators() {
  if (!state.isAdmin) {
    renderUsageCard("database", {
      unavailable: true,
      meta: "Entre como admin para carregar o indicador."
    });
    renderUsageCard("bucket", {
      unavailable: true,
      meta: "Entre como admin para carregar o indicador."
    });
    return;
  }

  renderUsageLoading();
  let usage: UsageSummary | undefined;
  try {
    const response = await adminApi<{ usage: UsageSummary }>("/api/admin/usage");
    usage = response.usage;
  } catch {
    renderUsageCard("database", {
      unavailable: true,
      meta: "Execute o SQL admin-usage-summary no Supabase."
    });
    renderUsageCard("bucket", {
      unavailable: true,
      meta: "Execute o SQL admin-usage-summary no Supabase."
    });
    setStatus(
      byId("usageStatus"),
      "Indicadores indisponiveis. A funcao admin_usage_summary ainda nao existe ou nao tem permissao.",
      true
    );
    return;
  }

  if (!usage) {
    renderUsageCard("database", { unavailable: true, meta: "Sem dados de uso retornados." });
    renderUsageCard("bucket", { unavailable: true, meta: "Sem dados de uso retornados." });
    return;
  }

  renderUsageCard("database", {
    used: usage.database_used_bytes,
    limit: usage.database_limit_bytes,
    meta: "Limite usado: plano Free do Supabase para tamanho do banco."
  });
  renderUsageCard("bucket", {
    used: usage.bucket_used_bytes,
    limit: usage.bucket_limit_bytes,
    meta: `${usage.bucket_file_count || 0} arquivo(s) no bucket ${PROPERTY_PHOTOS_BUCKET}.`
  });
}
