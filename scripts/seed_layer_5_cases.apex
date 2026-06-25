// Layer 5 — Seed Cases

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

List<Case> toInsert = new List<Case>();

// Open cases — varied priority and status
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Subject='Mortgage payment portal access issue', Description='Customer unable to log into mortgage payment portal for two days. Reset link not arriving.', Status='Working', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Subject='Business account check deposit hold', Description='Mobile deposit on hold for 5 business days. Customer is asking for early release.', Status='New', Priority='High', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Subject='Brokerage statement discrepancy', Description='Q1 statement shows incorrect cost basis on AAPL position. Needs research.', Status='Working', Priority='Medium', Origin='Web'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), Subject='Wire transfer to international beneficiary', Description='Customer needs help setting up recurring international wire to family in Lagos.', Status='New', Priority='Low', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), Subject='529 contribution limit question', Description='Asking about state tax deduction limits for IL 529 contributions.', Status='Working', Priority='Low', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), Subject='Trust account beneficiary update', Description='Robert Henderson wants to update successor trustee. Needs notarized documentation.', Status='Working', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), Subject='SEP IRA contribution timing', Description='Marcus Velazquez asking about 2025 contribution deadline for SEP IRA.', Status='Working', Priority='Low', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), Subject='Living trust funding strategy', Description='Question about which assets to move into newly-established living trust.', Status='New', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), Subject='Inheritance positioning urgency', Description='Patrick wants guidance ASAP on tax-efficient positioning of inherited assets.', Status='Working', Priority='High', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), Subject='Foundation grant disbursement', Description='Setting up recurring grant disbursement to recipient charities.', Status='Working', Priority='Medium', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_SUTHERLAND'), Subject='Trust amendment request', Description='William Sutherland III requesting amendment to trust distribution schedule.', Status='New', Priority='High', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), Subject='Mortgage pre-approval status', Description='Diego and Camila asking for mortgage pre-approval letter to make an offer.', Status='Working', Priority='High', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), Subject='Line of credit drawdown', Description='Ben Reilly needs to drawdown $50K on the LOC for new espresso machine purchase.', Status='Working', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), Subject='Payroll account reconciliation', Description='CFO reports a $42K reconciliation discrepancy in May payroll account.', Status='Working', Priority='High', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHSHORE'), Subject='New practice acquisition financing', Description='Dr. Park exploring acquisition of practice in Lake County, needs term sheet.', Status='New', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), Subject='Working capital line increase request', Description='Greentech requesting LOC increase from $2M to $3.5M due to backlog growth.', Status='Working', Priority='High', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), Subject='Annual credit review documents', Description='Annual financial statements and tax returns submitted for credit review.', Status='Working', Priority='Medium', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), Subject='Master credit facility renewal', Description='Sterling working capital line up for renewal in 90 days.', Status='New', Priority='High', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'), Subject='Construction draw schedule revision', Description='David Riverview requesting revised draw schedule for Tower Project due to weather delays.', Status='Working', Priority='High', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), Subject='Treasury management proposal', Description='Wabash interested in upgrading treasury management services. Needs proposal.', Status='New', Priority='Medium', Origin='Email'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), Subject='Late payment on equipment loan', Description='June equipment loan payment 12 days late. Need to contact Tony Costa.', Status='New', Priority='High', Origin='Internal'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'), Subject='Inventory financing renewal discussion', Description='Greg Beckman wants to discuss restructuring inventory financing terms.', Status='Working', Priority='Medium', Origin='Phone'));

// A few Closed cases too — to show banker resolution history
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Subject='Direct deposit form for employer change', Description='Successfully updated direct deposit routing for Jennifer Patterson.', Status='Closed', Priority='Low', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Subject='Lost debit card replacement', Description='Card replacement issued and activated.', Status='Closed', Priority='Medium', Origin='Phone'));
toInsert.add(new Case(AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Subject='Joint account beneficiary update', Description='Beneficiary update completed and confirmed.', Status='Closed', Priority='Low', Origin='Web'));

insert toInsert;
System.debug('Inserted ' + toInsert.size() + ' cases.');
