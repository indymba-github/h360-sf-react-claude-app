// Layer 1 — Seed Accounts
// Idempotent: checks External_Id__c before inserting

List<Account> toInsert = new List<Account>();

// Retail households — mass market
toInsert.add(new Account(Name='The Patterson Family', External_Id__c='SEED_2026_06_ACC_PATTERSON', Industry='Other', Type='Individual', BillingCity='Naperville', BillingState='IL', BillingPostalCode='60540', Phone='(630) 555-0142', AnnualRevenue=null, NumberOfEmployees=null, Description='Two-income household, two kids in elementary school. Banking with us 8 years.'));
toInsert.add(new Account(Name='The Nguyen Family', External_Id__c='SEED_2026_06_ACC_NGUYEN', Industry='Other', Type='Individual', BillingCity='Aurora', BillingState='IL', BillingPostalCode='60506', Phone='(630) 555-0167', Description='Small business owner spouse, growing family.'));
toInsert.add(new Account(Name='Reyes Household', External_Id__c='SEED_2026_06_ACC_REYES', Industry='Other', Type='Individual', BillingCity='Chicago', BillingState='IL', BillingPostalCode='60614', Phone='(312) 555-0189', Description='DINK household. Both partners in tech.'));
toInsert.add(new Account(Name='The Okonkwo Family', External_Id__c='SEED_2026_06_ACC_OKONKWO', Industry='Other', Type='Individual', BillingCity='Oak Park', BillingState='IL', Phone='(708) 555-0234', Description='Healthcare professional family, recent home purchase.'));
toInsert.add(new Account(Name='Lin Family', External_Id__c='SEED_2026_06_ACC_LIN', Industry='Other', Type='Individual', BillingCity='Schaumburg', BillingState='IL', Phone='(847) 555-0156', Description='Engineering family, college-aged kids.'));

// Retail — mass-affluent
toInsert.add(new Account(Name='The Henderson Trust', External_Id__c='SEED_2026_06_ACC_HENDERSON', Industry='Other', Type='Individual', BillingCity='Winnetka', BillingState='IL', Phone='(847) 555-0289', Description='Established household, multi-generational banking relationship.'));
toInsert.add(new Account(Name='Velazquez Family', External_Id__c='SEED_2026_06_ACC_VELAZQUEZ', Industry='Other', Type='Individual', BillingCity='Hinsdale', BillingState='IL', Phone='(630) 555-0301', Description='Surgeon + attorney, high-income dual-earner.'));
toInsert.add(new Account(Name='The Chen Household', External_Id__c='SEED_2026_06_ACC_CHEN', Industry='Other', Type='Individual', BillingCity='Lake Forest', BillingState='IL', Phone='(847) 555-0345', Description='Empty nesters, retirement-focused.'));
toInsert.add(new Account(Name='Brennan Family', External_Id__c='SEED_2026_06_ACC_BRENNAN', Industry='Other', Type='Individual', BillingCity='Highland Park', BillingState='IL', Phone='(847) 555-0367', Description='Recent inheritance, looking for guidance on positioning.'));

// Retail — wealth tier
toInsert.add(new Account(Name='The Kapoor Family Office', External_Id__c='SEED_2026_06_ACC_KAPOOR', Industry='Other', Type='Individual', BillingCity='Chicago', BillingState='IL', Phone='(312) 555-0412', Description='Tech founder exit, multi-million dollar AUM, trust planning underway.'));
toInsert.add(new Account(Name='Sutherland Trust', External_Id__c='SEED_2026_06_ACC_SUTHERLAND', Industry='Other', Type='Individual', BillingCity='Lake Bluff', BillingState='IL', Phone='(847) 555-0445', Description='Inherited wealth, three generations of relationship.'));
toInsert.add(new Account(Name='The Asante Family', External_Id__c='SEED_2026_06_ACC_ASANTE', Industry='Other', Type='Individual', BillingCity='Glencoe', BillingState='IL', Phone='(847) 555-0478', Description='Self-made wealth from healthcare practice, philanthropic.'));

// Smaller retail
toInsert.add(new Account(Name='Mendez Family', External_Id__c='SEED_2026_06_ACC_MENDEZ', Industry='Other', Type='Individual', BillingCity='Berwyn', BillingState='IL', Phone='(708) 555-0512', Description='Young family, first-time homebuyers.'));
toInsert.add(new Account(Name='The Walsh Family', External_Id__c='SEED_2026_06_ACC_WALSH', Industry='Other', Type='Individual', BillingCity='Evanston', BillingState='IL', Phone='(847) 555-0534', Description='Academic household, modest income, long-term banking relationship.'));
toInsert.add(new Account(Name='Singh Household', External_Id__c='SEED_2026_06_ACC_SINGH', Industry='Other', Type='Individual', BillingCity='Naperville', BillingState='IL', Phone='(630) 555-0556', Description='Tech executive, recent stock option exercise.'));

// Commercial — small business
toInsert.add(new Account(Name='Lakeshore Coffee Roasters LLC', External_Id__c='SEED_2026_06_ACC_LAKESHORE', Industry='Food & Beverage', Type='Customer - Direct', BillingCity='Chicago', BillingState='IL', Phone='(312) 555-0601', AnnualRevenue=2400000, NumberOfEmployees=18, Description='Specialty coffee roaster, three retail locations.'));
toInsert.add(new Account(Name='Prairie Engineering Group', External_Id__c='SEED_2026_06_ACC_PRAIRIE', Industry='Engineering', Type='Customer - Direct', BillingCity='Oak Brook', BillingState='IL', Phone='(630) 555-0623', AnnualRevenue=8500000, NumberOfEmployees=42, Description='Civil engineering firm, growing infrastructure practice.'));
toInsert.add(new Account(Name='Northshore Dental Group', External_Id__c='SEED_2026_06_ACC_NORTHSHORE', Industry='Healthcare', Type='Customer - Direct', BillingCity='Wilmette', BillingState='IL', Phone='(847) 555-0645', AnnualRevenue=4200000, NumberOfEmployees=22, Description='Multi-location dental practice, considering expansion.'));
toInsert.add(new Account(Name='Greentech Solar Inc', External_Id__c='SEED_2026_06_ACC_GREENTECH', Industry='Energy', Type='Customer - Direct', BillingCity='Aurora', BillingState='IL', Phone='(630) 555-0667', AnnualRevenue=12000000, NumberOfEmployees=58, Description='Residential solar installer, rapid growth post-IRA legislation.'));

// Commercial — mid-market
toInsert.add(new Account(Name='Midwest Logistics Partners', External_Id__c='SEED_2026_06_ACC_MIDWEST', Industry='Transportation', Type='Customer - Direct', BillingCity='Joliet', BillingState='IL', Phone='(815) 555-0689', AnnualRevenue=45000000, NumberOfEmployees=180, Description='Regional trucking and warehouse operator. Family-owned, third generation.'));
toInsert.add(new Account(Name='Sterling Manufacturing Co', External_Id__c='SEED_2026_06_ACC_STERLING', Industry='Manufacturing', Type='Customer - Direct', BillingCity='Rockford', BillingState='IL', Phone='(815) 555-0701', AnnualRevenue=68000000, NumberOfEmployees=240, Description='Precision metalworks for aerospace supply chain.'));
toInsert.add(new Account(Name='Riverview Properties LLC', External_Id__c='SEED_2026_06_ACC_RIVERVIEW', Industry='Real Estate', Type='Customer - Direct', BillingCity='Chicago', BillingState='IL', Phone='(312) 555-0723', AnnualRevenue=32000000, NumberOfEmployees=45, Description='Commercial real estate developer, downtown and near-suburb portfolio.'));
toInsert.add(new Account(Name='Wabash Healthcare Systems', External_Id__c='SEED_2026_06_ACC_WABASH', Industry='Healthcare', Type='Customer - Direct', BillingCity='Schaumburg', BillingState='IL', Phone='(847) 555-0745', AnnualRevenue=88000000, NumberOfEmployees=420, Description='Multi-specialty outpatient network, expanding into telehealth.'));
toInsert.add(new Account(Name='Halsted Restaurant Group', External_Id__c='SEED_2026_06_ACC_HALSTED', Industry='Food & Beverage', Type='Customer - Direct', BillingCity='Chicago', BillingState='IL', Phone='(312) 555-0767', AnnualRevenue=18000000, NumberOfEmployees=240, Description='Six-restaurant group, expanding to suburbs.'));
toInsert.add(new Account(Name='Northbrook Industrial Supply', External_Id__c='SEED_2026_06_ACC_NORTHBROOK', Industry='Distribution', Type='Customer - Direct', BillingCity='Northbrook', BillingState='IL', Phone='(847) 555-0789', AnnualRevenue=24000000, NumberOfEmployees=95, Description='B2B industrial supply distributor, primary supplier to manufacturing clients.'));

Set<String> existingExtIds = new Set<String>();
for (Account a : [SELECT External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    existingExtIds.add(a.External_Id__c);
}

List<Account> filteredInsert = new List<Account>();
for (Account a : toInsert) {
    if (!existingExtIds.contains(a.External_Id__c)) {
        filteredInsert.add(a);
    }
}

if (!filteredInsert.isEmpty()) {
    insert filteredInsert;
    System.debug('Inserted ' + filteredInsert.size() + ' new accounts.');
} else {
    System.debug('No new accounts to insert. All ' + toInsert.size() + ' already exist.');
}
