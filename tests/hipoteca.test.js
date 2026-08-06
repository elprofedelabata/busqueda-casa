const assert = require("node:assert/strict");
const {
  annuityPayment,
  simulateScenario
} = require("../docs/hipoteca.js");

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: se esperaba ${expected}, se obtuvo ${actual}`
  );
};

const principal = 200000;
const months = 25 * 12;
const bonusTin = 0.0295;
const standardTin = 0.0395;

closeTo(
  annuityPayment(principal, bonusTin, months),
  943.229607,
  0.0001,
  "Cuota bonificada"
);

const standard = simulateScenario({
  principal,
  months,
  annualRate: standardTin,
  firstMonthRate: bonusTin,
  useFirstMonthRate: true,
  annualCosts: 560,
  upfrontCosts: 400
});

const bonus = simulateScenario({
  principal,
  months,
  annualRate: bonusTin,
  firstMonthRate: bonusTin,
  useFirstMonthRate: false,
  annualCosts: 840,
  upfrontCosts: 400
});

closeTo(standard.firstPayment, 943.229607, 0.0001, "Primer mes promocional");
closeTo(standard.regularPayment, 1049.845690, 0.0001, "Cuota sin bonificación desde el mes 2");
closeTo(standard.totalInterest, 114847.090817, 0.01, "Intereses sin bonificación");
closeTo(bonus.totalInterest, 82968.882175, 0.01, "Intereses con bonificación");
closeTo(standard.tae, 0.044691, 0.00002, "TAE estimada sin bonificación");
closeTo(bonus.tae, 0.036914, 0.00002, "TAE estimada con bonificación");
closeTo(standard.records.at(-1).closingBalance, 0, 0.01, "Saldo final sin bonificación");
closeTo(bonus.records.at(-1).closingBalance, 0, 0.01, "Saldo final con bonificación");

assert.equal(standard.records.length, 300);
assert.equal(bonus.years.length, 25);

console.log("Cálculos hipotecarios verificados.");
