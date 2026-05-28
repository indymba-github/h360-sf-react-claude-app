'use client'

import { MortgageOutputs, formatCurrency } from '@/lib/mortgage-math'

type Props = {
  outputs: MortgageOutputs;
};

export default function MortgageBreakdown({ outputs }: Props) {
  const items: { label: string; amount: number }[] = [
    { label: 'Principal & Interest', amount: outputs.monthlyPrincipalAndInterest },
    { label: 'Property Tax', amount: outputs.monthlyPropertyTax },
    { label: 'Home Insurance', amount: outputs.monthlyHomeInsurance },
  ];

  if (outputs.pmiApplies && outputs.monthlyPMI > 0) {
    items.push({ label: 'PMI', amount: outputs.monthlyPMI });
  }

  if (outputs.monthlyHOA > 0) {
    items.push({ label: 'HOA', amount: outputs.monthlyHOA });
  }

  return (
    <div className="breakdown">
      <div className="total-section">
        <div className="total-label">Total Monthly Payment</div>
        <div className="total-amount">
          {formatCurrency(outputs.totalMonthlyPayment)}
        </div>
      </div>

      <div className="breakdown-items">
        {items.map((item, i) => (
          <div key={i} className="breakdown-row">
            <span className="row-label">{item.label}</span>
            <span className="row-amount">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>

      <div className="summary-section">
        <div className="summary-row">
          <span className="summary-label">Loan Amount</span>
          <span className="summary-value">{formatCurrency(outputs.loanAmount)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Down Payment</span>
          <span className="summary-value">{outputs.downPaymentPercent.toFixed(1)}%</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Total Interest</span>
          <span className="summary-value">{formatCurrency(outputs.totalInterestPaid)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Total Cost</span>
          <span className="summary-value">{formatCurrency(outputs.totalCost)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Payoff Date</span>
          <span className="summary-value">{outputs.payoffDate}</span>
        </div>
      </div>

      <style jsx>{`
        .breakdown {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .total-section {
          background: var(--color-accent);
          color: var(--color-accent-foreground);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }

        .total-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.85;
          margin-bottom: 4px;
        }

        .total-amount {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 600;
        }

        .breakdown-items {
          display: flex;
          flex-direction: column;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 8px 16px;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
        }

        .breakdown-row:last-child {
          border-bottom: none;
        }

        .row-label {
          color: var(--color-ink-muted);
        }

        .row-amount {
          color: var(--color-ink);
          font-weight: 500;
        }

        .summary-section {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 12px 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12px;
        }

        .summary-label {
          color: var(--color-ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          color: var(--color-ink);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
