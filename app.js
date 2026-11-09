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
    const color=getHexColor(item.color_reference);
    if(color) card.append(makeColorSwatch(item.color_reference));
    else {const photo=makeImage(item.photo_url,item.color_name);if(photo) card.append(photo);else card.append(makeColorSwatch(null));}
    const details=document.createElement("div");details.className="filament-details";
    const brandName=document.createElement("p");brandName.className="filament-brand";brandName.textContent=item.brand||"Marca não indicada";
    const name=document.createElement("h3");name.textContent=item.color_name;
    const meta=document.createElement("p");meta.className="filament-meta";meta.textContent=[item.material,item.color_reference].filter(Boolean).join(" · ");
    const status=document.createElement("span");status.className=item.available?"availability available":"availability unavailable";status.textContent=item.available?"Disponível":"Esgotado";
    details.append(brandName,name,meta,status);card.append(details);filamentGrid.append(card);
  });
}

function openPrintDetails(item, photos, materials) {
  const overlay=document.createElement("div");overlay.className="print-modal-backdrop";
  const modal=document.createElement("section");modal.className="print-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label",item.name);
  const close=document.createElement("button");close.className="modal-close";close.type="button";close.textContent="✕";close.setAttribute("aria-label","Fechar");
  close.addEventListener("click",()=>overlay.remove());
  const heading=document.createElement("h2");heading.textContent=item.name;
  const gallery=document.createElement("div");gallery.className="print-modal-gallery";
  const mainPhoto=document.createElement("img");mainPhoto.alt=item.name;mainPhoto.className="print-modal-main";
  const urls=(photos||[]).map(x=>x.photo_url).filter(Boolean);
  if(!urls.length&&item.photo_url)urls.push(item.photo_url);
  if(urls.length){mainPhoto.src=urls[0];gallery.append(mainPhoto);}
  const thumbs=document.createElement("div");thumbs.className="print-thumbnails";
  urls.forEach((url,index)=>{const thumb=document.createElement("button");thumb.type="button";thumb.className="print-thumb";const image=document.createElement("img");image.src=url;image.alt=item.name+" — fotografia "+(index+1);thumb.append(image);thumb.addEventListener("click",()=>{mainPhoto.src=url;});thumbs.append(thumb);});
  gallery.append(thumbs);
  const content=document.createElement("div");content.className="print-modal-content";
  const price=document.createElement("p");price.className="print-price";price.textContent=item.price!==null&&item.price!==undefined?"Preço: "+Number(item.price).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}):"Preço sob consulta";
  const desc=document.createElement("p");desc.textContent=item.description||"";
  content.append(price,desc);
  if(item.useful_info){const h=document.createElement("h3");h.textContent="Informações úteis";const p=document.createElement("p");p.textContent=item.useful_info;content.append(h,p);}
  if(item.observations){const h=document.createElement("h3");h.textContent="Observações";const p=document.createElement("p");p.textContent=item.observations;content.append(h,p);}
  const allowed=(materials||[]).map(x=>x.material_name).filter(Boolean);
  if(allowed.length){const h=document.createElement("h3");h.textContent="Materiais disponíveis";const p=document.createElement("p");p.textContent=allowed.join(" · ");content.append(h,p);}
  modal.append(close,heading,gallery,content);overlay.append(modal);
  overlay.addEventListener("click",event=>{if(event.target===overlay)overlay.remove();});
  document.addEventListener("keydown",function esc(event){if(event.key==="Escape"){overlay.remove();document.removeEventListener("keydown",esc);}});
  document.body.append(overlay);
}

async function loadPublicCatalog() {
  try {
    const [fr,pr,photoResult,materialResult]=await Promise.all([
      client.from("catalog_filaments").select("id,brand,material,color_name,color_reference,photo_url,available").order("brand").order("color_name"),
      client.from("catalog_prints").select("id,name,description,photo_url,price,useful_info,observations").order("name"),
      client.from("catalog_print_photos").select("print_id,photo_url,sort_order").order("sort_order"),
      client.from("catalog_print_materials").select("print_id,material_id,material_name")
    ]);
    if(fr.error) throw fr.error;
    allFilaments=fr.data||[];
    const mats=[...new Set(allFilaments.map(x=>x.material).filter(Boolean))].sort();
    const brands=[...new Set(allFilaments.map(x=>x.brand).filter(Boolean))].sort();
    mats.forEach(v=>{if(![...materialFilter.options].some(o=>o.value===v))materialFilter?.add(new Option(v,v));});
    brands.forEach(v=>{if(![...brandFilter.options].some(o=>o.value===v))brandFilter?.add(new Option(v,v));});
    renderFilaments();
    if(pr.error) throw pr.error;
    if(photoResult.error) throw photoResult.error;
    if(materialResult.error) throw materialResult.error;
    const prints=pr.data||[],photos=photoResult.data||[],allowed=materialResult.data||[];
    printsGrid.replaceChildren();
    if(!prints.length) return showMessage(printsGrid,"Em breve, novas formas.","As impressões publicadas serão apresentadas nesta galeria.");
    prints.forEach(item=>{
      const itemPhotos=photos.filter(x=>x.print_id===item.id).sort((a,b)=>a.sort_order-b.sort_order);
      const card=document.createElement("button");card.type="button";card.className="print-card print-card-button";card.setAttribute("aria-label","Ver detalhes de "+item.name);
      const cover=itemPhotos[0]?.photo_url||item.photo_url;
      const img=makeImage(cover,item.name);if(img)card.append(img);
      const details=document.createElement("div");details.className="print-details";
      const title=document.createElement("h3");title.textContent=item.name;
      const desc=document.createElement("p");desc.textContent=item.description||"";
      const price=document.createElement("p");price.className="print-card-price";price.textContent=item.price!==null&&item.price!==undefined?Number(item.price).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}):"Preço sob consulta";
      const hint=document.createElement("span");hint.className="print-open-hint";hint.textContent="Ver peça e fotografias →";
      details.append(title,desc,price,hint);card.append(details);
      card.addEventListener("click",()=>openPrintDetails(item,itemPhotos,allowed.filter(x=>x.print_id===item.id)));
      printsGrid.append(card);
    });
  } catch(error) {
    console.error(error);
    showMessage(filamentGrid,"Não foi possível carregar o catálogo.","Verifica a ligação e as permissões do Supabase.");
    showMessage(printsGrid,"Não foi possível carregar as impressões.","Confirma as permissões das vistas públicas no Supabase.");
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
  await loadAdminPrints();
}

function renderAdminList() {
  const list=$("#admin-filament-list");list.replaceChildren();
  if(!adminFilaments.length){list.textContent="Ainda não tens filamentos no inventário.";return;}
  adminFilaments.forEach(item=>{
    const row=document.createElement("div");row.className="admin-row";
    const check=document.createElement("input");check.type="checkbox";check.checked=selectedIds.has(item.id);check.setAttribute("aria-label","Selecionar "+item.color_name);
    check.addEventListener("change",()=>{check.checked?selectedIds.add(item.id):selectedIds.delete(item.id);});
    row.append(check);
    const color=getHexColor(item.color_reference);
    if(color){const sw=makeColorSwatch(item.color_reference);sw.style.height="44px";sw.style.width="44px";sw.style.borderRadius="8px";row.append(sw);}
    else{const img=makeImage(item.photo_url,item.color_name);if(img){img.className="";row.append(img);}else{const sw=makeColorSwatch(null);sw.style.height="44px";sw.style.width="44px";sw.style.borderRadius="8px";row.append(sw);}}
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
    const remove=document.createElement("button");remove.type="button";remove.className="secondary-button delete-button";remove.textContent="Eliminar";
    remove.addEventListener("click",()=>deleteFilament(item));
    actions.append(publish,weight,remove);row.append(actions);list.append(row);
  });
}

async function updateFilament(id,changes) {
  const {error}=await client.from("filaments").update(changes).eq("id",id);
  if(error){alert("Não foi possível guardar: "+error.message);return;}
  await loadAdminFilaments();await loadPublicCatalog();
}

async function deleteFilament(item) {
  const confirmed=confirm(`Tens a certeza de que queres eliminar o filamento "${item.color_name}"? Esta ação não pode ser desfeita.`);
  if(!confirmed)return;
  const {error}=await client.from("filaments").delete().eq("id",item.id);
  if(error){alert("Não foi possível eliminar o filamento: "+error.message);return;}
  selectedIds.delete(item.id);
  await loadAdminFilaments();
  await loadPublicCatalog();
}


let adminPrints=[];
let printMaterials=[];
async function loadAdminPrints() {
  const list=$("#admin-print-list");if(!list)return;
  list.textContent="A carregar impressões…";
  const [{data:prints,error:pe},{data:materials,error:me}]=await Promise.all([
    client.from("prints").select("id,name,description,photo_url,price,useful_info,observations,is_public").order("created_at",{ascending:false}),
    client.from("materials").select("id,name").order("name")
  ]);
  if(pe){list.textContent="Não foi possível carregar as impressões: "+pe.message;return;}
  if(me){list.textContent="Não foi possível carregar os materiais: "+me.message;return;}
  adminPrints=prints||[];printMaterials=materials||[];
  const choices=$("#print-material-options");choices.replaceChildren();
  if(!printMaterials.length)choices.textContent="Ainda não existem materiais cadastrados.";
  printMaterials.forEach(material=>{const label=document.createElement("label");label.className="material-option";const check=document.createElement("input");check.type="checkbox";check.value=material.id;const span=document.createElement("span");span.textContent=material.name;label.append(check,span);choices.append(label);});
  list.replaceChildren();
  if(!adminPrints.length){list.textContent="Ainda não tens impressões. Usa o formulário acima para adicionar a primeira.";return;}
  adminPrints.forEach(item=>{
    const row=document.createElement("div");row.className="admin-print-row";
    const image=makeImage(item.photo_url,item.name);if(image){image.className="admin-print-thumb";row.append(image);}else{const placeholder=document.createElement("div");placeholder.className="admin-print-thumb admin-print-placeholder";placeholder.textContent="3D";row.append(placeholder);}
    const info=document.createElement("div");const title=document.createElement("strong");title.textContent=item.name;const meta=document.createElement("small");meta.textContent=[item.price!==null&&item.price!==undefined?Number(item.price).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}):"Preço sob consulta",item.is_public?"Publicado":"Oculto"].join(" · ");info.append(title,meta);row.append(info);
    const actions=document.createElement("div");actions.className="admin-print-actions";
    const visibility=document.createElement("button");visibility.type="button";visibility.className="secondary-button";visibility.textContent=item.is_public?"Ocultar":"Publicar";visibility.addEventListener("click",()=>setPrintVisibility(item.id,!item.is_public));
    const remove=document.createElement("button");remove.type="button";remove.className="secondary-button delete-button";remove.textContent="Eliminar";remove.addEventListener("click",()=>deletePrint(item));
    actions.append(visibility,remove);row.append(actions);list.append(row);
  });
}
async function setPrintVisibility(id,isPublic){
  const {error}=await client.from("prints").update({is_public:isPublic}).eq("id",id);
  if(error){alert("Não foi possível alterar a publicação: "+error.message);return;}
  await loadAdminPrints();await loadPublicCatalog();
}
async function deletePrint(item){
  if(!confirm('Queres mesmo eliminar "'+item.name+'"? Esta ação não pode ser desfeita.'))return;
  const {error}=await client.from("prints").delete().eq("id",item.id);
  if(error){alert("Não foi possível eliminar a impressão: "+error.message);return;}
  await loadAdminPrints();await loadPublicCatalog();
}
$("#print-photos")?.addEventListener("change",event=>{
  const files=[...event.target.files];
  if(files.length>4){alert("Podes selecionar no máximo 4 fotografias.");event.target.value="";}
  else if(files.some(file=>!file.type.startsWith("image/"))){alert("Todos os ficheiros têm de ser imagens.");event.target.value="";}
});
$("#print-form")?.addEventListener("submit",async event=>{
  event.preventDefault();const message=$("#print-message");message.textContent="A guardar impressão…";
  try{
    const name=$("#print-name").value.trim();
    const priceValue=$("#print-price").value.trim();
    const price=priceValue===""?null:Number(priceValue);
    if(price!==null&&(!Number.isFinite(price)||price<0))throw new Error("Indica um preço válido.");
    const files=[...$("#print-photos").files];
    if(files.length>4)throw new Error("Podes carregar no máximo 4 fotografias.");
    const {data:created,error:createError}=await client.from("prints").insert({
      name,price,description:$("#print-description").value.trim()||null,
      useful_info:$("#print-useful-info").value.trim()||null,
      observations:$("#print-observations").value.trim()||null,
      is_public:$("#print-publish").checked
    }).select("id").single();
    if(createError)throw createError;
    const uploaded=[];
    for(let i=0;i<files.length;i++){
      const file=files[i],safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path="prints/"+crypto.randomUUID()+"-"+safeName;
      const {error:uploadError}=await client.storage.from("catalogo-fotos").upload(path,file,{upsert:false});
      if(uploadError)throw uploadError;
      const {data:urlData}=client.storage.from("catalogo-fotos").getPublicUrl(path);
      uploaded.push({print_id:created.id,photo_url:urlData.publicUrl,sort_order:i});
    }
    if(uploaded.length){
      const {error:photosError}=await client.from("print_photos").insert(uploaded);
      if(photosError)throw photosError;
      const {error:coverError}=await client.from("prints").update({photo_url:uploaded[0].photo_url}).eq("id",created.id);
      if(coverError)throw coverError;
    }
    const materialIds=[...$("#print-material-options").querySelectorAll('input[type="checkbox"]:checked')].map(input=>Number(input.value));
    if(materialIds.length){
      const {error:materialsError}=await client.from("print_materials").insert(materialIds.map(material_id=>({print_id:created.id,material_id})));
      if(materialsError)throw materialsError;
    }
    $("#print-form").reset();message.textContent="Impressão guardada com sucesso.";
    await loadAdminPrints();await loadPublicCatalog();
  }catch(error){console.error(error);message.textContent="Erro ao guardar: "+(error.message||"confirma os dados e as permissões.");}
});

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
