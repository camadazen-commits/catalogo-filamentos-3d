// Ligação pública ao Supabase. A chave publishable é própria para frontend;
// a segurança dos dados é aplicada pelas políticas RLS e pelas vistas públicas.
const SUPABASE_URL = "https://zvcifolrildgandjfkzy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MX6RLJjYE1GzTom9Ath_Uw_AXPPOqPK";

const searchInput = document.querySelector("#search");
const materialFilter = document.querySelector("#material-filter");
const brandFilter = document.querySelector("#brand-filter");
const filamentGrid = document.querySelector("#filament-grid");
const printsGrid = document.querySelector("#prints-grid");
const countLabel = document.querySelector("#filament-count");

function showMessage(container, title, message) {
  if (!container) return;
  const box = document.createElement("div");
  box.className = "empty-state";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  box.append(heading, paragraph);
  container.replaceChildren(box);
}

function makeImage(url, alt) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    const img = document.createElement("img");
    img.src = parsed.href;
    img.alt = alt;
    img.loading = "lazy";
    img.className = "catalog-photo";
    img.onerror = () => img.remove();
    return img;
  } catch {
    return null;
  }
}

let allFilaments = [];

function renderFilaments() {
  if (!filamentGrid) return;
  const query = (searchInput?.value || "").trim().toLocaleLowerCase("pt-PT");
  const material = materialFilter?.value || "";
  const brand = brandFilter?.value || "";
  const filtered = allFilaments.filter((item) => {
    const searchable = [item.brand, item.material, item.color_name, item.color_reference]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-PT");
    return searchable.includes(query)
      && (!material || item.material === material)
      && (!brand || item.brand === brand);
  });

  filamentGrid.replaceChildren();
  if (countLabel) countLabel.textContent = `${filtered.length} filamento(s) publicado(s)`;
  if (!filtered.length) {
    showMessage(filamentGrid, "Não foram encontrados filamentos.", "Experimenta alterar a pesquisa ou os filtros.");
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "filament-card";
    const photo = makeImage(item.photo_url, item.color_name || "Fotografia do filamento");
    if (photo) card.append(photo);
    else {
      const swatch = document.createElement("div");
      swatch.className = "filament-swatch";
      swatch.setAttribute("aria-hidden", "true");
      card.append(swatch);
    }
    const details = document.createElement("div");
    details.className = "filament-details";
    const brandName = document.createElement("p");
    brandName.className = "filament-brand";
    brandName.textContent = item.brand || "Marca não indicada";
    const name = document.createElement("h3");
    name.textContent = item.color_name;
    const meta = document.createElement("p");
    meta.className = "filament-meta";
    meta.textContent = [item.material, item.color_reference].filter(Boolean).join(" · ");
    const status = document.createElement("span");
    status.className = item.available ? "availability available" : "availability unavailable";
    status.textContent = item.available ? "Disponível" : "Esgotado";
    details.append(brandName, name, meta, status);
    card.append(details);
    filamentGrid.append(card);
  });
}

async function loadCatalog() {
  if (!window.supabase?.createClient) {
    showMessage(filamentGrid, "Não foi possível iniciar o catálogo.", "Atualiza a página. Se o problema continuar, verifica a ligação ao Supabase.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  try {
    const [filamentsResult, printsResult] = await Promise.all([
      client.from("catalog_filaments").select("id,brand,material,color_name,color_reference,photo_url,available").order("brand").order("color_name"),
      client.from("catalog_prints").select("id,name,description,photo_url").order("name")
    ]);

    if (filamentsResult.error) throw filamentsResult.error;
    allFilaments = filamentsResult.data || [];

    const materials = [...new Set(allFilaments.map(x => x.material).filter(Boolean))].sort();
    const brands = [...new Set(allFilaments.map(x => x.brand).filter(Boolean))].sort();
    materials.forEach(value => materialFilter?.add(new Option(value, value)));
    brands.forEach(value => brandFilter?.add(new Option(value, value)));
    renderFilaments();

    if (printsResult.error) {
      showMessage(printsGrid, "Não foi possível carregar as impressões.", "Verifica as permissões do catálogo de impressões.");
    } else {
      const prints = printsResult.data || [];
      printsGrid.replaceChildren();
      if (!prints.length) {
        showMessage(printsGrid, "Em breve, novas formas.", "As impressões publicadas serão apresentadas nesta galeria.");
      } else {
        prints.forEach(item => {
          const card = document.createElement("article");
          card.className = "print-card";
          const photo = makeImage(item.photo_url, item.name);
          if (photo) card.append(photo);
          const details = document.createElement("div");
          details.className = "print-details";
          const title = document.createElement("h3");
          title.textContent = item.name;
          const description = document.createElement("p");
          description.textContent = item.description || "";
          details.append(title, description);
          card.append(details);
          printsGrid.append(card);
        });
      }
    }
  } catch (error) {
    console.error("Erro ao carregar catálogo:", error);
    showMessage(filamentGrid, "Não foi possível ligar ao catálogo.", "Confirma as definições e permissões do Supabase. Atualiza a página para tentar novamente.");
  }
}

searchInput?.addEventListener("input", renderFilaments);
materialFilter?.addEventListener("change", renderFilaments);
brandFilter?.addEventListener("change", renderFilaments);

loadCatalog();
