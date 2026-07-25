const form = document.querySelector("#configForm");
const saveButton = document.querySelector("#saveConfigButton");
const statusBox = document.querySelector("#status");
const inputs = {
  owner: document.querySelector("#owner"),
  repo: document.querySelector("#repo"),
  branch: document.querySelector("#branch"),
  path: document.querySelector("#path"),
  token: document.querySelector("#token")
};

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function readForm() {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, input]) => [key, input.value])
  );
}

async function load() {
  const config = await GitHubOffers.loadConfig();
  Object.entries(inputs).forEach(([key, input]) => {
    input.value = config[key] || "";
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  saveButton.disabled = true;
  saveButton.textContent = "Comprobando…";
  statusBox.classList.add("hidden");

  try {
    const config = readForm();
    const repository = await GitHubOffers.verifyConnection(config);
    await GitHubOffers.saveConfig(config);
    showStatus(
      `Conexión correcta con ${repository.fullName}. La extensión ya puede actualizar las ofertas.`,
      "success"
    );
  } catch (error) {
    showStatus(error.message || "No se pudo comprobar la conexión.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Comprobar y guardar";
  }
});

load().catch(error => showStatus(error.message, "error"));
