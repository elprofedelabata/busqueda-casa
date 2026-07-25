const views = {
  loading: document.querySelector("#loadingView"),
  error: document.querySelector("#errorView"),
  form: document.querySelector("#offerForm"),
  success: document.querySelector("#successView")
};

const fields = {
  title: document.querySelector("#title"),
  price: document.querySelector("#price"),
  areaAdvertised: document.querySelector("#areaAdvertised"),
  areaHousing: document.querySelector("#areaHousing"),
  areaGarage: document.querySelector("#areaGarage"),
  rooms: document.querySelector("#rooms"),
  bathrooms: document.querySelector("#bathrooms"),
  location: document.querySelector("#location"),
  description: document.querySelector("#description"),
  features: document.querySelector("#features"),
  url: document.querySelector("#url")
};

const sourceBadge = document.querySelector("#sourceBadge");
const errorMessage = document.querySelector("#errorMessage");
const fieldSummary = document.querySelector("#fieldSummary");
let extractedOffer = null;

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });
}

function valueOrEmpty(value) {
  return value ?? "";
}

function fillForm(offer) {
  fields.title.value = valueOrEmpty(offer.title);
  fields.price.value = valueOrEmpty(offer.price);
  fields.areaAdvertised.value = valueOrEmpty(offer.area?.advertised);
  fields.areaHousing.value = valueOrEmpty(offer.area?.housing);
  fields.areaGarage.value = valueOrEmpty(offer.area?.garage);
  fields.rooms.value = valueOrEmpty(offer.rooms);
  fields.bathrooms.value = valueOrEmpty(offer.bathrooms);
  fields.location.value = valueOrEmpty(offer.location);
  fields.description.value = valueOrEmpty(offer.description);
  fields.features.value = (offer.features || []).join("\n");
  fields.url.value = offer.url;

  sourceBadge.textContent = offer.source;
  sourceBadge.classList.remove("hidden");

  const detected = [
    offer.title,
    offer.price,
    offer.area?.advertised,
    offer.area?.housing,
    offer.area?.garage,
    offer.rooms,
    offer.bathrooms,
    offer.location
  ].filter(value => value !== null && value !== undefined && value !== "").length;
  fieldSummary.textContent = `${detected} de 8 campos principales detectados`;
}

function numberOrNull(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function makeOfferFromForm() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: extractedOffer.id,
    source: extractedOffer.source,
    sourceId: extractedOffer.sourceId,
    url: fields.url.value,
    title: fields.title.value.trim(),
    price: numberOrNull(fields.price.value),
    location: fields.location.value.trim() || null,
    propertyType: extractedOffer.propertyType,
    area: {
      advertised: numberOrNull(fields.areaAdvertised.value),
      housing: numberOrNull(fields.areaHousing.value),
      usable: null,
      garage: numberOrNull(fields.areaGarage.value)
    },
    rooms: numberOrNull(fields.rooms.value),
    bathrooms: numberOrNull(fields.bathrooms.value),
    features: fields.features.value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean),
    description: fields.description.value.trim() || null,
    savedAt: now,
    updatedAt: now
  };
}

function downloadJson(offer) {
  const blob = new Blob([JSON.stringify(offer, null, 2)], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${offer.id || "vivienda"}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function readCurrentTab() {
  showView("loading");
  sourceBadge.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error("No hay una pestaña activa disponible.");
    }

    const supported =
      tab.url.includes("idealista.") ||
      tab.url.includes("fotocasa.");

    if (!supported) {
      throw new Error("Abre un anuncio de Idealista o Fotocasa y vuelve a pulsar la extensión.");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractOfferFromPage
    });

    if (!result?.title) {
      throw new Error("La página es compatible, pero no parece ser la ficha de una vivienda.");
    }

    extractedOffer = result;
    fillForm(result);
    showView("form");
  } catch (error) {
    errorMessage.textContent = error.message || "Se ha producido un error inesperado.";
    showView("error");
  }
}

function extractOfferFromPage() {
  const text = document.body?.innerText || "";
  const url = location.href.split("?")[0].split("#")[0];
  const hostname = location.hostname.toLowerCase();
  const source = hostname.includes("idealista")
    ? "idealista"
    : hostname.includes("fotocasa")
      ? "fotocasa"
      : "desconocido";

  const firstText = selectors => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return null;
  };

  const meta = (...names) => {
    for (const name of names) {
      const selector = `meta[property="${name}"], meta[name="${name}"]`;
      const value = document.querySelector(selector)?.content?.trim();
      if (value) return value;
    }
    return null;
  };

  const parseNumber = value => {
    if (value === null || value === undefined) return null;
    const normalized = String(value)
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const match = normalized.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };

  const findJsonLd = () => {
    const values = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const parsed = JSON.parse(script.textContent);
        const walk = node => {
          if (!node || typeof node !== "object") return;
          if (Array.isArray(node)) {
            node.forEach(walk);
            return;
          }
          values.push(node);
          Object.values(node).forEach(walk);
        };
        walk(parsed);
      } catch {
        // Algunas páginas contienen bloques JSON-LD no válidos.
      }
    });
    return values;
  };

  const jsonLd = findJsonLd();
  const product = jsonLd.find(item => {
    const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    return type.some(value => ["Product", "RealEstateListing", "Residence", "Apartment", "House"].includes(value));
  }) || {};

  const offerData = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
  const title =
    firstText(["h1", ".main-info__title-main", "[class*='re-DetailHeader'] h1"]) ||
    product.name ||
    meta("og:title") ||
    document.title;

  const priceText =
    firstText([
      ".info-data-price",
      ".price",
      "[class*='price']"
    ]) ||
    offerData.price ||
    meta("product:price:amount");

  const description =
    firstText([
      ".comment",
      ".adCommentsLanguage",
      "[class*='description']"
    ]) ||
    product.description ||
    meta("description", "og:description");

  const locationText =
    firstText([
      ".main-info__title-minor",
      ".header-map-list",
      "[class*='location']",
      "[class*='address']"
    ]) ||
    product.address?.addressLocality ||
    null;

  const extractMetric = patterns => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseNumber(match[1]);
    }
    return null;
  };

  const extractMetricFrom = (sourceText, patterns) => {
    if (!sourceText) return null;
    for (const pattern of patterns) {
      const match = sourceText.match(pattern);
      if (match) return parseNumber(match[1]);
    }
    return null;
  };

  const featureSelectors = [
    ".details-property_features li",
    ".details-property-feature-one",
    ".listing-features li",
    "[class*='feature'] li"
  ];
  const featureSet = new Set();
  featureSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      const value = element.textContent?.trim();
      if (value && value.length < 160) featureSet.add(value);
    });
  });
  const structuredFeaturesText = [...featureSet].join("\n");

  const advertisedArea =
    extractMetricFrom(structuredFeaturesText, [
      /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:construidos|const\.?)/i,
      /superficie(?:\s+construida)?\D{0,20}(\d+(?:[.,]\d+)?)\s*m[²2]/i,
      /(\d+(?:[.,]\d+)?)\s*m[²2]/i
    ]) ||
    extractMetric([
      /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:construidos|const\.?)/i,
      /superficie(?:\s+construida)?\D{0,20}(\d+(?:[.,]\d+)?)\s*m[²2]/i,
      /(\d+(?:[.,]\d+)?)\s*m[²2]/i
    ]);

  const housingArea = extractMetricFrom(description, [
    /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:de\s+(?:la\s+)?)?(?:vivienda|casa|piso)/i,
    /(?:vivienda|casa|piso)\D{0,24}?(\d+(?:[.,]\d+)?)\s*m[²2]/i
  ]);

  const garageArea = extractMetricFrom(description, [
    /(\d+(?:[.,]\d+)?)\s*m[²2]\s*(?:de\s+(?:la\s+)?)?(?:garaje|cochera|aparcamiento)/i,
    /(?:garaje|cochera|aparcamiento)\D{0,24}?(\d+(?:[.,]\d+)?)\s*m[²2]/i
  ]);

  const sourceIdMatch = url.match(/(?:inmueble\/|\/)(\d{6,})(?:\/|$)/);
  const sourceId = sourceIdMatch?.[1] || null;

  let propertyType = null;
  const lowerTitle = title.toLowerCase();
  for (const type of ["piso", "chalet", "casa", "ático", "dúplex", "estudio", "terreno"]) {
    if (lowerTitle.includes(type)) {
      propertyType = type;
      break;
    }
  }

  return {
    id: sourceId ? `${source}-${sourceId}` : `${source}-${Date.now()}`,
    source,
    sourceId,
    url,
    title: title.replace(/\s+/g, " ").trim(),
    price: parseNumber(priceText),
    location: locationText?.replace(/\s+/g, " ").trim() || null,
    propertyType,
    area: {
      advertised: advertisedArea,
      housing: housingArea,
      garage: garageArea
    },
    rooms: extractMetric([
      /(\d+)\s*(?:hab\.?|habitaciones|dormitorios)/i
    ]),
    bathrooms: extractMetric([
      /(\d+)\s*(?:baño|baños)/i
    ]),
    description: description?.replace(/\s+/g, " ").trim() || null,
    features: [...featureSet].slice(0, 40)
  };
}

document.querySelector("#offerForm").addEventListener("submit", event => {
  event.preventDefault();
  const offer = makeOfferFromForm();
  downloadJson(offer);
  showView("success");
});

document.querySelector("#retryButton").addEventListener("click", readCurrentTab);
document.querySelector("#saveAnotherButton").addEventListener("click", () => showView("form"));

readCurrentTab();
