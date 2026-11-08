// Catálogo público e administração privada através do Supabase.
const SUPABASE_URL = "https://zvcifolrildgandjfkzy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MX6RLJjYE1GzTom9Ath_Uw_AXPPOqPK";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const searchInput = $("#search");
const materialFilter = $("#material-filter");
const brandFilter = $("#brand-filter");
const filamentGrid = $("#filament-grid");
const printsGrid = $("#prints-grid");
const countLabel = $("#filament-count");
let allFilaments = [];
let adminFilaments = [];
const selectedIds = new Set();

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
    img.src = parsed.href; img.alt = alt; img.loading = "lazy"; img.className = "catalog-photo";
    img.onerror = () => img.remove();
    return img;
  } catch { return null; }
}


function getHexColor(reference) {
  const value = String(reference || "").trim();
  const match = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split("").map(ch => ch + ch).join("") : match[1];
  return "#" + hex.toUpperCase();
}

function makeColorSwatch(reference, className = "filament-swatch") {
  const swatch = document.createElement("div");
  swatch.className = className;
  const color = getHexColor(reference);
  if (color) {
    swatch.style.background = color;
    swatch.title = color;
    swatch.setAttribute("aria-label", "Amostra de cor " + color);
  }
  return swatch;
}

function updateColorPreview() {
  const preview = $("#color-preview");
  if (!preview) return;
  const color = getHexColor($("#color-reference")?.value);
  preview.style.background = color || "linear-gradient(135deg,#33394a,#202431)";
  preview.textContent = color || "Pré-visualização da cor";
  preview.classList.toggle("has-color", !!color);
}

function renderFilaments() {
  if (!filamentGrid) return;
  const query = (searchInput?.value || "").trim().toLocaleLowerCase("pt-PT");
  const material = materialFilter?.value || "";
  const brand = brandFilter?.value || "";
  const filtered = allFilaments.filter(item => {
    const searchable = [item.brand,item.material,item.color_name,item.color_reference].filter(Boolean).join(" ").toLocaleLowerCase("pt-PT");
    return searchable.includes(query) && (!material || item.material === material) && (!brand || item.brand === brand);
  });
  filamentGrid.replaceChildren();
  if (countLabel) countLabel.textContent = `${filtered.length} filamento(s) publicado(s)`;
  if (!filtered.length) return showMessage(filamentGrid,"Ainda não há filamentos publicados.","Quando adicionares filamentos e os publicares, aparecem aqui.");
  filtered.forEach(item => {
    const card=document.createElement("article"); card.className="filament-card";
    const photo=makeImage(item.photo_url,item.color_name);
    if(photo) card.append(photo); else {const swatch=makeColorSwatch(item.color_reference);card.append(swatch);}
    const details=document.createElement("div");details.className="filament-details";
    const brandName=document.createElement("p");brandName.className="filament-brand";brandName.textContent=item.brand||"Marca não indicada";
    const name=document.createElement("h3");name.textContent=item.color_name;
    const meta=document.createElement("p");meta.className="filament-meta";meta.textContent=[item.material,item.color_reference].filter(Boolean).join(" · ");
    const status=document.createElement("span");status.className=item.available?"availability available":"availability unavailable";status.textContent=item.available?"Disponível":"Esgotado";
    details.append(brandName,name,meta,status);card.append(details);filamentGrid.append(card);
  });
}

async function loadPublicCatalog() {
  try {
    const [fr,pr]=await Promise.all([
      client.from("catalog_filaments").select("id,brand,material,color_name,color_reference,photo_url,available").order("brand").order("color_name"),
      client.from("catalog_prints").select("id,name,description,photo_url").order("name")
    ]);
    if(fr.error) throw fr.error;
    allFilaments=fr.data||[];
    const mats=[...new Set(allFilaments.map(x=>x.material).filter(Boolean))].sort();
    const brands=[...new Set(allFilaments.map(x=>x.brand).filter(Boolean))].sort();
    mats.forEach(v=>materialFilter?.add(new Option(v,v)));
    brands.forEach(v=>brandFilter?.add(new Option(v,v)));
    renderFilaments();
    if(pr.error) throw pr.error;
    const prints=pr.data||[]; printsGrid.replaceChildren();
    if(!prints.length) return showMessage(printsGrid,"Em breve, novas formas.","As impressões publicadas serão apresentadas nesta galeria.");
    prints.forEach(item=>{
      const card=document.createElement("article");card.className="print-card";
      const img=makeImage(item.photo_url,item.name);if(img)card.append(img);
      const details=document.createElement("div");details.className="print-details";
      const title=document.createElement("h3");title.textContent=item.name;
      const desc=document.createElement("p");desc.textContent=item.description||"";
      details.append(title,desc);card.append(details);printsGrid.append(card);
    });
  } catch(error) {
    console.error(error);
    showMessage(filamentGrid,"Não foi possível carregar o catálogo.","Verifica a ligação e as permissões do Supabase.");
  }
}

function setAdminState(user) {
  $("#admin-login").hidden=!!user;
  $("#admin-dashboard").hidden=!user;
  if(user){$("#admin-user").textContent="Sessão iniciada: "+user.email;loadAdminFilaments();}
}

async function loadAdminFilaments() {
  const list=$("#admin-filament-list");
  list.textContent="A carregar inventário…";
  const {data,error}=await client.from("filaments").select("id,brand_id,material_id,color_name,color_reference,photo_url,weight_total,weight_remaining,is_public,brands(name),materials(name)").order("created_at",{ascending:false});
  if(error){list.textContent="Não foi possível carregar o inventário: "+error.message;return;}
  adminFilaments=data||[];selectedIds.clear();renderAdminList();
  const {data:brands}=await client.from("brands").select("name").order("name");
  const {data:materials}=await client.from("materials").select("name").order("name");
  $("#brand-options").replaceChildren(...(brands||[]).map(x=>new Option(x.name,x.name)));
  $("#material-options").replaceChildren(...(materials||[]).map(x=>new Option(x.name,x.name)));
}

function renderAdminList() {
  const list=$("#admin-filament-list");list.replaceChildren();
  if(!adminFilaments.length){list.textContent="Ainda não tens filamentos no inventário.";return;}
  adminFilaments.forEach(item=>{
    const row=document.createElement("div");row.className="admin-row";
    const check=document.createElement("input");check.type="checkbox";check.checked=selectedIds.has(item.id);check.setAttribute("aria-label","Selecionar "+item.color_name);
    check.addEventListener("change",()=>{check.checked?selectedIds.add(item.id):selectedIds.delete(item.id);});
    row.append(check);
    const img=makeImage(item.photo_url,item.color_name);if(img){img.className="";row.append(img);}else{const sw=makeColorSwatch(item.color_reference);sw.style.height="44px";sw.style.width="44px";sw.style.borderRadius="8px";row.append(sw);}
    const info=document.createElement("div");const title=document.createElement("strong");title.textContent=item.color_name;
    const sub=document.createElement("small");sub.textContent=[item.brands?.name,item.materials?.name,item.color_reference].filter(Boolean).join(" · ");
    info.append(title,sub);row.append(info);
    const stock=document.createElement("span");stock.className="stock";stock.textContent=`${item.weight_remaining} g / ${item.weight_total} g`;row.append(stock);
    const actions=document.createElement("div");actions.style.display="flex";actions.style.gap="7px";actions.style.alignItems="center";
    const publish=document.createElement("button");publish.type="button";publish.className="secondary-button";publish.textContent=item.is_public?"Ocultar":"Publicar";
    publish.addEventListener("click",()=>updateFilament(item.id,{is_public:!item.is_public}));
    const weight=document.createElement("button");weight.type="button";weight.className="secondary-button";weight.textContent="Alterar peso";
    weight.addEventListener("click",async()=>{
      const value=prompt("Peso restante em gramas:",String(item.weight_remaining));
      if(value===null)return;const n=Number(value);
      if(!Number.isInteger(n)||n<0||n>item.weight_total){alert("Indica um número inteiro entre 0 e o peso inicial.");return;}
      await updateFilament(item.id,{weight_remaining:n});
    });
    actions.append(publish,weight);row.append(actions);list.append(row);
  });
}

async function updateFilament(id,changes) {
  const {error}=await client.from("filaments").update(changes).eq("id",id);
  if(error){alert("Não foi possível guardar: "+error.message);return;}
  await loadAdminFilaments();await loadPublicCatalog();
}

$("#login-form")?.addEventListener("submit",async event=>{
  event.preventDefault();$("#login-message").textContent="A entrar…";
  const {data,error}=await client.auth.signInWithPassword({email:$("#login-email").value,password:$("#login-password").value});
  if(error){$("#login-message").textContent="Não foi possível entrar. Confirma o email e a palavra-passe.";return;}
  $("#login-message").textContent="Sessão iniciada.";setAdminState(data.user);
});
$("#logout-button")?.addEventListener("click",async()=>{await client.auth.signOut();setAdminState(null);});
$("#color-reference")?.addEventListener("input", updateColorPreview);
updateColorPreview();
$("#filament-form")?.addEventListener("submit",async event=>{
  event.preventDefault();const message=$("#filament-message");message.textContent="A guardar…";
  try {
    const brandName=$("#new-brand").value.trim(),materialName=$("#new-material").value.trim();
    const [{data:brand,error:be},{data:material,error:me}]=await Promise.all([
      client.from("brands").upsert({name:brandName},{onConflict:"name"}).select("id").single(),
      client.from("materials").upsert({name:materialName},{onConflict:"name"}).select("id").single()
    ]);
    if(be)throw be;if(me)throw me;
    let photoUrl=null;const file=$("#filament-photo").files[0];
    if(file){
      if(!file.type.startsWith("image/"))throw new Error("O ficheiro tem de ser uma imagem.");
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`filaments/${crypto.randomUUID()}-${safeName}`;
      const {error:uploadError}=await client.storage.from("catalogo-fotos").upload(path,file,{upsert:false});
      if(uploadError)throw uploadError;
      const {data:urlData}=client.storage.from("catalogo-fotos").getPublicUrl(path);photoUrl=urlData.publicUrl;
    }
    const total=Number($("#weight-total").value),remaining=Number($("#weight-remaining").value);
    if(!Number.isInteger(total)||!Number.isInteger(remaining)||total<1||remaining<0||remaining>total)throw new Error("Confirma os pesos: o restante deve estar entre zero e o peso inicial.");
    const {error}=await client.from("filaments").insert({brand_id:brand.id,material_id:material.id,color_name:$("#color-name").value.trim(),color_reference:$("#color-reference").value.trim()||null,photo_url:photoUrl,weight_total:total,weight_remaining:remaining,is_public:$("#publish-new").checked});
    if(error)throw error;
    $("#filament-form").reset();updateColorPreview();$("#weight-total").value=1000;$("#weight-remaining").value=1000;
    message.textContent="Filamento guardado com sucesso.";await loadAdminFilaments();await loadPublicCatalog();
  } catch(error){console.error(error);message.textContent="Erro ao guardar: "+error.message;}
});
async function bulkSetVisibility(isPublic) {
  const ids=[...selectedIds];if(!ids.length){alert("Seleciona primeiro pelo menos um filamento.");return;}
  const {error}=await client.from("filaments").update({is_public:isPublic}).in("id",ids);
  if(error){alert("Não foi possível atualizar: "+error.message);return;}
  await loadAdminFilaments();await loadPublicCatalog();
}
$("#bulk-show")?.addEventListener("click",()=>bulkSetVisibility(true));
$("#bulk-hide")?.addEventListener("click",()=>bulkSetVisibility(false));
searchInput?.addEventListener("input",renderFilaments);
materialFilter?.addEventListener("change",renderFilaments);
brandFilter?.addEventListener("change",renderFilaments);

// Abrir a área privada quando o utilizador carrega no respetivo link.
const adminSection = $("#admin");
function revealAdminSection() {
  if (!adminSection) return;
  adminSection.hidden = false;
  adminSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
$(".admin-link")?.addEventListener("click", event => {
  event.preventDefault();
  revealAdminSection();
  if (window.location.hash !== "#admin") history.replaceState(null, "", "#admin");
});
if (window.location.hash === "#admin") revealAdminSection();

client.auth.getSession().then(({data})=>setAdminState(data.session?.user||null));
client.auth.onAuthStateChange((_event,session)=>setAdminState(session?.user||null));
loadPublicCatalog();
