// Layer 3 — Seed Financial Accounts, Parties (junction), and Balances
// Three layers in one transaction to keep relationships intact

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

// Skip if Financial Accounts already exist for this seed run
List<FinancialAccount> existing = [SELECT Id FROM FinancialAccount WHERE External_Id__c LIKE 'SEED_2026_06_FA_%' LIMIT 1];
if (!existing.isEmpty()) {
    System.debug('Financial accounts already seeded. Skipping. Delete existing SEED_2026_06_FA_* records to re-run.');
    return;
}

// Define FA bundles per Account
// Format: accExtId, faExtId, name, type, status, balance, openingDate, interestRate
List<List<Object>> faBundles = new List<List<Object>>{
    // Patterson — retail family
    new List<Object>{'SEED_2026_06_ACC_PATTERSON', 'PATTERSON_CHK', 'Patterson Family Checking', 'Checking', 'Active', 14200.00, Date.newInstance(2018, 4, 12), 0.01},
    new List<Object>{'SEED_2026_06_ACC_PATTERSON', 'PATTERSON_SAV', 'Patterson Family Savings', 'Savings', 'Active', 45800.00, Date.newInstance(2018, 4, 12), 4.25},
    new List<Object>{'SEED_2026_06_ACC_PATTERSON', 'PATTERSON_MTG', 'Patterson Mortgage', 'Loan', 'Active', -342000.00, Date.newInstance(2020, 7, 18), 3.875},
    new List<Object>{'SEED_2026_06_ACC_PATTERSON', 'PATTERSON_529', 'Patterson 529 Plan', 'Investment Account', 'Active', 28400.00, Date.newInstance(2019, 8, 1), null},

    // Nguyen
    new List<Object>{'SEED_2026_06_ACC_NGUYEN', 'NGUYEN_CHK', 'Nguyen Personal Checking', 'Checking', 'Active', 8900.00, Date.newInstance(2017, 2, 8), 0.01},
    new List<Object>{'SEED_2026_06_ACC_NGUYEN', 'NGUYEN_SAV', 'Nguyen Family Savings', 'Savings', 'Active', 22300.00, Date.newInstance(2017, 2, 8), 4.25},
    new List<Object>{'SEED_2026_06_ACC_NGUYEN', 'NGUYEN_BIZ', 'Nguyen Small Business Operating', 'Checking', 'Active', 42100.00, Date.newInstance(2019, 5, 15), 0.01},
    new List<Object>{'SEED_2026_06_ACC_NGUYEN', 'NGUYEN_AUTO', 'Nguyen Auto Loan', 'Automotive Loan', 'Active', -18400.00, Date.newInstance(2024, 3, 12), 6.49},

    // Reyes — DINK
    new List<Object>{'SEED_2026_06_ACC_REYES', 'REYES_CHK', 'Reyes Joint Checking', 'Checking', 'Active', 28500.00, Date.newInstance(2020, 9, 4), 0.01},
    new List<Object>{'SEED_2026_06_ACC_REYES', 'REYES_HYS', 'Reyes High-Yield Savings', 'Savings', 'Active', 78000.00, Date.newInstance(2021, 1, 20), 4.85},
    new List<Object>{'SEED_2026_06_ACC_REYES', 'REYES_INV', 'Reyes Brokerage', 'Investment Account', 'Active', 145000.00, Date.newInstance(2021, 6, 8), null},

    // Okonkwo
    new List<Object>{'SEED_2026_06_ACC_OKONKWO', 'OKONKWO_CHK', 'Okonkwo Family Checking', 'Checking', 'Active', 18900.00, Date.newInstance(2022, 3, 14), 0.01},
    new List<Object>{'SEED_2026_06_ACC_OKONKWO', 'OKONKWO_SAV', 'Okonkwo Family Savings', 'Savings', 'Active', 55000.00, Date.newInstance(2022, 3, 14), 4.25},
    new List<Object>{'SEED_2026_06_ACC_OKONKWO', 'OKONKWO_MTG', 'Okonkwo Mortgage', 'Loan', 'Active', -425000.00, Date.newInstance(2023, 11, 8), 6.875},

    // Lin
    new List<Object>{'SEED_2026_06_ACC_LIN', 'LIN_CHK', 'Lin Family Checking', 'Checking', 'Active', 12400.00, Date.newInstance(2015, 6, 22), 0.01},
    new List<Object>{'SEED_2026_06_ACC_LIN', 'LIN_SAV', 'Lin Family Savings', 'Savings', 'Active', 95000.00, Date.newInstance(2015, 6, 22), 4.25},
    new List<Object>{'SEED_2026_06_ACC_LIN', 'LIN_529_1', 'Lin 529 - Child 1', 'Investment Account', 'Active', 52000.00, Date.newInstance(2008, 5, 1), null},
    new List<Object>{'SEED_2026_06_ACC_LIN', 'LIN_529_2', 'Lin 529 - Child 2', 'Investment Account', 'Active', 38000.00, Date.newInstance(2011, 3, 15), null},
    new List<Object>{'SEED_2026_06_ACC_LIN', 'LIN_MTG', 'Lin Mortgage', 'Loan', 'Active', -212000.00, Date.newInstance(2016, 4, 10), 3.25},

    // Henderson — mass-affluent
    new List<Object>{'SEED_2026_06_ACC_HENDERSON', 'HENDERSON_CHK', 'Henderson Premier Checking', 'Checking', 'Active', 45200.00, Date.newInstance(2005, 4, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_HENDERSON', 'HENDERSON_TRUST', 'Henderson Family Trust', 'Investment Account', 'Active', 1850000.00, Date.newInstance(2010, 8, 15), null},
    new List<Object>{'SEED_2026_06_ACC_HENDERSON', 'HENDERSON_BROKER', 'Henderson Joint Brokerage', 'Investment Account', 'Active', 425000.00, Date.newInstance(2008, 3, 20), null},
    new List<Object>{'SEED_2026_06_ACC_HENDERSON', 'HENDERSON_IRA_R', 'Robert Henderson Rollover IRA', 'Investment Account', 'Active', 685000.00, Date.newInstance(2012, 1, 8), null},
    new List<Object>{'SEED_2026_06_ACC_HENDERSON', 'HENDERSON_IRA_M', 'Margaret Henderson IRA', 'Investment Account', 'Active', 320000.00, Date.newInstance(2010, 6, 12), null},

    // Velazquez
    new List<Object>{'SEED_2026_06_ACC_VELAZQUEZ', 'VELAZQUEZ_CHK', 'Velazquez Premier Checking', 'Checking', 'Active', 88000.00, Date.newInstance(2014, 8, 22), 0.05},
    new List<Object>{'SEED_2026_06_ACC_VELAZQUEZ', 'VELAZQUEZ_INV', 'Velazquez Brokerage', 'Investment Account', 'Active', 720000.00, Date.newInstance(2015, 3, 8), null},
    new List<Object>{'SEED_2026_06_ACC_VELAZQUEZ', 'VELAZQUEZ_MTG', 'Velazquez Mortgage', 'Loan', 'Active', -1100000.00, Date.newInstance(2018, 6, 4), 4.125},
    new List<Object>{'SEED_2026_06_ACC_VELAZQUEZ', 'VELAZQUEZ_IRA_E', 'Elena Velazquez 401k Rollover', 'Investment Account', 'Active', 425000.00, Date.newInstance(2019, 11, 12), null},
    new List<Object>{'SEED_2026_06_ACC_VELAZQUEZ', 'VELAZQUEZ_IRA_M', 'Marcus Velazquez SEP IRA', 'Investment Account', 'Active', 280000.00, Date.newInstance(2017, 5, 1), null},

    // Chen — retiree
    new List<Object>{'SEED_2026_06_ACC_CHEN', 'CHEN_CHK', 'Chen Retirement Checking', 'Checking', 'Active', 22000.00, Date.newInstance(2001, 4, 18), 0.05},
    new List<Object>{'SEED_2026_06_ACC_CHEN', 'CHEN_HYS', 'Chen High-Yield Savings', 'Savings', 'Active', 250000.00, Date.newInstance(2018, 11, 1), 4.85},
    new List<Object>{'SEED_2026_06_ACC_CHEN', 'CHEN_IRA', 'Chen Retirement IRA', 'Investment Account', 'Active', 1450000.00, Date.newInstance(2002, 6, 15), null},
    new List<Object>{'SEED_2026_06_ACC_CHEN', 'CHEN_TRUST', 'Chen Living Trust', 'Investment Account', 'Active', 380000.00, Date.newInstance(2021, 5, 12), null},

    // Brennan
    new List<Object>{'SEED_2026_06_ACC_BRENNAN', 'BRENNAN_CHK', 'Brennan Joint Checking', 'Checking', 'Active', 35000.00, Date.newInstance(2017, 9, 4), 0.05},
    new List<Object>{'SEED_2026_06_ACC_BRENNAN', 'BRENNAN_INHERITED', 'Brennan Inherited Investment', 'Investment Account', 'Active', 875000.00, Date.newInstance(2025, 12, 8), null},
    new List<Object>{'SEED_2026_06_ACC_BRENNAN', 'BRENNAN_MTG', 'Brennan Mortgage', 'Loan', 'Active', -650000.00, Date.newInstance(2019, 7, 22), 3.875},

    // Kapoor — wealth tier
    new List<Object>{'SEED_2026_06_ACC_KAPOOR', 'KAPOOR_PREMIER', 'Kapoor Premier Account', 'Checking', 'Active', 480000.00, Date.newInstance(2020, 4, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_KAPOOR', 'KAPOOR_TRUST', 'Kapoor Family Trust', 'Investment Account', 'Active', 8500000.00, Date.newInstance(2020, 8, 12), null},
    new List<Object>{'SEED_2026_06_ACC_KAPOOR', 'KAPOOR_BROKER', 'Kapoor Joint Brokerage', 'Investment Account', 'Active', 3200000.00, Date.newInstance(2020, 8, 12), null},
    new List<Object>{'SEED_2026_06_ACC_KAPOOR', 'KAPOOR_FOUNDATION', 'Kapoor Foundation Account', 'Checking', 'Active', 250000.00, Date.newInstance(2022, 1, 18), 0.05},

    // Sutherland — old money
    new List<Object>{'SEED_2026_06_ACC_SUTHERLAND', 'SUTHERLAND_TRUST', 'Sutherland Family Trust', 'Investment Account', 'Active', 6200000.00, Date.newInstance(1995, 10, 1), null},
    new List<Object>{'SEED_2026_06_ACC_SUTHERLAND', 'SUTHERLAND_CHK', 'Sutherland Premier Checking', 'Checking', 'Active', 145000.00, Date.newInstance(1995, 10, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_SUTHERLAND', 'SUTHERLAND_BROKER', 'Sutherland Brokerage', 'Investment Account', 'Active', 1850000.00, Date.newInstance(2005, 3, 12), null},

    // Asante
    new List<Object>{'SEED_2026_06_ACC_ASANTE', 'ASANTE_CHK', 'Asante Premier Checking', 'Checking', 'Active', 95000.00, Date.newInstance(2010, 5, 4), 0.05},
    new List<Object>{'SEED_2026_06_ACC_ASANTE', 'ASANTE_INV', 'Asante Brokerage', 'Investment Account', 'Active', 1450000.00, Date.newInstance(2011, 8, 18), null},
    new List<Object>{'SEED_2026_06_ACC_ASANTE', 'ASANTE_PRACTICE', 'Asante Practice Operating', 'Checking', 'Active', 285000.00, Date.newInstance(2015, 6, 1), 0.05},

    // Mendez — young couple
    new List<Object>{'SEED_2026_06_ACC_MENDEZ', 'MENDEZ_CHK', 'Mendez Joint Checking', 'Checking', 'Active', 6200.00, Date.newInstance(2022, 11, 14), 0.01},
    new List<Object>{'SEED_2026_06_ACC_MENDEZ', 'MENDEZ_SAV', 'Mendez Down Payment Savings', 'Savings', 'Active', 35000.00, Date.newInstance(2022, 11, 14), 4.85},

    // Walsh
    new List<Object>{'SEED_2026_06_ACC_WALSH', 'WALSH_CHK', 'Walsh Family Checking', 'Checking', 'Active', 8400.00, Date.newInstance(1998, 7, 12), 0.01},
    new List<Object>{'SEED_2026_06_ACC_WALSH', 'WALSH_SAV', 'Walsh Family Savings', 'Savings', 'Active', 42000.00, Date.newInstance(1998, 7, 12), 4.25},
    new List<Object>{'SEED_2026_06_ACC_WALSH', 'WALSH_IRA', 'Walsh Retirement IRA', 'Investment Account', 'Active', 285000.00, Date.newInstance(2005, 3, 4), null},

    // Singh
    new List<Object>{'SEED_2026_06_ACC_SINGH', 'SINGH_CHK', 'Singh Premier Checking', 'Checking', 'Active', 65000.00, Date.newInstance(2018, 9, 22), 0.05},
    new List<Object>{'SEED_2026_06_ACC_SINGH', 'SINGH_BROKER', 'Singh Brokerage', 'Investment Account', 'Active', 1250000.00, Date.newInstance(2019, 4, 15), null},
    new List<Object>{'SEED_2026_06_ACC_SINGH', 'SINGH_MTG', 'Singh Mortgage', 'Loan', 'Active', -780000.00, Date.newInstance(2020, 8, 4), 3.25},

    // Lakeshore Coffee — small business
    new List<Object>{'SEED_2026_06_ACC_LAKESHORE', 'LAKESHORE_OP', 'Lakeshore Operating Account', 'Checking', 'Active', 245000.00, Date.newInstance(2018, 6, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_LAKESHORE', 'LAKESHORE_LOC', 'Lakeshore Line of Credit', 'Loan', 'Active', -85000.00, Date.newInstance(2022, 4, 18), 8.5},
    new List<Object>{'SEED_2026_06_ACC_LAKESHORE', 'LAKESHORE_TERM', 'Lakeshore Equipment Term Loan', 'Loan', 'Active', -120000.00, Date.newInstance(2023, 9, 12), 7.25},

    // Prairie Engineering
    new List<Object>{'SEED_2026_06_ACC_PRAIRIE', 'PRAIRIE_OP', 'Prairie Operating Account', 'Checking', 'Active', 1850000.00, Date.newInstance(2008, 5, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_PRAIRIE', 'PRAIRIE_PAYROLL', 'Prairie Payroll Account', 'Checking', 'Active', 425000.00, Date.newInstance(2008, 5, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_PRAIRIE', 'PRAIRIE_LOC', 'Prairie Revolving Credit Facility', 'Loan', 'Active', -1200000.00, Date.newInstance(2021, 3, 4), 7.85},
    new List<Object>{'SEED_2026_06_ACC_PRAIRIE', 'PRAIRIE_TERM', 'Prairie Acquisition Term Loan', 'Loan', 'Active', -2800000.00, Date.newInstance(2024, 1, 18), 6.5},

    // Northshore Dental
    new List<Object>{'SEED_2026_06_ACC_NORTHSHORE', 'NORTHSHORE_OP', 'Northshore Operating', 'Checking', 'Active', 685000.00, Date.newInstance(2012, 8, 4), 0.05},
    new List<Object>{'SEED_2026_06_ACC_NORTHSHORE', 'NORTHSHORE_LOC', 'Northshore Line of Credit', 'Loan', 'Active', -250000.00, Date.newInstance(2023, 2, 14), 8.25},

    // Greentech Solar
    new List<Object>{'SEED_2026_06_ACC_GREENTECH', 'GREENTECH_OP', 'Greentech Operating', 'Checking', 'Active', 2400000.00, Date.newInstance(2020, 11, 18), 0.05},
    new List<Object>{'SEED_2026_06_ACC_GREENTECH', 'GREENTECH_LOC', 'Greentech Working Capital Line', 'Loan', 'Active', -1850000.00, Date.newInstance(2023, 4, 8), 7.5},
    new List<Object>{'SEED_2026_06_ACC_GREENTECH', 'GREENTECH_TERM', 'Greentech Growth Capital Loan', 'Loan', 'Active', -3500000.00, Date.newInstance(2024, 6, 22), 6.75},

    // Midwest Logistics
    new List<Object>{'SEED_2026_06_ACC_MIDWEST', 'MIDWEST_OP', 'Midwest Operating', 'Checking', 'Active', 4250000.00, Date.newInstance(2003, 3, 12), 0.05},
    new List<Object>{'SEED_2026_06_ACC_MIDWEST', 'MIDWEST_PAYROLL', 'Midwest Payroll', 'Checking', 'Active', 950000.00, Date.newInstance(2003, 3, 12), 0.05},
    new List<Object>{'SEED_2026_06_ACC_MIDWEST', 'MIDWEST_LOC', 'Midwest Master Credit Facility', 'Loan', 'Active', -5800000.00, Date.newInstance(2022, 8, 4), 7.25},
    new List<Object>{'SEED_2026_06_ACC_MIDWEST', 'MIDWEST_FLEET', 'Midwest Fleet Financing', 'Loan', 'Active', -8500000.00, Date.newInstance(2023, 11, 18), 6.5},

    // Sterling Manufacturing
    new List<Object>{'SEED_2026_06_ACC_STERLING', 'STERLING_OP', 'Sterling Operating', 'Checking', 'Active', 5800000.00, Date.newInstance(2001, 6, 8), 0.05},
    new List<Object>{'SEED_2026_06_ACC_STERLING', 'STERLING_LOC', 'Sterling Master Line', 'Loan', 'Active', -12500000.00, Date.newInstance(2020, 4, 15), 6.85},
    new List<Object>{'SEED_2026_06_ACC_STERLING', 'STERLING_TERM', 'Sterling Equipment Term Loan', 'Loan', 'Active', -7200000.00, Date.newInstance(2023, 9, 4), 6.5},

    // Riverview Properties
    new List<Object>{'SEED_2026_06_ACC_RIVERVIEW', 'RIVERVIEW_OP', 'Riverview Operating', 'Checking', 'Active', 1450000.00, Date.newInstance(2015, 4, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_RIVERVIEW', 'RIVERVIEW_CRE_1', 'Riverview Tower Project Loan', 'Loan', 'Active', -18500000.00, Date.newInstance(2023, 7, 12), 7.25},
    new List<Object>{'SEED_2026_06_ACC_RIVERVIEW', 'RIVERVIEW_CRE_2', 'Riverview Suburban Mixed-Use Loan', 'Loan', 'Active', -12000000.00, Date.newInstance(2024, 2, 18), 7.0},

    // Wabash Healthcare
    new List<Object>{'SEED_2026_06_ACC_WABASH', 'WABASH_OP', 'Wabash Operating', 'Checking', 'Active', 8500000.00, Date.newInstance(2008, 9, 1), 0.05},
    new List<Object>{'SEED_2026_06_ACC_WABASH', 'WABASH_LOC', 'Wabash Revolving Credit', 'Loan', 'Active', -4500000.00, Date.newInstance(2021, 5, 22), 6.5},
    new List<Object>{'SEED_2026_06_ACC_WABASH', 'WABASH_TERM', 'Wabash Expansion Term Loan', 'Loan', 'Active', -15000000.00, Date.newInstance(2024, 1, 8), 6.25},

    // Halsted Restaurant Group
    new List<Object>{'SEED_2026_06_ACC_HALSTED', 'HALSTED_OP', 'Halsted Restaurant Operating', 'Checking', 'Active', 285000.00, Date.newInstance(2013, 6, 18), 0.05},
    new List<Object>{'SEED_2026_06_ACC_HALSTED', 'HALSTED_LOC', 'Halsted Line of Credit', 'Loan', 'Active', -425000.00, Date.newInstance(2022, 9, 12), 8.25},
    new List<Object>{'SEED_2026_06_ACC_HALSTED', 'HALSTED_TERM', 'Halsted New Location Term Loan', 'Loan', 'Active', -1200000.00, Date.newInstance(2024, 3, 8), 7.5},

    // Northbrook Industrial
    new List<Object>{'SEED_2026_06_ACC_NORTHBROOK', 'NORTHBROOK_OP', 'Northbrook Operating', 'Checking', 'Active', 1850000.00, Date.newInstance(2011, 8, 4), 0.05},
    new List<Object>{'SEED_2026_06_ACC_NORTHBROOK', 'NORTHBROOK_LOC', 'Northbrook Working Capital', 'Loan', 'Active', -650000.00, Date.newInstance(2022, 11, 18), 7.85}
};

// Step 1: Insert FinancialAccount records
List<FinancialAccount> fasToInsert = new List<FinancialAccount>();
Map<String, Decimal> balanceByExtId = new Map<String, Decimal>();

for (List<Object> b : faBundles) {
    String accExtId = (String) b[0];
    String faExtId = 'SEED_2026_06_FA_' + (String) b[1];
    String name = (String) b[2];
    String faType = (String) b[3];
    String status = (String) b[4];
    Decimal balance = (Decimal) b[5];
    Date openingDate = (Date) b[6];
    Decimal interestRate = (Decimal) b[7];

    if (accIdByExtId.get(accExtId) == null) continue;

    // Generate a deterministic account number from the external ID suffix
    String acctNum = String.valueOf(Math.abs(faExtId.hashCode())).leftPad(10, '0').right(10);
    FinancialAccount fa = new FinancialAccount(
        Name = name,
        FinancialAccountNumber = acctNum,
        Type = faType,
        Status = status,
        OpeningDate = openingDate,
        External_Id__c = faExtId
    );
    if (interestRate != null) fa.InterestRate = interestRate;

    // For loans, also populate TotalOutstandingAmount
    if (faType.contains('Loan')) {
        fa.TotalOutstandingAmount = Math.abs(balance);
    }

    fasToInsert.add(fa);
    balanceByExtId.put(faExtId, balance);
}

insert fasToInsert;
System.debug('Inserted ' + fasToInsert.size() + ' financial accounts.');

// Step 2: Build map of new FinancialAccount IDs by external ID
Map<String, Id> faIdByExtId = new Map<String, Id>();
for (FinancialAccount fa : [SELECT Id, External_Id__c FROM FinancialAccount WHERE External_Id__c LIKE 'SEED_2026_06_FA_%']) {
    faIdByExtId.put(fa.External_Id__c, fa.Id);
}

// Step 3: Insert FinancialAccountParty (junction) records
List<FinancialAccountParty> partiesToInsert = new List<FinancialAccountParty>();
for (List<Object> b : faBundles) {
    String accExtId = (String) b[0];
    String faExtId = 'SEED_2026_06_FA_' + (String) b[1];

    Id accId = accIdByExtId.get(accExtId);
    Id faId = faIdByExtId.get(faExtId);

    if (accId == null || faId == null) continue;

    partiesToInsert.add(new FinancialAccountParty(
        FinancialAccountId = faId,
        AccountId = accId,
        Role = 'Owner',
        RoleStartDate = Date.today().addDays(-365)
    ));
}

insert partiesToInsert;
System.debug('Inserted ' + partiesToInsert.size() + ' financial account parties.');

// Step 4: Insert FinancialAccountBalance records
List<FinancialAccountBalance> balancesToInsert = new List<FinancialAccountBalance>();
for (List<Object> b : faBundles) {
    String faExtId = 'SEED_2026_06_FA_' + (String) b[1];
    Decimal balance = balanceByExtId.get(faExtId);
    Id faId = faIdByExtId.get(faExtId);

    if (faId == null || balance == null) continue;

    balancesToInsert.add(new FinancialAccountBalance(
        FinancialAccountId = faId,
        Amount = balance,
        Type = 'Total Balance',
        BalanceAsOfDate = Date.today()
    ));
}

insert balancesToInsert;
System.debug('Inserted ' + balancesToInsert.size() + ' balance records.');

System.debug('Layer 3 complete.');
