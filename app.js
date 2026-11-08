// O catálogo começa sem dados de demonstração para não apresentar stock fictício.
// Na próxima fase, estes elementos serão ligados ao Supabase.
const searchInput = document.querySelector("#search");
const materialFilter = document.querySelector("#material-filter");
const brandFilter = document.querySelector("#brand-filter");

function showEmptyCatalog() {
  const filamentGrid = document.querySelector("#filament-grid");
  const count = document.querySelector("#filament-count");
  if (filamentGrid) {
    filamentGrid.innerHTML = '<div class="empty-state"><span class="empty-icon">◌</span><h3>Ainda não há filamentos publicados.</h3><p>Quando forem adicionados e marcados como públicos, aparecem aqui.</p></div>';
  }
  if (count) count.textContent = "0 filamentos publicados";
}

showEmptyCatalog();

// Os filtros ficam preparados para receber os materiais e marcas da base de dados.