'use client'

import { useState } from 'react'
import MortgageInput from './MortgageInput'
import MortgageBreakdown from './MortgageBreakdown'
import AskAIButton from '../risk/AskAIButton'
import { calculateMortgage, type MortgageInputs, formatCurrency } from '@/lib/mortgage-math'

type Props = {
  homePrice?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  loanTermYears?: number;
  annualPropertyTax?: number;
  annualHomeInsurance?: number;
  monthlyHOA?: number;
  accountId?: string;
};

const DEFAULTS = {
  homePrice: 500000,
  downPaymentAmount: 100000,
  interestRate: 7.0,
  loanTermYears: 30,
  annualPropertyTax: 6000,
  annualHomeInsurance: 1800,
  monthlyHOA: 0,
};

function resolveInitialInputs(props: Props): MortgageInputs {
  const homePrice = props.homePrice ?? DEFAULTS.homePrice;
  let downPaymentAmount: number;
  if (props.downPaymentAmount !== undefined) {
    downPaymentAmount = props.downPaymentAmount;
  } else if (props.downPaymentPercent !== undefined) {
    downPaymentAmount = (props.downPaymentPercent / 100) * homePrice;
  } else {
    downPaymentAmount = DEFAULTS.downPaymentAmount;
  }
  return {
    homePrice,
    downPaymentAmount,
    interestRate: props.interestRate ?? DEFAULTS.interestRate,
    loanTermYears: props.loanTermYears ?? DEFAULTS.loanTermYears,
    annualPropertyTax: props.annualPropertyTax ?? DEFAULTS.annualPropertyTax,
    annualHomeInsurance: props.annualHomeInsurance ?? DEFAULTS.annualHomeInsurance,
    monthlyHOA: props.monthlyHOA ?? DEFAULTS.monthlyHOA,
    pmiOverride: null,
  };
}

export default function MortgageCalculator(props: Props) {
  const [inputs, setInputs] = useState<MortgageInputs>(() => resolveInitialInputs(props));

  const outputs = calculateMortgage(inputs);
  const downPaymentPercent =
    inputs.homePrice > 0 ? (inputs.downPaymentAmount / inputs.homePrice) * 100 : 0;

  function setHomePrice(price: number) {
    setInputs((prev) => ({ ...prev, homePrice: price }));
  }

  function setDownPaymentAmount(amount: number) {
    setInputs((prev) => ({ ...prev, downPaymentAmount: amount }));
  }

  function setDownPaymentPercent(pct: number) {
    setInputs((prev) => ({ ...prev, downPaymentAmount: (pct / 100) * prev.homePrice }));
  }

  function askAboutCalculator(question: string) {
    const context =
      `[Calculator state: ` +
      `home price ${formatCurrency(inputs.homePrice)}, ` +
      `down payment ${formatCurrency(inputs.downPaymentAmount)} ` +
      `(${downPaymentPercent.toFixed(1)}%), ` +
      `rate ${inputs.interestRate}%, ` +
      `term ${inputs.loanTermYears} years, ` +
      `monthly payment ${formatCurrency(outputs.totalMonthlyPayment)}]`;
    window.dispatchEvent(
      new CustomEvent('chat:ask', {
        detail: { question: `${question}\n\n${context}`, accountId: props.accountId },
      })
    );
  }

  function createOpportunity() {
    if (!props.accountId) return;
    const message =
      `I'd like to create an opportunity from this mortgage scenario. ` +
      `Please propose the opportunity details and ask me to confirm before creating it.\n\n` +
      `[Mortgage scenario: ` +
      `home price ${formatCurrency(inputs.homePrice)}, ` +
      `loan amount ${formatCurrency(outputs.loanAmount)}, ` +
      `down payment ${formatCurrency(inputs.downPaymentAmount)} ` +
      `(${downPaymentPercent.toFixed(1)}%), ` +
      `rate ${inputs.interestRate}%, ` +
      `term ${inputs.loanTermYears} years, ` +
      `monthly payment ${formatCurrency(outputs.totalMonthlyPayment)}, ` +
      `accountId ${props.accountId}]`;
    window.dispatchEvent(
      new CustomEvent('chat:ask', {
        detail: { question: message, accountId: props.accountId },
      })
    );
  }

  return (
    <div className="mortgage-calc">
      <div className="calc-header">
        <div className="calc-eyebrow">MORTGAGE CALCULATOR</div>
        <h2 className="calc-title">Payment Estimator</h2>
      </div>

      <div className="calc-inputs">
        <MortgageInput
          label="Home Price"
          value={inputs.homePrice}
          onChange={setHomePrice}
          prefix="$"
          step={1000}
          min={0}
        />

        <div className="dp-row">
          <MortgageInput
            label="Down Payment"
            value={inputs.downPaymentAmount}
            onChange={setDownPaymentAmount}
            prefix="$"
            step={1000}
            min={0}
            max={inputs.homePrice}
          />
          <MortgageInput
            label="Down Payment %"
            value={downPaymentPercent}
            onChange={setDownPaymentPercent}
            suffix="%"
            step={0.5}
            min={0}
            max={100}
            decimals={1}
          />
        </div>

        <div className="rate-term-row">
          <MortgageInput
            label="Interest Rate"
            value={inputs.interestRate}
            onChange={(v) => setInputs((prev) => ({ ...prev, interestRate: v }))}
            suffix="%"
            step={0.125}
            min={0}
            max={20}
            decimals={3}
          />
          <MortgageInput
            label="Loan Term"
            value={inputs.loanTermYears}
            onChange={(v) => setInputs((prev) => ({ ...prev, loanTermYears: v }))}
            suffix=" yrs"
            step={1}
            min={1}
            max={50}
          />
        </div>

        <div className="rate-term-row">
          <MortgageInput
            label="Annual Property Tax"
            value={inputs.annualPropertyTax}
            onChange={(v) => setInputs((prev) => ({ ...prev, annualPropertyTax: v }))}
            prefix="$"
            step={100}
            min={0}
          />
          <MortgageInput
            label="Annual Home Insurance"
            value={inputs.annualHomeInsurance}
            onChange={(v) => setInputs((prev) => ({ ...prev, annualHomeInsurance: v }))}
            prefix="$"
            step={50}
            min={0}
          />
        </div>

        <MortgageInput
          label="Monthly HOA"
          value={inputs.monthlyHOA}
          onChange={(v) => setInputs((prev) => ({ ...prev, monthlyHOA: v }))}
          prefix="$"
          step={25}
          min={0}
        />
      </div>

      <MortgageBreakdown outputs={outputs} />

      <div className="calc-action">
        {props.accountId && (
          <button
            type="button"
            className="create-opp-button"
            onClick={createOpportunity}
          >
            Create Opportunity
          </button>
        )}
        <AskAIButton
          question="Tell me about this mortgage scenario."
          onAsk={askAboutCalculator}
        />
      </div>

      <style jsx>{`
        .mortgage-calc {
          font-family: var(--font-body);
          color: var(--color-ink);
        }

        .calc-header {
          margin-bottom: 24px;
        }

        .calc-eyebrow {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1.5px;
          color: var(--color-ink-soft);
          margin-bottom: 4px;
        }

        .calc-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .calc-inputs {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 20px;
          padding: 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
        }

        .dp-row,
        .rate-term-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .calc-action {
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          align-items: center;
        }

        .create-opp-button {
          display: inline-flex;
          align-items: center;
          background: var(--color-accent);
          color: var(--color-accent-foreground);
          border: 1px solid var(--color-accent);
          border-radius: 6px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
          font-family: var(--font-body);
        }

        .create-opp-button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
