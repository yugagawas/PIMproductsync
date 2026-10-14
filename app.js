/* ProductSync PIM — local-first hackathon prototype.
   Data is stored in this browser. Channel sync is simulated; no external API is called. */
"use strict";
const $ = id => document.getElementById(id);
const KEYS = { products: "productsync_pim_products_v1", logs: "productsync_pim_logs_v1", categories: "productsync_pim_categories_v1", attributes: "productsync_pim_attributes_v1", lastRun: "productsync_pim_last_run_v1" };
const DEFAULT_CATEGORIES = ["Electronics", "Clothing", "Home", "Accessories", "Other"];
const DEFAULT_ATTRIBUTES = [
  { name: "Brand", type: "Text" }, { name: "Color", type: "Text" },
  { name: "Size / variant", type: "Text" }, { name: "GTIN / barcode", type: "Identifier" },
  { name: "Material", type: "Text" }, { name: "Country of origin", type: "Text" }
];
let products = load(KEYS.products, []);
let logs = load(KEYS.logs, []);
let categories = load(KEYS.categories, DEFAULT_CATEGORIES);
let attributes = load(KEYS.attributes, DEFAULT_ATTRIBUTES);
let editingId = null;
let smallModalMode = "category";
let toastTimer = null;
let selectedIds = new Set();

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : structuredCloneSafe(fallback); }
  catch { return structuredCloneSafe(fallback); }
}
function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }
function persist() {
  try {
    localStorage.setItem(KEYS.products, JSON.stringify(products));
    localStorage.setItem(KEYS.logs, JSON.stringify(logs));
    localStorage.setItem(KEYS.categories, JSON.stringify(categories));
    localStorage.setItem(KEYS.attributes, JSON.stringify(attributes));
    return true;
  } catch (error) {
    notify("Could not save to browser storage. Export a backup and check available storage.", "error");
    return false;
  }
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function id() { return "prod_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
function notify(message, type = "success") {
  const toast = $("toast"); toast.textContent = message; toast.className = "toast " + type;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add("hidden"), 3800);
}
function log(message, type = "Info") {
  logs.unshift({ id: id(), message, type, at: new Date().toLocaleString() });
  logs = logs.slice(0, 250);
  persist();
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}
function getIssues(product) {
  const issues = [];
  if (!String(product.name || "").trim()) issues.push("Product name is missing");
  if (!String(product.sku || "").trim()) issues.push("SKU is missing");
  if (!String(product.category || "").trim()) issues.push("Category is missing");
  if (product.price === "" || product.price === null || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) issues.push("Price must be zero or greater");
  if (!String(product.description || "").trim()) issues.push("Description is missing");
  if (product.sku && products.some(other => other.id !== product.id && String(other.sku).trim().toLowerCase() === String(product.sku).trim().toLowerCase())) issues.push("SKU is duplicated");
  if (product.imageUrl && !/^https?:\/\//i.test(product.imageUrl)) issues.push("Image URL must use HTTP or HTTPS");
  return issues;
}
function qualityBadge(product) {
  const issues = getIssues(product);
  return issues.length ? `<span class="quality-pill issue">● ${issues.length} issue${issues.length === 1 ? "" : "s"}</span>` : `<span class="quality-pill pass">✓ Passed</span>`;
}
function statusBadge(status) {
  const s = status || "Draft";
  return `<span class="status-pill ${esc(s.toLowerCase())}">${esc(s)}</span>`;
}
function channelBadge(product) {
  const s = product.channelStatus || "Pending";
  return `<span class="channel-pill ${s === "Mock synced" ? "synced" : s === "Blocked" ? "issue" : "pending"}">${esc(s)}</span>`;
}
function productCell(p) {
  const thumb = p.imageUrl
    ? `<img class="product-thumb" src="${esc(p.imageUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;product-thumb fallback&quot;>${esc((p.name || "P").slice(0,1).toUpperCase())}</span>'">`
    : `<span class="product-thumb fallback">${esc((p.name || "P").slice(0,1).toUpperCase())}</span>`;
  return `<div class="product-cell">${thumb}<div><strong>${esc(p.name || "Untitled product")}</strong><small>${esc(p.brand || p.description || "No additional details")}</small></div></div>`;
}
function actionButtons(p) {
  return `<div class="row-actions"><button type="button" data-action="edit" data-id="${esc(p.id)}">Edit</button><button type="button" class="delete" data-action="delete" data-id="${esc(p.id)}">Delete</button></div>`;
}
function emptyRow(cols, message) { return `<tr><td class="empty-cell" colspan="${cols}">${esc(message)}</td></tr>`; }
function renderRecent() {
  const list = [...products].sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0,5);
  $("recentProducts").innerHTML = list.length ? list.map(p => `<tr><td>${productCell(p)}</td><td>${esc(p.category)}</td><td>${statusBadge(p.status)}</td><td>${formatDate(p.updatedAt)}</td></tr>`).join("") : emptyRow(4, "No products yet. Add your first product to get started.");
}
function currentFilteredProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const category = $("filterCategory").value;
  const status = $("filterStatus").value;
  const quality = $("filterQuality").value;
  return products.filter(p => {
    const matchesQ = !q || [p.name,p.sku,p.brand,p.description,p.tags].some(v => String(v || "").toLowerCase().includes(q));
    const matchesCategory = !category || p.category === category;
    const matchesStatus = !status || p.status === status;
    const issues = getIssues(p);
    const matchesQuality = !quality || (quality === "clean" ? issues.length === 0 : issues.length > 0);
    return matchesQ && matchesCategory && matchesStatus && matchesQuality;
  }).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}
function renderProducts() {
  const list = currentFilteredProducts();
  $("productRows").innerHTML = list.length ? list.map(p => `<tr>
    <td><input type="checkbox" data-select-id="${esc(p.id)}" aria-label="Select ${esc(p.name)}" ${selectedIds.has(p.id) ? "checked" : ""}></td>
    <td>${productCell(p)}</td><td>${esc(p.sku)}</td><td>${esc(p.category)}</td><td>${formatMoney(p.price)}</td><td>${statusBadge(p.status)}</td><td>${qualityBadge(p)}</td><td>${channelBadge(p)}</td><td>${actionButtons(p)}</td>
  </tr>`).join("") : emptyRow(9, products.length ? "No products match these filters." : "No products yet. Click Add product to create a record.");
  $("catalogSummary").textContent = `Showing ${list.length} of ${products.length} product${products.length === 1 ? "" : "s"}`;
  $("navProductCount").textContent = products.length;
  $("selectAll").checked = list.length > 0 && list.every(p => selectedIds.has(p.id));
  $("selectAll").indeterminate = list.some(p => selectedIds.has(p.id)) && !list.every(p => selectedIds.has(p.id));
  $("bulkToolbar").classList.toggle("hidden", selectedIds.size === 0);
  $("selectedCount").textContent = `${selectedIds.size} selected`;
}
function renderDashboard() {
  const issues = products.filter(p => getIssues(p).length);
  const active = products.filter(p => p.status === "Active").length;
  const synced = products.filter(p => p.channelStatus === "Mock synced").length;
  const clean = products.length - issues.length;
  const percent = products.length ? Math.round(clean / products.length * 100) : 0;
  $("metricTotal").textContent = products.length;
  $("metricActive").textContent = active;
  $("metricIssues").textContent = issues.length;
  $("metricSynced").textContent = synced;
  $("healthPercent").textContent = percent + "%";
  $("healthProgress").style.width = percent + "%";
  $("healthChecked").textContent = products.length;
  $("healthProblem").textContent = issues.length;
  $("navProductCount").textContent = products.length;
}
function renderQuality() {
  const result = products.map(p => ({ product: p, issues: getIssues(p) }));
  const problems = result.filter(x => x.issues.length);
  $("qualityChecked").textContent = products.length;
  $("qualityPassed").textContent = products.length - problems.length;
  $("qualityFailed").textContent = problems.length;
  $("qualityIssueTotal").textContent = result.reduce((sum, x) => sum + x.issues.length, 0);
  const filter = $("qualityFilter").value;
  const filtered = result.filter(x => filter === "all" || (filter === "issues" ? x.issues.length > 0 : x.issues.length === 0));
  $("qualityRows").innerHTML = filtered.length ? filtered.map(({product:p, issues}) => `<tr><td>${productCell(p)}</td><td>${esc(p.sku)}</td><td>${issues.length ? '<span class="quality-pill issue">Needs attention</span>' : '<span class="quality-pill pass">✓ Passed</span>'}</td><td>${issues.length ? issues.map(esc).join("<br>") : "No issues found"}</td><td><div class="row-actions"><button data-action="edit" data-id="${esc(p.id)}">Review / edit</button></div></td></tr>`).join("") : emptyRow(5, products.length ? "No products in this quality view." : "Add products to run quality checks.");
}
function renderCategories() {
  const used = categories.map(category => ({ category, count: products.filter(p => p.category === category).length }));
  $("categoryList").innerHTML = used.length ? used.map(({category,count}) => `<div class="taxonomy-item"><span class="taxonomy-icon">◇</span><div class="taxonomy-main"><strong>${esc(category)}</strong><small>Product classification</small></div><span class="count">${count} product${count===1?"":"s"}</span>${DEFAULT_CATEGORIES.includes(category) ? "" : `<button class="btn btn-quiet btn-small" data-action="remove-category" data-category="${esc(category)}">Remove</button>`}</div>`).join("") : `<p class="helper-text">No categories defined.</p>`;
  $("attributeList").innerHTML = attributes.length ? attributes.map((a,index) => `<div class="attribute-item"><span class="taxonomy-icon">Aa</span><div class="attribute-main"><strong>${esc(a.name)}</strong><small>Shared product attribute</small></div><span class="attribute-type">${esc(a.type || "Text")}</span>${DEFAULT_ATTRIBUTES.some(d=>d.name===a.name) ? "" : `<button class="btn btn-quiet btn-small" data-action="remove-attribute" data-index="${index}">Remove</button>`}</div>`).join("") : `<p class="helper-text">No attributes defined.</p>`;
}
function renderSync() {
  const blocked = products.filter(p => getIssues(p).length);
  const ready = products.length - blocked.length;
  $("syncReady").textContent = ready;
  $("syncBlocked").textContent = blocked.length;
  $("syncComplete").textContent = products.filter(p => p.channelStatus === "Mock synced").length;
  $("syncLastRun").textContent = localStorage.getItem(KEYS.lastRun) || "Never";
  $("syncRows").innerHTML = products.length ? products.map(p => `<tr><td>${productCell(p)}</td><td>${esc(p.sku)}</td><td>${qualityBadge(p)}</td><td>${channelBadge(p)}</td><td><div class="row-actions"><button data-action="edit" data-id="${esc(p.id)}">Review</button></div></td></tr>`).join("") : emptyRow(5, "Add products to review channel readiness.");
}
function renderActivity() {
  $("activityList").innerHTML = logs.length ? logs.map(item => `<div class="activity-item"><span class="activity-icon">${item.type === "Error" ? "!" : item.type === "Success" ? "✓" : "↻"}</span><div class="activity-copy"><strong>${esc(item.message)}</strong><p>${esc(item.at || "")}</p></div><span class="activity-tag">${esc(item.type || "Info")}</span></div>`).join("") : `<p class="helper-text">No activity yet. Product edits and mock sync attempts will appear here.</p>`;
}
function populateCategorySelects() {
  const filter = $("filterCategory");
  const current = filter.value;
  filter.innerHTML = `<option value="">All categories</option>` + categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (categories.includes(current)) filter.value = current;
  const productSelect = $("pCategory");
  const selected = productSelect.value;
  productSelect.innerHTML = `<option value="">Choose a category</option>` + categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (categories.includes(selected)) productSelect.value = selected;
}
function renderAll() {
  populateCategorySelects();
  renderDashboard(); renderProducts(); renderRecent(); renderQuality(); renderCategories(); renderSync(); renderActivity();
}
const TITLES = { dashboard: "Dashboard", products: "Product catalog", quality: "Data quality", categories: "Categories & attributes", sync: "Channel sync", activity: "Activity log" };
function switchView(view) {
  if (!TITLES[view]) return;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + view));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $("pageTitle").textContent = TITLES[view];
  $("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function formData() {
  const rawAttributes = $("pAttributes").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const parsedAttributes = {};
  for (const line of rawAttributes) {
    const colon = line.indexOf(":");
    if (colon < 1 || !line.slice(0, colon).trim() || !line.slice(colon + 1).trim()) throw new Error(`Invalid attribute line: "${line}". Use Name: Value.`);
    parsedAttributes[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  const imageUrl = $("pImage").value.trim();
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error("Image URL must begin with http:// or https://.");
  return {
    name: $("pName").value.trim(), sku: $("pSku").value.trim(), category: $("pCategory").value,
    brand: $("pBrand").value.trim(), price: $("pPrice").value === "" ? "" : Number($("pPrice").value),
    status: $("pStatus").value, color: $("pColor").value.trim(), variant: $("pVariant").value.trim(),
    gtin: $("pGtin").value.trim(), imageUrl, description: $("pDescription").value.trim(),
    tags: $("pTags").value.split(",").map(t => t.trim()).filter(Boolean), attributes: parsedAttributes
  };
}
function openProductModal(productId = null) {
  editingId = productId;
  const product = productId ? products.find(p => p.id === productId) : null;
  $("productForm").reset(); $("productFormError").textContent = "";
  populateCategorySelects();
  $("productModalTitle").textContent = product ? "Edit product" : "Add product";
  if (product) {
    $("pName").value = product.name || ""; $("pSku").value = product.sku || "";
    $("pCategory").value = product.category || ""; $("pBrand").value = product.brand || "";
    $("pPrice").value = product.price ?? ""; $("pStatus").value = product.status || "Draft";
    $("pColor").value = product.color || ""; $("pVariant").value = product.variant || "";
    $("pGtin").value = product.gtin || ""; $("pImage").value = product.imageUrl || "";
    $("pDescription").value = product.description || ""; $("pTags").value = (product.tags || []).join(", ");
    $("pAttributes").value = Object.entries(product.attributes || {}).map(([k,v]) => `${k}: ${v}`).join("\n");
  } else { $("pStatus").value = "Draft"; }
  $("productModal").classList.remove("hidden");
  setTimeout(() => $("pName").focus(), 0);
}
function closeProductModal() {
  $("productModal").classList.add("hidden"); editingId = null; $("productForm").reset(); $("productFormError").textContent = "";
}
function saveProduct(event) {
  event.preventDefault();
  let data;
  try { data = formData(); } catch (error) { $("productFormError").textContent = error.message; return; }
  if (!data.name || !data.sku || !data.category || !data.description) { $("productFormError").textContent = "Complete all required fields before saving."; return; }
  if (data.price === "" || !Number.isFinite(data.price) || data.price < 0) { $("productFormError").textContent = "Enter a valid price of zero or greater."; return; }
  const duplicate = products.some(p => p.id !== editingId && String(p.sku).trim().toLowerCase() === data.sku.toLowerCase());
  if (duplicate) { $("productFormError").textContent = "This SKU already exists. SKU values must be unique."; return; }
  const now = new Date().toISOString();
  if (editingId) {
    const index = products.findIndex(p => p.id === editingId);
    if (index < 0) return;
    products[index] = { ...products[index], ...data, channelStatus: "Pending", updatedAt: now };
    log(`Updated product: ${data.name}`, "Success");
    notify("Product updated successfully.");
  } else {
    products.unshift({ ...data, id: id(), channelStatus: "Pending", createdAt: now, updatedAt: now });
    log(`Created product: ${data.name}`, "Success");
    notify("Product added to your catalog.");
  }
  persist(); closeProductModal(); renderAll(); switchView("products");
}
function deleteProduct(productId) {
  const p = products.find(item => item.id === productId);
  if (!p || !confirm(`Delete "${p.name}"? This cannot be undone unless you have a backup.`)) return;
  products = products.filter(item => item.id !== productId); selectedIds.delete(productId);
  log(`Deleted product: ${p.name}`, "Success"); persist(); renderAll(); notify("Product deleted.");
}
function handleBulk(action) {
  if (!selectedIds.size) return;
  const ids = new Set(selectedIds);
  if (action === "delete") {
    if (!confirm(`Delete ${ids.size} selected product(s)? This cannot be undone without a backup.`)) return;
    products = products.filter(p => !ids.has(p.id)); log(`Bulk deleted ${ids.size} product(s).`, "Success");
  } else {
    const status = action === "activate" ? "Active" : "Draft";
    products = products.map(p => ids.has(p.id) ? { ...p, status, channelStatus: "Pending", updatedAt: new Date().toISOString() } : p);
    log(`Bulk changed ${ids.size} product(s) to ${status}.`, "Success");
  }
  selectedIds.clear(); persist(); renderAll(); notify("Bulk action completed.");
}
function runQualityCheck() {
  const issueCount = products.reduce((sum, p) => sum + getIssues(p).length, 0);
  log(`Data quality check completed: ${products.length} product(s) checked, ${issueCount} issue(s) found.`, "Info");
  renderAll(); notify(`Quality check complete: ${issueCount} issue(s) found.`, issueCount ? "info" : "success");
}
function runMockSync() {
  if (!products.length) { notify("Add a product before running the mock sync.", "error"); return; }
  let ready = 0, blocked = 0;
  products = products.map(p => {
    const issues = getIssues(p);
    if (issues.length) { blocked++; return { ...p, channelStatus: "Blocked" }; }
    ready++; return { ...p, channelStatus: "Mock synced" };
  });
  const timestamp = new Date().toLocaleString();
  localStorage.setItem(KEYS.lastRun, timestamp);
  log(`MOCK SYNC: ${ready} product(s) marked mock synced; ${blocked} blocked by data quality. No external API was called.`, blocked ? "Warning" : "Success");
  persist(); renderAll();
  notify(`Mock sync finished: ${ready} ready, ${blocked} blocked. No external store was contacted.`, blocked ? "info" : "success");
}
function resetSync() {
  products = products.map(p => ({ ...p, channelStatus: "Pending" }));
  localStorage.removeItem(KEYS.lastRun);
  log("Reset all channel statuses to Pending. No external system was changed.", "Info");
  persist(); renderAll(); notify("Channel statuses reset.");
}
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download("productsync-backup.json", JSON.stringify({ app: "ProductSync PIM", version: 1, exportedAt: new Date().toISOString(), products, logs, categories, attributes }, null, 2), "application/json");
  log("Exported a JSON backup.", "Success"); renderActivity(); notify("JSON backup downloaded.");
}
function csvEscape(value) { return '"' + String(value ?? "").replace(/"/g, '""') + '"'; }
function exportCSV() {
  const fields = ["name","sku","category","brand","price","status","color","variant","gtin","description","tags","attributes","channelStatus","createdAt","updatedAt"];
  const rows = [fields.join(","), ...products.map(p => fields.map(field => csvEscape(Array.isArray(p[field]) || (p[field] && typeof p[field] === "object") ? JSON.stringify(p[field]) : p[field])).join(","))];
  download("productsync-catalog.csv", "\uFEFF" + rows.join("\r\n"), "text/csv;charset=utf-8");
  log("Exported product catalog as CSV.", "Success"); renderActivity(); notify("CSV catalog downloaded.");
}
function importJSONFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const incoming = Array.isArray(payload) ? payload : payload.products;
      if (!Array.isArray(incoming)) throw new Error("File must contain a product array or a ProductSync backup.");
      const normalized = incoming.map(p => ({
        id: id(), name: String(p.name || "").trim(), sku: String(p.sku || "").trim(),
        category: String(p.category || "Other"), brand: String(p.brand || ""), price: p.price ?? "",
        status: ["Draft","Active","Archived"].includes(p.status) ? p.status : "Draft",
        color: String(p.color || ""), variant: String(p.variant || ""), gtin: String(p.gtin || ""),
        imageUrl: String(p.imageUrl || ""), description: String(p.description || ""),
        tags: Array.isArray(p.tags) ? p.tags.map(String) : String(p.tags || "").split(",").map(s=>s.trim()).filter(Boolean),
        attributes: p.attributes && typeof p.attributes === "object" && !Array.isArray(p.attributes) ? p.attributes : {},
        channelStatus: "Pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }));
      const seen = new Set();
      for (const p of normalized) {
        if (!p.name || !p.sku || !p.category || !p.description || p.price === "" || !Number.isFinite(Number(p.price)) || Number(p.price) < 0) throw new Error("Every imported product must have name, SKU, category, description and a valid non-negative price.");
        const key = p.sku.toLowerCase();
        if (seen.has(key)) throw new Error(`Duplicate SKU in import: ${p.sku}`);
        seen.add(key);
      }
      if (!confirm(`Import ${normalized.length} product(s)? This replaces the current catalog. Export a backup first if needed.`)) return;
      products = normalized;
      if (!Array.isArray(payload)) {
        if (Array.isArray(payload.categories)) categories = [...new Set([...DEFAULT_CATEGORIES, ...payload.categories.map(String)])];
        if (Array.isArray(payload.attributes)) attributes = payload.attributes;
        if (Array.isArray(payload.logs)) logs = payload.logs.slice(0, 250);
      }
      selectedIds.clear(); log(`Imported ${products.length} product(s) from JSON. Channel statuses reset to Pending.`, "Success");
      persist(); renderAll(); notify("JSON import completed.");
    } catch (error) { notify("Import failed: " + error.message, "error"); }
    finally { $("importJsonFile").value = ""; }
  };
  reader.readAsText(file);
}
function openSmallModal(mode) {
  smallModalMode = mode;
  $("smallModalTitle").textContent = mode === "category" ? "Add category" : "Add attribute";
  $("smallFieldLabel").textContent = mode === "category" ? "Category name" : "Attribute name";
  $("smallFieldInput").placeholder = mode === "category" ? "e.g. Sports" : "e.g. Material";
  $("smallFieldInput").value = ""; $("smallFormError").textContent = "";
  $("smallModal").classList.remove("hidden"); setTimeout(() => $("smallFieldInput").focus(), 0);
}
function closeSmallModal() { $("smallModal").classList.add("hidden"); $("smallForm").reset(); $("smallFormError").textContent = ""; }
function saveSmallModal(event) {
  event.preventDefault(); const name = $("smallFieldInput").value.trim();
  if (!name) { $("smallFormError").textContent = "Enter a name."; return; }
  if (smallModalMode === "category") {
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) { $("smallFormError").textContent = "That category already exists."; return; }
    categories.push(name); log(`Added category: ${name}`, "Success"); notify("Category added.");
  } else {
    if (attributes.some(a => a.name.toLowerCase() === name.toLowerCase())) { $("smallFormError").textContent = "That attribute already exists."; return; }
    attributes.push({ name, type: "Text" }); log(`Added attribute definition: ${name}`, "Success"); notify("Attribute definition added.");
  }
  persist(); closeSmallModal(); renderAll();
}
function removeCategory(name) {
  if (products.some(p => p.category === name)) { notify("This category is in use. Reassign its products before removing it.", "error"); return; }
  if (!confirm(`Remove category "${name}"?`)) return;
  categories = categories.filter(c => c !== name); log(`Removed category: ${name}`, "Info"); persist(); renderAll(); notify("Category removed.");
}
function removeAttribute(index) {
  const attr = attributes[index]; if (!attr) return;
  if (!confirm(`Remove attribute definition "${attr.name}"? Existing product values will not be automatically deleted.`)) return;
  attributes.splice(index, 1); log(`Removed attribute definition: ${attr.name}`, "Info"); persist(); renderAll(); notify("Attribute definition removed.");
}
function clearActivity() {
  if (!confirm("Clear the activity log? Product records will not be deleted.")) return;
  logs = []; persist(); renderActivity(); notify("Activity log cleared.");
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { switchView(viewButton.dataset.view); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "add-product") openProductModal();
  if (action.dataset.action === "edit") openProductModal(action.dataset.id);
  if (action.dataset.action === "delete") deleteProduct(action.dataset.id);
  if (action.dataset.action === "remove-category") removeCategory(action.dataset.category);
  if (action.dataset.action === "remove-attribute") removeAttribute(Number(action.dataset.index));
});
$("productForm").addEventListener("submit", saveProduct);
$("closeProductModal").addEventListener("click", closeProductModal);
$("cancelProduct").addEventListener("click", closeProductModal);
$("productModal").addEventListener("click", e => { if (e.target === $("productModal")) closeProductModal(); });
$("smallForm").addEventListener("submit", saveSmallModal);
$("closeSmallModal").addEventListener("click", closeSmallModal);
$("cancelSmall").addEventListener("click", closeSmallModal);
$("smallModal").addEventListener("click", e => { if (e.target === $("smallModal")) closeSmallModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeProductModal(); closeSmallModal(); } });
["productSearch","filterCategory","filterStatus","filterQuality"].forEach(key => $(key).addEventListener(key === "productSearch" ? "input" : "change", renderProducts));
$("clearFilters").addEventListener("click", () => { $("productSearch").value = ""; $("filterCategory").value = ""; $("filterStatus").value = ""; $("filterQuality").value = ""; renderProducts(); });
$("selectAll").addEventListener("change", () => { currentFilteredProducts().forEach(p => $("selectAll").checked ? selectedIds.add(p.id) : selectedIds.delete(p.id)); renderProducts(); });
$("productRows").addEventListener("change", e => { const cb = e.target.closest("[data-select-id]"); if (!cb) return; cb.checked ? selectedIds.add(cb.dataset.selectId) : selectedIds.delete(cb.dataset.selectId); renderProducts(); });
$("clearSelection").addEventListener("click", () => { selectedIds.clear(); renderProducts(); });
$("bulkActivate").addEventListener("click", () => handleBulk("activate"));
$("bulkDraft").addEventListener("click", () => handleBulk("draft"));
$("bulkDelete").addEventListener("click", () => handleBulk("delete"));
$("exportCsv").addEventListener("click", exportCSV);
$("exportJson").addEventListener("click", exportJSON);
$("importJsonBtn").addEventListener("click", () => $("importJsonFile").click());
$("importJsonFile").addEventListener("change", e => importJSONFile(e.target.files[0]));
$("runQualityCheck").addEventListener("click", runQualityCheck);
$("qualityFilter").addEventListener("change", renderQuality);
$("runMockSync").addEventListener("click", runMockSync);
$("resetSync").addEventListener("click", resetSync);
$("clearActivity").addEventListener("click", clearActivity);
$("addCategoryBtn").addEventListener("click", () => openSmallModal("category"));
$("addAttributeBtn").addEventListener("click", () => openSmallModal("attribute"));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));

renderAll();
