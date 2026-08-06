const defaults = {
  homePrice: 250000,
  appraisalValue: 250000,
  loanAmount: 200000,
  termYears: 25,
  financeLimit: 80,
  purchaseCostsPercent: 10,
  standardTin: 3.95,
  bonusTin: 2.95,
  firstMonthBonus: true,
  upfrontCosts: 400,
  standardAnnualCosts: 560,
  bonusAnnualCosts: 840
};

const state = {
  scenarios: null,
  chartScenario: "bonus"
};

const elements = typeof document === "undefined" ? {} : {
  form: document.querySelector("#simulatorForm"),
  reset: document.querySelector("#resetButton"),
  financingWarning: document.querySelector("#financingWarning"),
  calculationStatus: document.querySelector("#calculationStatus"),
  standardCard: document.querySelector("#standardCard"),
  bonusCard: document.querySelector("#bonusCard"),
  standardTinBadge: document.querySelector("#standardTinBadge"),
  bonusTinBadge: document.querySelector("#bonusTinBadge"),
  standardPayment: document.querySelector("#standardPayment"),
  standardFirstMonth: document.querySelector("#standardFirstMonth"),
  standardTae: document.querySelector("#standardTae"),
  standardInterest: document.querySelector("#standardInterest"),
  standardTotalCost: document.querySelector("#standardTotalCost"),
  bonusPayment: document.querySelector("#bonusPayment"),
  bonusMonthlyProducts: document.querySelector("#bonusMonthlyProducts"),
  bonusTae: document.querySelector("#bonusTae"),
  bonusInterest: document.querySelector("#bonusInterest"),
  bonusTotalCost: document.querySelector("#bonusTotalCost"),
  comparisonCallout: document.querySelector("#comparisonCallout"),
  comparisonHeadline: document.querySelector("#comparisonHeadline"),
  comparisonCopy: document.querySelector("#comparisonCopy"),
  ltvResult: document.querySelector("#ltvResult"),
  downPaymentResult: document.querySelector("#downPaymentResult"),
  cashNeededResult: document.querySelector("#cashNeededResult"),
  breakEvenText: document.querySelector("#breakEvenText"),
  chart: document.querySelector("#balanceChart"),
  chartToggles: [...document.querySelectorAll(".chart-toggle")],
  tableScenario: document.querySelector("#tableScenario"),
  amortizationBody: document.querySelector("#amortizationBody")
};

const currency = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const currencyPrecise = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentOne = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function numberValue(id) {
  const value = Number(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) ? value : 0;
}

function readInputs() {
  return {
    homePrice: Math.max(numberValue("homePrice"), 1),
    appraisalValue: Math.max(numberValue("appraisalValue"), 1),
    loanAmount: Math.max(numberValue("loanAmount"), 1),
    termYears: Math.max(Math.round(numberValue("termYears")), 1),
    financeLimit: Math.max(numberValue("financeLimit"), 0),
    purchaseCostsPercent: Math.max(numberValue("purchaseCostsPercent"), 0),
    standardTin: Math.max(numberValue("standardTin"), 0) / 100,
    bonusTin: Math.max(numberValue("bonusTin"), 0) / 100,
    firstMonthBonus: document.querySelector("#firstMonthBonus").checked,
    upfrontCosts: Math.max(numberValue("upfrontCosts"), 0),
    standardAnnualCosts: Math.max(numberValue("standardAnnualCosts"), 0),
    bonusAnnualCosts: Math.max(numberValue("bonusAnnualCosts"), 0)
  };
}

function annuityPayment(principal, annualRate, months) {
  if (months <= 0) return principal;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / months;
  return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

function calculateTae(principal, upfrontCosts, monthlyOutflows) {
  const netAmount = principal - upfrontCosts;
  if (netAmount <= 0 || !monthlyOutflows.length) return null;

  const difference = monthlyRate => {
    let presentValue = 0;
    for (let index = 0; index < monthlyOutflows.length; index += 1) {
      presentValue += monthlyOutflows[index] / Math.pow(1 + monthlyRate, index + 1);
    }
    return presentValue - netAmount;
  };

  if (Math.abs(difference(0)) < 0.000001) return 0;

  let low = 0;
  let high = 0.02;
  while (difference(high) > 0 && high < 2) high *= 2;
  if (difference(high) > 0) return null;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2;
    if (difference(middle) > 0) low = middle;
    else high = middle;
  }

  const monthlyRate = (low + high) / 2;
  return Math.pow(1 + monthlyRate, 12) - 1;
}

function yearlySummary(records) {
  const years = [];
  for (let index = 0; index < records.length; index += 12) {
    const group = records.slice(index, index + 12);
    years.push({
      year: years.length + 1,
      openingBalance: group[0].openingBalance,
      payments: group.reduce((sum, row) => sum + row.payment, 0),
      interest: group.reduce((sum, row) => sum + row.interest, 0),
      principal: group.reduce((sum, row) => sum + row.principalPaid, 0),
      closingBalance: group[group.length - 1].closingBalance,
      accumulatedInterest: records
        .slice(0, index + group.length)
        .reduce((sum, row) => sum + row.interest, 0)
    });
  }
  return years;
}

function simulateScenario({
  principal,
  months,
  annualRate,
  firstMonthRate,
  useFirstMonthRate,
  annualCosts,
  upfrontCosts
}) {
  let balance = principal;
  let regularPayment = annuityPayment(principal, annualRate, months);
  const firstPayment = useFirstMonthRate
    ? annuityPayment(principal, firstMonthRate, months)
    : regularPayment;
  const records = [];

  for (let month = 1; month <= months; month += 1) {
    if (month === 2 && useFirstMonthRate) {
      regularPayment = annuityPayment(balance, annualRate, months - 1);
    }

    const rateForMonth = month === 1 && useFirstMonthRate
      ? firstMonthRate
      : annualRate;
    const monthlyRate = rateForMonth / 12;
    const openingBalance = balance;
    let payment = month === 1 && useFirstMonthRate ? firstPayment : regularPayment;
    const interest = openingBalance * monthlyRate;
    let principalPaid = payment - interest;

    if (month === months || principalPaid > openingBalance) {
      principalPaid = openingBalance;
      payment = interest + principalPaid;
    }

    balance = Math.max(openingBalance - principalPaid, 0);
    records.push({
      month,
      openingBalance,
      payment,
      interest,
      principalPaid,
      closingBalance: balance
    });
  }

  const mortgagePayments = records.reduce((sum, row) => sum + row.payment, 0);
  const totalInterest = records.reduce((sum, row) => sum + row.interest, 0);
  const recurringCosts = annualCosts * months / 12;
  const totalPaid = mortgagePayments + recurringCosts + upfrontCosts;
  const monthlyProductCost = annualCosts / 12;
  const monthlyOutflows = records.map(row => row.payment + monthlyProductCost);

  return {
    records,
    years: yearlySummary(records),
    firstPayment: records[0].payment,
    regularPayment: records[Math.min(1, records.length - 1)].payment,
    mortgagePayments,
    totalInterest,
    recurringCosts,
    totalPaid,
    tae: calculateTae(principal, upfrontCosts, monthlyOutflows)
  };
}

function formatTae(value) {
  return value === null ? "—" : `${percent.format(value * 100)} %`;
}

function updateFinancingSummary(data) {
  const referenceValue = Math.min(data.homePrice, data.appraisalValue);
  const maximumLoan = referenceValue * data.financeLimit / 100;
  const ltv = data.loanAmount / referenceValue * 100;
  const downPayment = Math.max(data.homePrice - data.loanAmount, 0);
  const purchaseCosts = data.homePrice * data.purchaseCostsPercent / 100;
  const cashNeeded = downPayment + purchaseCosts + data.upfrontCosts;

  elements.ltvResult.textContent = `${percentOne.format(ltv)} %`;
  elements.downPaymentResult.textContent = currency.format(downPayment);
  elements.cashNeededResult.textContent = currency.format(cashNeeded);

  if (data.loanAmount > maximumLoan + 0.01) {
    const excess = data.loanAmount - maximumLoan;
    elements.financingWarning.className = "field-message warning";
    elements.financingWarning.textContent = `La hipoteca supera en ${currency.format(excess)} el límite del ${percentOne.format(data.financeLimit)} % sobre el menor valor entre precio y tasación (${currency.format(maximumLoan)}).`;
  } else {
    elements.financingWarning.className = "field-message success";
    elements.financingWarning.textContent = `El máximo orientativo con este límite sería ${currency.format(maximumLoan)}. La financiación introducida representa el ${percentOne.format(ltv)} %.`;
  }
}

function renderScenarioCards(data, standard, bonus) {
  elements.calculationStatus.textContent = `${data.termYears * 12} cuotas · ${data.termYears} años`;
  elements.standardTinBadge.textContent = `${percent.format(data.standardTin * 100)} % TIN`;
  elements.bonusTinBadge.textContent = `${percent.format(data.bonusTin * 100)} % TIN`;
  elements.standardPayment.textContent = currencyPrecise.format(standard.regularPayment);
  elements.standardFirstMonth.textContent = data.firstMonthBonus
    ? `Primer mes al ${percent.format(data.bonusTin * 100)} %: ${currencyPrecise.format(standard.firstPayment)}`
    : `La cuota se mantiene mientras no cambie el TIN`;
  elements.standardTae.textContent = formatTae(standard.tae);
  elements.standardInterest.textContent = currency.format(standard.totalInterest);
  elements.standardTotalCost.textContent = currency.format(standard.totalPaid);

  elements.bonusPayment.textContent = currencyPrecise.format(bonus.regularPayment);
  elements.bonusMonthlyProducts.textContent = data.bonusAnnualCosts
    ? `+ ${currencyPrecise.format(data.bonusAnnualCosts / 12)} al mes en productos`
    : "Sin costes periódicos añadidos";
  elements.bonusTae.textContent = formatTae(bonus.tae);
  elements.bonusInterest.textContent = currency.format(bonus.totalInterest);
  elements.bonusTotalCost.textContent = currency.format(bonus.totalPaid);

  const netSaving = standard.totalPaid - bonus.totalPaid;
  const monthlyMortgageSaving = standard.regularPayment - bonus.regularPayment;
  const bonusWins = netSaving >= 0;

  elements.standardCard.classList.toggle("winner", !bonusWins);
  elements.bonusCard.classList.toggle("winner", bonusWins);
  elements.comparisonCallout.classList.toggle("negative", !bonusWins);
  elements.comparisonHeadline.textContent = bonusWins
    ? `La bonificación ahorra ${currency.format(netSaving)}`
    : `Sin bonificación ahorra ${currency.format(Math.abs(netSaving))}`;
  elements.comparisonCopy.textContent = bonusWins
    ? `La cuota baja ${currencyPrecise.format(Math.max(monthlyMortgageSaving, 0))} al mes y el cálculo ya incluye los costes introducidos.`
    : "El coste de los productos introducidos supera el ahorro de intereses de la bonificación.";

  const grossMortgageSaving = standard.mortgagePayments - bonus.mortgagePayments;
  const extraAnnualCostLimit = grossMortgageSaving / data.termYears;
  elements.breakEvenText.textContent = grossMortgageSaving > 0
    ? `Con estos tipos, los productos bonificadores pueden costar hasta ${currency.format(extraAnnualCostLimit)} más al año que los del escenario sin bonificación antes de agotar el ahorro hipotecario bruto.`
    : "Con los tipos introducidos no existe ahorro hipotecario bruto por contratar la bonificación.";
}

function renderTable(scenarioName) {
  if (!state.scenarios) return;
  const scenario = state.scenarios[scenarioName];
  const fragment = document.createDocumentFragment();

  scenario.years.forEach(row => {
    const tr = document.createElement("tr");
    [
      row.year,
      currency.format(row.openingBalance),
      currency.format(row.payments),
      currency.format(row.interest),
      currency.format(row.principal),
      currency.format(row.closingBalance)
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tr.append(cell);
    });
    fragment.append(tr);
  });

  elements.amortizationBody.replaceChildren(fragment);
}

function drawChart() {
  if (!state.scenarios) return;
  const scenario = state.scenarios[state.chartScenario];
  const canvas = elements.chart;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 320);
  const height = Math.max(rect.height, 180);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  const padding = { top: 14, right: 12, bottom: 28, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const principal = scenario.records[0].openingBalance;
  const points = [{ year: 0, balance: principal, accumulatedInterest: 0 }, ...scenario.years];
  const maxValue = Math.max(principal, ...points.map(point => point.accumulatedInterest));
  const x = index => padding.left + index / (points.length - 1) * plotWidth;
  const y = value => padding.top + plotHeight - value / maxValue * plotHeight;

  context.font = "9px Inter, system-ui, sans-serif";
  context.fillStyle = "#718078";
  context.strokeStyle = "#e3e9e5";
  context.lineWidth = 1;

  for (let step = 0; step <= 4; step += 1) {
    const value = maxValue * step / 4;
    const lineY = y(value);
    context.beginPath();
    context.moveTo(padding.left, lineY);
    context.lineTo(width - padding.right, lineY);
    context.stroke();
    context.textAlign = "right";
    context.fillText(`${Math.round(value / 1000)}k €`, padding.left - 8, lineY + 3);
  }

  const labelYears = new Set([0, Math.round((points.length - 1) / 2), points.length - 1]);
  labelYears.forEach(index => {
    context.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
    context.fillText(`Año ${points[index].year}`, x(index), height - 7);
  });

  context.beginPath();
  points.forEach((point, index) => {
    const pointX = x(index);
    const pointY = y(point.balance ?? point.closingBalance);
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  });
  context.lineTo(x(points.length - 1), y(0));
  context.lineTo(x(0), y(0));
  context.closePath();
  const fill = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  fill.addColorStop(0, "rgba(38, 115, 86, .22)");
  fill.addColorStop(1, "rgba(38, 115, 86, .02)");
  context.fillStyle = fill;
  context.fill();

  context.beginPath();
  points.forEach((point, index) => {
    const pointY = y(point.balance ?? point.closingBalance);
    if (index === 0) context.moveTo(x(index), pointY);
    else context.lineTo(x(index), pointY);
  });
  context.strokeStyle = "#267356";
  context.lineWidth = 2.5;
  context.stroke();

  context.beginPath();
  points.forEach((point, index) => {
    const pointY = y(point.accumulatedInterest);
    if (index === 0) context.moveTo(x(index), pointY);
    else context.lineTo(x(index), pointY);
  });
  context.strokeStyle = "#d2a352";
  context.lineWidth = 2;
  context.setLineDash([5, 5]);
  context.stroke();
  context.setLineDash([]);

  canvas.setAttribute(
    "aria-label",
    `Evolución del escenario ${state.chartScenario === "bonus" ? "con" : "sin"} bonificación: saldo inicial ${currency.format(principal)} y saldo final ${currency.format(scenario.years.at(-1).closingBalance)}.`
  );
}

function update() {
  const data = readInputs();
  const months = data.termYears * 12;
  const standard = simulateScenario({
    principal: data.loanAmount,
    months,
    annualRate: data.standardTin,
    firstMonthRate: data.bonusTin,
    useFirstMonthRate: data.firstMonthBonus,
    annualCosts: data.standardAnnualCosts,
    upfrontCosts: data.upfrontCosts
  });
  const bonus = simulateScenario({
    principal: data.loanAmount,
    months,
    annualRate: data.bonusTin,
    firstMonthRate: data.bonusTin,
    useFirstMonthRate: false,
    annualCosts: data.bonusAnnualCosts,
    upfrontCosts: data.upfrontCosts
  });

  state.scenarios = { standard, bonus };
  updateFinancingSummary(data);
  renderScenarioCards(data, standard, bonus);
  renderTable(elements.tableScenario.value);
  drawChart();
}

function resetForm() {
  Object.entries(defaults).forEach(([key, value]) => {
    const input = document.querySelector(`#${key}`);
    if (!input) return;
    if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  });
  update();
}

if (typeof document !== "undefined") {
  elements.form.addEventListener("input", update);
  elements.form.addEventListener("change", update);
  elements.reset.addEventListener("click", resetForm);
  elements.tableScenario.addEventListener("change", event => renderTable(event.target.value));
  elements.chartToggles.forEach(button => {
    button.addEventListener("click", () => {
      state.chartScenario = button.dataset.scenario;
      elements.chartToggles.forEach(toggle => {
        const active = toggle === button;
        toggle.classList.toggle("active", active);
        toggle.setAttribute("aria-pressed", String(active));
      });
      drawChart();
    });
  });

  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawChart);
  });

  update();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { annuityPayment, calculateTae, simulateScenario };
}
