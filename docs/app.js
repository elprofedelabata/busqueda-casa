const state = {
  offers: [],
  query: "",
  minimumRooms: 0,
  sort: "recent"
};

const elements = {
  loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"),
  empty: document.querySelector("#emptyState"),
  grid: document.querySelector("#offersGrid"),
  errorText: document.querySelector("#errorText"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyText: document.querySelector("#emptyText"),
  updatedAt: document.querySelector("#updatedAt"),
  total: document.querySelector("#totalOffers"),
  sourceSummary: document.querySelector("#sourceSummary"),
  averagePrice: document.querySelector("#averagePrice"),
  averagePriceM2: document.querySelector("#averagePriceM2"),
  averageArea: document.querySelector("#averageArea"),
  resultCount: document.querySelector("#resultCount"),
  resultsTitle: document.querySelector("#resultsTitle"),
  search: document.querySelector("#searchInput"),
  rooms: document.querySelector("#roomsFilter"),
  sort: document.querySelector("#sortSelect"),
  cardTemplate: document.querySelector("#offerCardTemplate"),
  dialog: document.querySelector("#offerDialog"),
  dialogSource: document.querySelector("#dialogSource"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogLocation: document.querySelector("#dialogLocation"),
  dialogMetrics: document.querySelector("#dialogMetrics"),
  dialogFeatures: document.querySelector("#dialogFeatures"),
  dialogDescription: document.querySelector("#dialogDescription"),
  dialogLink: document.querySelector("#dialogLink")
};

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const integer = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0
});

const shortDate = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function showOnly(name) {
  ["loading", "error", "empty", "grid"].forEach(key => {
    elements[key].classList.toggle("hidden", key !== name);
  });
}

function finiteValues(values) {
  return values.filter(value => Number.isFinite(value));
}

function average(values) {
  const valid = finiteValues(values);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function housingArea(offer) {
  return Number(offer.area?.housing || offer.area?.advertised) || null;
}

function pricePerSquareMeter(offer) {
  const area = housingArea(offer);
  const price = Number(offer.price);
  return area && price ? price / area : null;
}

function formatDate(value) {
  if (!value) return "Fecha desconocida";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Fecha desconocida" : shortDate.format(date);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function searchableText(offer) {
  return normalize([
    offer.title,
    offer.location,
    offer.propertyType,
    ...(offer.features || [])
  ].join(" "));
}

function makeMetric(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "metric";
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value ?? "—";
  wrapper.append(term, description);
  return wrapper;
}

function appendFeatures(container, features, limit = Infinity) {
  container.replaceChildren();
  features.slice(0, limit).forEach(feature => {
    const chip = document.createElement("span");
    chip.className = "feature-chip";
    chip.textContent = feature;
    container.append(chip);
  });
}

function renderSummary(offers, updatedAt) {
  elements.total.textContent = integer.format(offers.length);

  const sources = [...new Set(offers.map(offer => offer.source).filter(Boolean))];
  elements.sourceSummary.textContent = sources.length
    ? sources.map(source => source[0].toUpperCase() + source.slice(1)).join(" · ")
    : "Añade tu primera vivienda";

  const meanPrice = average(offers.map(offer => Number(offer.price)));
  const meanPriceM2 = average(offers.map(pricePerSquareMeter));
  const meanArea = average(offers.map(housingArea));

  elements.averagePrice.textContent = meanPrice ? euros.format(meanPrice) : "—";
  elements.averagePriceM2.textContent = meanPriceM2
    ? `${integer.format(meanPriceM2)} €/m²`
    : "—";
  elements.averageArea.textContent = meanArea ? `${integer.format(meanArea)} m²` : "—";
  elements.updatedAt.textContent = updatedAt
    ? `Actualizado ${formatDate(updatedAt)}`
    : "Sin actualizaciones";
}

function filteredOffers() {
  const query = normalize(state.query);
  const filtered = state.offers.filter(offer => {
    const matchesQuery = !query || searchableText(offer).includes(query);
    const matchesRooms = !state.minimumRooms || Number(offer.rooms) >= state.minimumRooms;
    return matchesQuery && matchesRooms;
  });

  const sorters = {
    recent: (a, b) => new Date(b.updatedAt || b.savedAt) - new Date(a.updatedAt || a.savedAt),
    "price-asc": (a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity),
    "price-desc": (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    "price-m2": (a, b) => (pricePerSquareMeter(a) || Infinity) - (pricePerSquareMeter(b) || Infinity),
    "area-desc": (a, b) => (housingArea(b) || 0) - (housingArea(a) || 0)
  };

  return filtered.sort(sorters[state.sort] || sorters.recent);
}

function openDetails(offer) {
  elements.dialogSource.textContent = offer.source || "Portal";
  elements.dialogTitle.textContent = offer.title || "Vivienda sin título";
  elements.dialogLocation.textContent = offer.location || "Ubicación no indicada";
  elements.dialogDescription.textContent = offer.description || "El anuncio no incluye una descripción guardada.";
  elements.dialogLink.href = offer.url;

  elements.dialogMetrics.replaceChildren(
    makeMetric("Precio", offer.price ? euros.format(offer.price) : "—"),
    makeMetric("Vivienda", housingArea(offer) ? `${integer.format(housingArea(offer))} m²` : "—"),
    makeMetric("Habitaciones", offer.rooms ?? "—"),
    makeMetric("Baños", offer.bathrooms ?? "—"),
    makeMetric("Anunciados", offer.area?.advertised ? `${integer.format(offer.area.advertised)} m²` : "—"),
    makeMetric("Garaje/anexos", offer.area?.garage ? `${integer.format(offer.area.garage)} m²` : "—"),
    makeMetric("Precio/m²", pricePerSquareMeter(offer) ? `${integer.format(pricePerSquareMeter(offer))} €/m²` : "—"),
    makeMetric("Guardada", formatDate(offer.savedAt))
  );

  appendFeatures(elements.dialogFeatures, offer.features || []);
  elements.dialog.showModal();
}

function createCard(offer) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector(".card-source").textContent = offer.source || "Portal";
  card.querySelector(".saved-date").textContent = `Guardada ${formatDate(offer.savedAt)}`;
  card.querySelector(".card-title").textContent = offer.title || "Vivienda sin título";
  card.querySelector(".card-location").textContent = offer.location || "Ubicación no indicada";
  card.querySelector(".card-price").textContent = offer.price ? euros.format(offer.price) : "Precio no indicado";

  const priceM2 = pricePerSquareMeter(offer);
  card.querySelector(".card-price-m2").textContent = priceM2
    ? `${integer.format(priceM2)} €/m² vivienda`
    : "";

  const metrics = card.querySelector(".metrics");
  metrics.append(
    makeMetric("Vivienda", housingArea(offer) ? `${integer.format(housingArea(offer))} m²` : "—"),
    makeMetric("Anunciados", offer.area?.advertised ? `${integer.format(offer.area.advertised)} m²` : "—"),
    makeMetric("Habit.", offer.rooms ?? "—"),
    makeMetric("Baños", offer.bathrooms ?? "—")
  );

  appendFeatures(card.querySelector(".card-features"), offer.features || [], 4);
  card.querySelector(".detail-button").addEventListener("click", () => openDetails(offer));
  card.querySelector(".source-link").href = offer.url;
  return card;
}

function renderOffers() {
  const offers = filteredOffers();
  elements.grid.replaceChildren(...offers.map(createCard));
  elements.resultCount.textContent = `${offers.length} de ${state.offers.length}`;

  if (!state.offers.length) {
    elements.emptyTitle.textContent = "Aún no hay viviendas";
    elements.emptyText.textContent = "Abre un anuncio, pulsa la extensión y selecciona «Enviar a la app».";
    showOnly("empty");
    return;
  }

  if (!offers.length) {
    elements.emptyTitle.textContent = "No hay coincidencias";
    elements.emptyText.textContent = "Prueba a cambiar la búsqueda o el número mínimo de habitaciones.";
    showOnly("empty");
    return;
  }

  showOnly("grid");
}

async function fetchOffers() {
  const paths = ["data/offers.json", "../data/offers.json"];
  let lastError;

  for (const path of paths) {
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Respuesta ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No se encontró el archivo de ofertas.");
}

async function loadOffers() {
  showOnly("loading");
  try {
    const document = await fetchOffers();
    if (!document || !Array.isArray(document.offers)) {
      throw new Error("El archivo no tiene el formato esperado.");
    }
    state.offers = document.offers;
    renderSummary(state.offers, document.updatedAt);
    renderOffers();
  } catch (error) {
    elements.errorText.textContent = `No se pudo leer data/offers.json. ${error.message}`;
    elements.updatedAt.textContent = "Error de sincronización";
    showOnly("error");
  }
}

elements.search.addEventListener("input", event => {
  state.query = event.target.value;
  renderOffers();
});

elements.rooms.addEventListener("change", event => {
  state.minimumRooms = Number(event.target.value) || 0;
  renderOffers();
});

elements.sort.addEventListener("change", event => {
  state.sort = event.target.value;
  renderOffers();
});

document.querySelector("#retryButton").addEventListener("click", loadOffers);
document.querySelector("#closeDialog").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => {
  if (event.target === elements.dialog) elements.dialog.close();
});

loadOffers();
