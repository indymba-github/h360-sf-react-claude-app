/**
 * Types matching the FSC Core data model.
 * FSC on Core (standard objects) — no FinServ__ namespace.
 */

export type FinancialAccountRole = "Owner" | "Beneficiary" | string;

export type FinancialAccountType =
  | "Checking"
  | "Savings"
  | "Investment Account"
  | "Loan"
  | "Automotive Loan"
  | string;

export type FinancialAccount = {
  Id: string;
  Name: string;
  FinancialAccountNumber: string | null;
  Type: FinancialAccountType | null;
  Status: string | null;
  OpeningDate: string | null;
  ClosingDate: string | null;
  MaturityDate: string | null;
  RenewalDate: string | null;
  PaymentDueDate: string | null;
  PrincipalAmount: number | null;
  TotalOutstandingAmount: number | null;
  AmountDue: number | null;
  InterestRate: number | null;
  InterestType: string | null;
  DownPaymentAmount: number | null;
  Term: number | null;
  CreditLimit: number | null;
  PrincipalPaidYearToDate: number | null;
  InterestPaidYearToDate: number | null;
  IsOverdraftAllowed: boolean;
  IsManaged: boolean;
  BankerId: string | null;
  BranchUnitId: string | null;
  ProductId: string | null;
  CurrencyIsoCode: string;
};

export type FinancialAccountParty = {
  Id: string;
  FinancialAccountId: string;
  AccountId: string | null;
  ContactId: string | null;
  Role: FinancialAccountRole;
  RoleStartDate: string | null;
  RoleEndDate: string | null;
  IsRoleActive: boolean;
};

export type FinancialAccountBalance = {
  Id: string;
  Name: string | null;
  FinancialAccountId: string;
  Amount: number | null;
  Type: string | null;
  BalanceAsOfDate: string | null;
  CurrencyIsoCode: string | null;
  SystemModstamp: string | null;
};

export type FinancialAccountWithRole = FinancialAccount & {
  Role: FinancialAccountRole;
  PartyId: string;
  CurrentBalance: number | null;
  BalanceAsOfDate: string | null;
};

export type FinancialAccountTransaction = {
  Id: string;
  Name: string | null;
  FinancialAccountId: string;
  Amount: number | null;
  DebitCreditIndicator: "Debit" | "Credit" | string | null;
  TransactionDate: string | null;
  PostedDate: string | null;
  Description: string | null;
  TransactionCode: string | null;
  Type: string | null;
  SubType: string | null;
  Status: string | null;
};

export type FinancialAccountCategory =
  | "Deposit"
  | "Investment"
  | "Lending"
  | "Credit"
  | "Other";

export function categorizeFinancialAccount(
  type: string | null
): FinancialAccountCategory {
  if (!type) return "Other";
  if (type === "Checking" || type === "Savings") return "Deposit";
  if (type === "Investment Account") return "Investment";
  if (
    type === "Loan" ||
    type === "Automotive Loan" ||
    type === "Mortgage" ||
    type.toLowerCase().includes("loan")
  )
    return "Lending";
  if (type === "Credit Card" || type.toLowerCase().includes("credit"))
    return "Credit";
  return "Other";
}

export const CATEGORY_ORDER: FinancialAccountCategory[] = [
  "Deposit",
  "Lending",
  "Credit",
  "Investment",
  "Other",
];

export const CATEGORY_LABELS: Record<FinancialAccountCategory, string> = {
  Deposit: "Deposit Accounts",
  Lending: "Loans & Mortgages",
  Credit: "Credit Cards",
  Investment: "Investment Accounts",
  Other: "Other Accounts",
};
