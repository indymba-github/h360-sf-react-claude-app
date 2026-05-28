'use client'

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
};

export default function MortgageInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min = 0,
  max,
  decimals = 0,
}: Props) {
  return (
    <div className="mortgage-input">
      <label className="input-label">{label}</label>
      <div className="input-wrap">
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type="number"
          value={value.toFixed(decimals)}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          className="input-field"
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>

      <style jsx>{`
        .mortgage-input {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-label {
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-ink-soft);
        }

        .input-wrap {
          display: flex;
          align-items: center;
          background: var(--color-paper);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 0 10px;
          transition: border-color 0.15s;
        }

        .input-wrap:focus-within {
          border-color: var(--color-accent);
        }

        .input-prefix,
        .input-suffix {
          color: var(--color-ink-soft);
          font-size: 14px;
          user-select: none;
        }

        .input-prefix {
          margin-right: 4px;
        }

        .input-suffix {
          margin-left: 4px;
        }

        .input-field {
          background: transparent;
          border: none;
          outline: none;
          padding: 8px 0;
          font-size: 14px;
          color: var(--color-ink);
          width: 100%;
          font-family: var(--font-body);
        }

        .input-field::-webkit-outer-spin-button,
        .input-field::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .input-field[type='number'] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
