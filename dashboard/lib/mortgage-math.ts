export type MortgageInputs = {
  homePrice: number;
  downPaymentAmount: number;
  interestRate: number;        // annual %, e.g. 7.0 not 0.07
  loanTermYears: number;
  annualPropertyTax: number;
  annualHomeInsurance: number;
  monthlyHOA: number;
  pmiOverride?: number | null; // monthly $; if null, computed
};

export type MortgageOutputs = {
  loanAmount: number;
  downPaymentPercent: number;
  monthlyPrincipalAndInterest: number;
  monthlyPropertyTax: number;
  monthlyHomeInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  totalMonthlyPayment: number;
  totalInterestPaid: number;
  totalCost: number;
  payoffDate: string;
  pmiApplies: boolean;
};

/**
 * M = P [ r(1+r)^n ] / [ (1+r)^n - 1 ]
 */
export function computeMonthlyPI(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal <= 0 || termYears <= 0) return 0;
  if (annualRate === 0) return principal / (termYears * 12);

  const monthlyRate = annualRate / 100 / 12;
  const n = termYears * 12;
  const factor = Math.pow(1 + monthlyRate, n);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * PMI required when down payment < 20%. Default rate: 0.55% annually.
 */
export function computePMI(
  loanAmount: number,
  downPaymentPercent: number
): { applies: boolean; monthly: number } {
  if (downPaymentPercent >= 20) return { applies: false, monthly: 0 };
  return { applies: true, monthly: (loanAmount * 0.0055) / 12 };
}

export function calculateMortgage(inputs: MortgageInputs): MortgageOutputs {
  const loanAmount = Math.max(0, inputs.homePrice - inputs.downPaymentAmount);
  const downPaymentPercent =
    inputs.homePrice > 0
      ? (inputs.downPaymentAmount / inputs.homePrice) * 100
      : 0;

  const monthlyPI = computeMonthlyPI(
    loanAmount,
    inputs.interestRate,
    inputs.loanTermYears
  );

  const pmiData = computePMI(loanAmount, downPaymentPercent);
  const monthlyPMI =
    inputs.pmiOverride !== undefined && inputs.pmiOverride !== null
      ? inputs.pmiOverride
      : pmiData.monthly;

  const monthlyPropertyTax = inputs.annualPropertyTax / 12;
  const monthlyHomeInsurance = inputs.annualHomeInsurance / 12;

  const totalMonthlyPayment =
    monthlyPI +
    monthlyPropertyTax +
    monthlyHomeInsurance +
    monthlyPMI +
    inputs.monthlyHOA;

  const totalPayments = monthlyPI * inputs.loanTermYears * 12;
  const totalInterestPaid = totalPayments - loanAmount;

  const totalCost =
    totalPayments +
    inputs.annualPropertyTax * inputs.loanTermYears +
    inputs.annualHomeInsurance * inputs.loanTermYears +
    monthlyPMI * 12 * inputs.loanTermYears +
    inputs.monthlyHOA * 12 * inputs.loanTermYears;

  const payoffDate = new Date();
  payoffDate.setFullYear(payoffDate.getFullYear() + inputs.loanTermYears);
  const payoffDateStr = payoffDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return {
    loanAmount,
    downPaymentPercent,
    monthlyPrincipalAndInterest: monthlyPI,
    monthlyPropertyTax,
    monthlyHomeInsurance,
    monthlyPMI,
    monthlyHOA: inputs.monthlyHOA,
    totalMonthlyPayment,
    totalInterestPaid,
    totalCost,
    payoffDate: payoffDateStr,
    pmiApplies: pmiData.applies,
  };
}

export function formatCurrency(amount: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
