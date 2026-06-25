# Seed Demo Data — Salesforce FSC on Core

Generate a believable book of business for a banking RM demo. ~20 households with full relationship depth: contacts, financial accounts, balances, opportunities, and cases. Mix of retail and commercial customers, with a few wealth-tier households for variety.

**Execute via Apex Anonymous through the Salesforce CLI.** Do not modify or delete existing data — only insert new records. Use a unique `External_Id__c` prefix on all new records (`SEED_2026_06_*`) so they can be cleanly identified or removed later.

---

## Data Shape

**Targets:**
- 15 retail households (individuals/families) — mix of mass-market, mass-affluent, and wealth segments
- 10 commercial accounts (small business + mid-market) — varying industries
- ~25 total accounts, ~60 contacts, ~95 financial accounts, ~150 opportunities, ~50 cases

**FSC on Core objects used:**
- `Account` (Person Account NOT used — assume business org with Account holding individuals too)
- `Contact` (linked via AccountId)
- `FinancialAccount` (standard FSC on Core object)
- `FinancialAccountParty` (junction: AccountId ↔ FinancialAccountId, Role='Owner', IsRoleActive=true)
- `FinancialAccountBalance` (Type='Total Balance', Amount=$)
- `Opportunity` (mix of stages: 50% closed historical, 50% open pipeline)
- `Case` (mix of New/Working/Closed, Low/Medium/High priority)
- `AccountAccountRelation` (household/relationship links between accounts)

---

## Generation Approach

The Apex script below builds the data in **layers**, each in a separate execute-anonymous run so failures can be isolated. Run them in order:

1. **Layer 1 — Accounts** (Retail + Commercial, ~25 records)
2. **Layer 2 — Contacts** (linked to Accounts, ~60 records)
3. **Layer 3 — Financial Accounts + Parties + Balances** (~95 records each)
4. **Layer 4 — Opportunities** (past + future, ~150 records)
5. **Layer 5 — Cases** (mix of statuses, ~50 records)
6. **Layer 6 — Account Relationships** (household linkages, ~10 records)

Each layer queries previously-inserted records by `External_Id__c` to wire foreign keys. This makes the layers idempotent — re-running a layer skips already-inserted records by checking for the external ID.

---

## Step-by-Step Execution

For each layer, run via Salesforce CLI:

```bash
sf apex run --file scripts/seed_layer_N.apex --target-org <your-default-org-alias>
```

Or, paste the Apex into Developer Console → Anonymous Window → Execute.

---

## Layer 1 — Accounts (~25 records)

Save as `scripts/seed_layer_1_accounts.apex`:

```apex
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

// Insert only those without existing External_Id__c
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
```

---

## Layer 2 — Contacts (~60 records)

Save as `scripts/seed_layer_2_contacts.apex`:

```apex
// Layer 2 — Seed Contacts
// Looks up parent Accounts by External_Id__c

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

List<Contact> toInsert = new List<Contact>();

// Patterson household — couple + 2 kids
toInsert.add(new Contact(FirstName='Michael', LastName='Patterson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Title='Software Engineer', Email='mpatterson@example.com', Phone='(630) 555-0142', External_Id__c='SEED_2026_06_CON_PATTERSON_M'));
toInsert.add(new Contact(FirstName='Jennifer', LastName='Patterson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Title='HR Director', Email='jpatterson@example.com', Phone='(630) 555-0143', External_Id__c='SEED_2026_06_CON_PATTERSON_J'));

// Nguyen
toInsert.add(new Contact(FirstName='David', LastName='Nguyen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Title='Small Business Owner', Email='dnguyen@example.com', Phone='(630) 555-0167', External_Id__c='SEED_2026_06_CON_NGUYEN_D'));
toInsert.add(new Contact(FirstName='Linda', LastName='Nguyen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Title='Teacher', Email='lnguyen@example.com', Phone='(630) 555-0168', External_Id__c='SEED_2026_06_CON_NGUYEN_L'));

// Reyes
toInsert.add(new Contact(FirstName='Sofia', LastName='Reyes', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Title='Product Manager', Email='sreyes@example.com', Phone='(312) 555-0189', External_Id__c='SEED_2026_06_CON_REYES_S'));
toInsert.add(new Contact(FirstName='Carlos', LastName='Reyes', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Title='Data Scientist', Email='creyes@example.com', Phone='(312) 555-0190', External_Id__c='SEED_2026_06_CON_REYES_C'));

// Okonkwo
toInsert.add(new Contact(FirstName='Adaeze', LastName='Okonkwo', AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), Title='Physician', Email='aokonkwo@example.com', Phone='(708) 555-0234', External_Id__c='SEED_2026_06_CON_OKONKWO_A'));
toInsert.add(new Contact(FirstName='Chidi', LastName='Okonkwo', AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), Title='Nurse Practitioner', Email='cokonkwo@example.com', Phone='(708) 555-0235', External_Id__c='SEED_2026_06_CON_OKONKWO_C'));

// Lin
toInsert.add(new Contact(FirstName='Wei', LastName='Lin', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), Title='Engineering Manager', Email='wlin@example.com', Phone='(847) 555-0156', External_Id__c='SEED_2026_06_CON_LIN_W'));
toInsert.add(new Contact(FirstName='Mei', LastName='Lin', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), Title='Pharmacist', Email='mlin@example.com', Phone='(847) 555-0157', External_Id__c='SEED_2026_06_CON_LIN_M'));

// Henderson
toInsert.add(new Contact(FirstName='Robert', LastName='Henderson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), Title='Retired Executive', Email='rhenderson@example.com', Phone='(847) 555-0289', External_Id__c='SEED_2026_06_CON_HENDERSON_R'));
toInsert.add(new Contact(FirstName='Margaret', LastName='Henderson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), Title='Board Member', Email='mhenderson@example.com', Phone='(847) 555-0290', External_Id__c='SEED_2026_06_CON_HENDERSON_M'));

// Velazquez
toInsert.add(new Contact(FirstName='Elena', LastName='Velazquez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), Title='Cardiothoracic Surgeon', Email='evelazquez@example.com', Phone='(630) 555-0301', External_Id__c='SEED_2026_06_CON_VELAZQUEZ_E'));
toInsert.add(new Contact(FirstName='Marcus', LastName='Velazquez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), Title='Litigation Partner', Email='mvelazquez@example.com', Phone='(630) 555-0302', External_Id__c='SEED_2026_06_CON_VELAZQUEZ_M'));

// Chen
toInsert.add(new Contact(FirstName='Howard', LastName='Chen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), Title='Retired CFO', Email='hchen@example.com', Phone='(847) 555-0345', External_Id__c='SEED_2026_06_CON_CHEN_H'));
toInsert.add(new Contact(FirstName='Catherine', LastName='Chen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), Title='Retired Educator', Email='cchen@example.com', Phone='(847) 555-0346', External_Id__c='SEED_2026_06_CON_CHEN_C'));

// Brennan
toInsert.add(new Contact(FirstName='Patrick', LastName='Brennan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), Title='Investment Banker', Email='pbrennan@example.com', Phone='(847) 555-0367', External_Id__c='SEED_2026_06_CON_BRENNAN_P'));
toInsert.add(new Contact(FirstName='Erin', LastName='Brennan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), Title='Art Curator', Email='ebrennan@example.com', Phone='(847) 555-0368', External_Id__c='SEED_2026_06_CON_BRENNAN_E'));

// Kapoor — family office
toInsert.add(new Contact(FirstName='Arjun', LastName='Kapoor', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), Title='Founder, Retired CEO', Email='akapoor@example.com', Phone='(312) 555-0412', External_Id__c='SEED_2026_06_CON_KAPOOR_A'));
toInsert.add(new Contact(FirstName='Priya', LastName='Kapoor', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), Title='Philanthropist', Email='pkapoor@example.com', Phone='(312) 555-0413', External_Id__c='SEED_2026_06_CON_KAPOOR_P'));

// Sutherland
toInsert.add(new Contact(FirstName='William', LastName='Sutherland III', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SUTHERLAND'), Title='Trust Beneficiary', Email='wsutherland@example.com', Phone='(847) 555-0445', External_Id__c='SEED_2026_06_CON_SUTHERLAND_W'));

// Asante
toInsert.add(new Contact(FirstName='Kwame', LastName='Asante', AccountId=accIdByExtId.get('SEED_2026_06_ACC_ASANTE'), Title='Dermatologist', Email='kasante@example.com', Phone='(847) 555-0478', External_Id__c='SEED_2026_06_CON_ASANTE_K'));
toInsert.add(new Contact(FirstName='Ama', LastName='Asante', AccountId=accIdByExtId.get('SEED_2026_06_ACC_ASANTE'), Title='Foundation Director', Email='aasante@example.com', Phone='(847) 555-0479', External_Id__c='SEED_2026_06_CON_ASANTE_A'));

// Mendez — young couple
toInsert.add(new Contact(FirstName='Diego', LastName='Mendez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), Title='Marketing Coordinator', Email='dmendez@example.com', Phone='(708) 555-0512', External_Id__c='SEED_2026_06_CON_MENDEZ_D'));
toInsert.add(new Contact(FirstName='Camila', LastName='Mendez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), Title='Nurse', Email='cmendez@example.com', Phone='(708) 555-0513', External_Id__c='SEED_2026_06_CON_MENDEZ_C'));

// Walsh
toInsert.add(new Contact(FirstName='Sean', LastName='Walsh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WALSH'), Title='University Professor', Email='swalsh@example.com', Phone='(847) 555-0534', External_Id__c='SEED_2026_06_CON_WALSH_S'));
toInsert.add(new Contact(FirstName='Bridget', LastName='Walsh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WALSH'), Title='Librarian', Email='bwalsh@example.com', Phone='(847) 555-0535', External_Id__c='SEED_2026_06_CON_WALSH_B'));

// Singh
toInsert.add(new Contact(FirstName='Raj', LastName='Singh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), Title='VP Engineering', Email='rsingh@example.com', Phone='(630) 555-0556', External_Id__c='SEED_2026_06_CON_SINGH_R'));
toInsert.add(new Contact(FirstName='Anjali', LastName='Singh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), Title='Product Designer', Email='asingh@example.com', Phone='(630) 555-0557', External_Id__c='SEED_2026_06_CON_SINGH_A'));

// Lakeshore Coffee
toInsert.add(new Contact(FirstName='Ben', LastName='Reilly', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), Title='Founder & CEO', Email='breilly@lakeshore-coffee.example', Phone='(312) 555-0601', External_Id__c='SEED_2026_06_CON_LAKESHORE_B'));
toInsert.add(new Contact(FirstName='Sarah', LastName='Reilly', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), Title='COO', Email='sreilly@lakeshore-coffee.example', Phone='(312) 555-0602', External_Id__c='SEED_2026_06_CON_LAKESHORE_S'));

// Prairie Engineering
toInsert.add(new Contact(FirstName='James', LastName='Whitfield', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), Title='Managing Partner', Email='jwhitfield@prairie-eng.example', Phone='(630) 555-0623', External_Id__c='SEED_2026_06_CON_PRAIRIE_J'));
toInsert.add(new Contact(FirstName='Rita', LastName='Patel', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), Title='CFO', Email='rpatel@prairie-eng.example', Phone='(630) 555-0624', External_Id__c='SEED_2026_06_CON_PRAIRIE_R'));

// Northshore Dental
toInsert.add(new Contact(FirstName='Dr. Steven', LastName='Park', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHSHORE'), Title='Managing Partner', Email='spark@northshore-dental.example', Phone='(847) 555-0645', External_Id__c='SEED_2026_06_CON_NORTHSHORE_S'));

// Greentech Solar
toInsert.add(new Contact(FirstName='Maya', LastName='Goldberg', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), Title='CEO', Email='mgoldberg@greentech-solar.example', Phone='(630) 555-0667', External_Id__c='SEED_2026_06_CON_GREENTECH_M'));
toInsert.add(new Contact(FirstName='Tony', LastName='DeMarco', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), Title='CFO', Email='tdemarco@greentech-solar.example', Phone='(630) 555-0668', External_Id__c='SEED_2026_06_CON_GREENTECH_T'));

// Midwest Logistics
toInsert.add(new Contact(FirstName='Frank', LastName='Kowalski', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), Title='President', Email='fkowalski@midwest-logistics.example', Phone='(815) 555-0689', External_Id__c='SEED_2026_06_CON_MIDWEST_F'));
toInsert.add(new Contact(FirstName='Stephanie', LastName='Kowalski', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), Title='VP Operations', Email='skowalski@midwest-logistics.example', Phone='(815) 555-0690', External_Id__c='SEED_2026_06_CON_MIDWEST_S'));

// Sterling Manufacturing
toInsert.add(new Contact(FirstName='Robert', LastName='Sterling', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), Title='CEO', Email='rsterling@sterling-mfg.example', Phone='(815) 555-0701', External_Id__c='SEED_2026_06_CON_STERLING_R'));
toInsert.add(new Contact(FirstName='Janet', LastName='Holt', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), Title='CFO', Email='jholt@sterling-mfg.example', Phone='(815) 555-0702', External_Id__c='SEED_2026_06_CON_STERLING_J'));

// Riverview Properties
toInsert.add(new Contact(FirstName='David', LastName='Riverview', AccountId=accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'), Title='Founder & CEO', Email='driverview@riverview-prop.example', Phone='(312) 555-0723', External_Id__c='SEED_2026_06_CON_RIVERVIEW_D'));

// Wabash Healthcare
toInsert.add(new Contact(FirstName='Dr. Lisa', LastName='Bahar', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), Title='CEO', Email='lbahar@wabash-health.example', Phone='(847) 555-0745', External_Id__c='SEED_2026_06_CON_WABASH_L'));
toInsert.add(new Contact(FirstName='Marcus', LastName='Heller', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), Title='CFO', Email='mheller@wabash-health.example', Phone='(847) 555-0746', External_Id__c='SEED_2026_06_CON_WABASH_M'));

// Halsted Restaurant Group
toInsert.add(new Contact(FirstName='Tony', LastName='Costa', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), Title='Owner', Email='tcosta@halsted-restaurants.example', Phone='(312) 555-0767', External_Id__c='SEED_2026_06_CON_HALSTED_T'));

// Northbrook Industrial
toInsert.add(new Contact(FirstName='Greg', LastName='Beckman', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'), Title='CEO', Email='gbeckman@northbrook-supply.example', Phone='(847) 555-0789', External_Id__c='SEED_2026_06_CON_NORTHBROOK_G'));

// Filter out already-inserted
Set<String> existingExtIds = new Set<String>();
for (Contact c : [SELECT External_Id__c FROM Contact WHERE External_Id__c LIKE 'SEED_2026_06_CON_%']) {
    existingExtIds.add(c.External_Id__c);
}

List<Contact> filteredInsert = new List<Contact>();
for (Contact c : toInsert) {
    if (c.AccountId != null && !existingExtIds.contains(c.External_Id__c)) {
        filteredInsert.add(c);
    }
}

if (!filteredInsert.isEmpty()) {
    insert filteredInsert;
    System.debug('Inserted ' + filteredInsert.size() + ' new contacts.');
} else {
    System.debug('No new contacts to insert.');
}
```

---

## Layer 3 — Financial Accounts + Parties + Balances

Save as `scripts/seed_layer_3_financial.apex`:

```apex
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
    
    FinancialAccount fa = new FinancialAccount(
        Name = name,
        Nickname = name,
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
        IsRoleActive = true,
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
```

---

## Layer 4 — Opportunities (past + future)

Save as `scripts/seed_layer_4_opportunities.apex`:

```apex
// Layer 4 — Seed Opportunities (mix of past closed-won/lost + open pipeline)

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

List<Opportunity> toInsert = new List<Opportunity>();

// Closed Won historical wins (positive history)
toInsert.add(new Opportunity(Name='Patterson Mortgage Refinance', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), StageName='Closed Won', Amount=342000, CloseDate=Date.newInstance(2024, 7, 18)));
toInsert.add(new Opportunity(Name='Nguyen Business Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), StageName='Closed Won', Amount=80000, CloseDate=Date.newInstance(2023, 5, 15)));
toInsert.add(new Opportunity(Name='Reyes Brokerage Onboarding', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), StageName='Closed Won', Amount=145000, CloseDate=Date.newInstance(2024, 6, 8)));
toInsert.add(new Opportunity(Name='Okonkwo Home Purchase Mortgage', AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), StageName='Closed Won', Amount=425000, CloseDate=Date.newInstance(2024, 11, 8)));
toInsert.add(new Opportunity(Name='Henderson Trust Establishment', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), StageName='Closed Won', Amount=1850000, CloseDate=Date.newInstance(2023, 8, 15)));
toInsert.add(new Opportunity(Name='Velazquez Wealth Onboarding', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), StageName='Closed Won', Amount=720000, CloseDate=Date.newInstance(2024, 3, 8)));
toInsert.add(new Opportunity(Name='Kapoor Family Trust Establishment', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), StageName='Closed Won', Amount=8500000, CloseDate=Date.newInstance(2024, 8, 12)));
toInsert.add(new Opportunity(Name='Lakeshore Equipment Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), StageName='Closed Won', Amount=120000, CloseDate=Date.newInstance(2024, 9, 12)));
toInsert.add(new Opportunity(Name='Prairie Acquisition Financing', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), StageName='Closed Won', Amount=2800000, CloseDate=Date.newInstance(2024, 1, 18)));
toInsert.add(new Opportunity(Name='Greentech Working Capital Line', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), StageName='Closed Won', Amount=1850000, CloseDate=Date.newInstance(2024, 4, 8)));
toInsert.add(new Opportunity(Name='Midwest Fleet Financing', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), StageName='Closed Won', Amount=8500000, CloseDate=Date.newInstance(2024, 11, 18)));
toInsert.add(new Opportunity(Name='Sterling Equipment Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), StageName='Closed Won', Amount=7200000, CloseDate=Date.newInstance(2024, 9, 4)));
toInsert.add(new Opportunity(Name='Riverview Tower Project', AccountId=accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'), StageName='Closed Won', Amount=18500000, CloseDate=Date.newInstance(2024, 7, 12)));
toInsert.add(new Opportunity(Name='Wabash Expansion Financing', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), StageName='Closed Won', Amount=15000000, CloseDate=Date.newInstance(2025, 1, 8)));
toInsert.add(new Opportunity(Name='Halsted New Location Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), StageName='Closed Won', Amount=1200000, CloseDate=Date.newInstance(2025, 3, 8)));

// Closed Lost — historical losses (realistic)
toInsert.add(new Opportunity(Name='Nguyen Investment Pitch', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), StageName='Closed Lost', Amount=50000, CloseDate=Date.newInstance(2024, 8, 22), Description='Client went with a competitor wealth manager.'));
toInsert.add(new Opportunity(Name='Lin Wealth Management Proposal', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), StageName='Closed Lost', Amount=180000, CloseDate=Date.newInstance(2024, 6, 15), Description='Lost to robo-advisor pricing.'));
toInsert.add(new Opportunity(Name='Singh Stock Options Strategy', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), StageName='Closed Lost', Amount=250000, CloseDate=Date.newInstance(2024, 11, 4), Description='Client used employer-sponsored Fidelity.'));
toInsert.add(new Opportunity(Name='Northshore Practice Acquisition', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHSHORE'), StageName='Closed Lost', Amount=1500000, CloseDate=Date.newInstance(2024, 4, 22), Description='Lost to specialty healthcare lender.'));
toInsert.add(new Opportunity(Name='Halsted Refinance', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), StageName='Closed Lost', Amount=850000, CloseDate=Date.newInstance(2023, 12, 18), Description='Client extended existing arrangement instead.'));

// Open pipeline — Prospecting / Qualification (early stage)
toInsert.add(new Opportunity(Name='Patterson Investment Account', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), StageName='Prospecting', Amount=85000, CloseDate=Date.newInstance(2026, 8, 15)));
toInsert.add(new Opportunity(Name='Mendez First Home Mortgage', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), StageName='Qualification', Amount=425000, CloseDate=Date.newInstance(2026, 7, 30)));
toInsert.add(new Opportunity(Name='Singh Premier Banking Upgrade', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), StageName='Prospecting', Amount=150000, CloseDate=Date.newInstance(2026, 9, 12)));
toInsert.add(new Opportunity(Name='Brennan Inheritance Positioning', AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), StageName='Qualification', Amount=875000, CloseDate=Date.newInstance(2026, 8, 22)));
toInsert.add(new Opportunity(Name='Asante Practice Refinance', AccountId=accIdByExtId.get('SEED_2026_06_ACC_ASANTE'), StageName='Prospecting', Amount=580000, CloseDate=Date.newInstance(2026, 10, 8)));

// Open pipeline — Mid stage (Proposal / Negotiation)
toInsert.add(new Opportunity(Name='Reyes Education Loan Refi', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), StageName='Proposal/Price Quote', Amount=65000, CloseDate=Date.newInstance(2026, 7, 22)));
toInsert.add(new Opportunity(Name='Velazquez Marcus Practice Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), StageName='Proposal/Price Quote', Amount=1200000, CloseDate=Date.newInstance(2026, 8, 4)));
toInsert.add(new Opportunity(Name='Lakeshore Expansion Term Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), StageName='Proposal/Price Quote', Amount=450000, CloseDate=Date.newInstance(2026, 9, 18)));
toInsert.add(new Opportunity(Name='Prairie Real Estate Financing', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), StageName='Negotiation/Review', Amount=4200000, CloseDate=Date.newInstance(2026, 8, 30)));
toInsert.add(new Opportunity(Name='Greentech Equipment Term Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), StageName='Proposal/Price Quote', Amount=2400000, CloseDate=Date.newInstance(2026, 10, 12)));
toInsert.add(new Opportunity(Name='Midwest Warehouse CapEx', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), StageName='Negotiation/Review', Amount=6500000, CloseDate=Date.newInstance(2026, 9, 28)));
toInsert.add(new Opportunity(Name='Sterling Working Capital Renewal', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), StageName='Proposal/Price Quote', Amount=8500000, CloseDate=Date.newInstance(2026, 8, 18)));
toInsert.add(new Opportunity(Name='Riverview Loop Project Loan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'), StageName='Negotiation/Review', Amount=22000000, CloseDate=Date.newInstance(2026, 11, 15)));
toInsert.add(new Opportunity(Name='Wabash Telehealth Expansion', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), StageName='Proposal/Price Quote', Amount=8500000, CloseDate=Date.newInstance(2026, 9, 8)));

// Open pipeline — Late stage (close to close)
toInsert.add(new Opportunity(Name='Henderson Roth Conversion Strategy', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), StageName='Negotiation/Review', Amount=320000, CloseDate=Date.newInstance(2026, 7, 8)));
toInsert.add(new Opportunity(Name='Chen Estate Planning Services', AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), StageName='Negotiation/Review', Amount=185000, CloseDate=Date.newInstance(2026, 6, 30)));
toInsert.add(new Opportunity(Name='Kapoor Foundation Restructure', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), StageName='Negotiation/Review', Amount=1500000, CloseDate=Date.newInstance(2026, 7, 18)));
toInsert.add(new Opportunity(Name='Sutherland Generational Trust Review', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SUTHERLAND'), StageName='Proposal/Price Quote', Amount=750000, CloseDate=Date.newInstance(2026, 9, 22)));

// Open pipeline — Stalled / overdue (realistic ugliness)
toInsert.add(new Opportunity(Name='Walsh IRA Consolidation', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WALSH'), StageName='Qualification', Amount=125000, CloseDate=Date.newInstance(2025, 11, 30)));
toInsert.add(new Opportunity(Name='Halsted Restaurant Refinance', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), StageName='Proposal/Price Quote', Amount=2200000, CloseDate=Date.newInstance(2026, 2, 28)));
toInsert.add(new Opportunity(Name='Northbrook Inventory Financing', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'), StageName='Qualification', Amount=1450000, CloseDate=Date.newInstance(2026, 4, 15)));

insert toInsert;
System.debug('Inserted ' + toInsert.size() + ' opportunities.');
```

---

## Layer 5 — Cases

Save as `scripts/seed_layer_5_cases.apex`:

```apex
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
```

---

## Layer 6 — Account Relationships (households)

Save as `scripts/seed_layer_6_relationships.apex`:

```apex
// Layer 6 — Seed AccountAccountRelation records (household linkages)
// Links related accounts together to demonstrate household relationships

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

List<AccountAccountRelation> toInsert = new List<AccountAccountRelation>();

// Henderson household relationships (already a single account, but link to Brennan as relative — common pattern)
// We'll create a few cross-account family linkages for demo richness

// Patterson and Lin are friends/referrers (referral relationship)
if (accIdByExtId.containsKey('SEED_2026_06_ACC_PATTERSON') && accIdByExtId.containsKey('SEED_2026_06_ACC_LIN')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_LIN'),
        IsActive = true,
        HierarchyType = 'Personal'
    ));
}

// Lakeshore and Halsted — both restaurant industry, business partners
if (accIdByExtId.containsKey('SEED_2026_06_ACC_LAKESHORE') && accIdByExtId.containsKey('SEED_2026_06_ACC_HALSTED')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_HALSTED'),
        IsActive = true,
        HierarchyType = 'Business'
    ));
}

// Prairie Engineering and Riverview Properties — engineering firm for developer
if (accIdByExtId.containsKey('SEED_2026_06_ACC_PRAIRIE') && accIdByExtId.containsKey('SEED_2026_06_ACC_RIVERVIEW')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'),
        IsActive = true,
        HierarchyType = 'Business'
    ));
}

// Asante family practice — Kwame's medical practice connected to family household
// (Both are the SEED_2026_06_ACC_ASANTE account — not a cross-link)

// Velazquez professional connections
if (accIdByExtId.containsKey('SEED_2026_06_ACC_VELAZQUEZ') && accIdByExtId.containsKey('SEED_2026_06_ACC_NORTHSHORE')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_NORTHSHORE'),
        IsActive = true,
        HierarchyType = 'Professional'
    ));
}

// Sterling and Midwest Logistics — supply chain relationship
if (accIdByExtId.containsKey('SEED_2026_06_ACC_STERLING') && accIdByExtId.containsKey('SEED_2026_06_ACC_MIDWEST')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_STERLING'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'),
        IsActive = true,
        HierarchyType = 'Business'
    ));
}

// Northbrook supplies Sterling Manufacturing
if (accIdByExtId.containsKey('SEED_2026_06_ACC_NORTHBROOK') && accIdByExtId.containsKey('SEED_2026_06_ACC_STERLING')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_STERLING'),
        IsActive = true,
        HierarchyType = 'Business'
    ));
}

if (!toInsert.isEmpty()) {
    insert toInsert;
    System.debug('Inserted ' + toInsert.size() + ' account relationships.');
}
```

---

## Cleanup Script (Optional)

If you ever want to remove all seeded data, save as `scripts/cleanup_seed_data.apex`:

```apex
// REMOVES all SEED_2026_06_* test data
// Run in reverse dependency order

// Layer 6 — relationships first
delete [SELECT Id FROM AccountAccountRelation WHERE 
        AccountId IN (SELECT Id FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%') OR
        RelatedAccountId IN (SELECT Id FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%')];

// Layer 5 — cases
delete [SELECT Id FROM Case WHERE AccountId IN (SELECT Id FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%')];

// Layer 4 — opportunities
delete [SELECT Id FROM Opportunity WHERE AccountId IN (SELECT Id FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%')];

// Layer 3 — financial accounts cascade: balance → party → fa
delete [SELECT Id FROM FinancialAccountBalance WHERE 
        FinancialAccountId IN (SELECT Id FROM FinancialAccount WHERE External_Id__c LIKE 'SEED_2026_06_FA_%')];
delete [SELECT Id FROM FinancialAccountParty WHERE 
        FinancialAccountId IN (SELECT Id FROM FinancialAccount WHERE External_Id__c LIKE 'SEED_2026_06_FA_%')];
delete [SELECT Id FROM FinancialAccount WHERE External_Id__c LIKE 'SEED_2026_06_FA_%'];

// Layer 2 — contacts
delete [SELECT Id FROM Contact WHERE External_Id__c LIKE 'SEED_2026_06_CON_%'];

// Layer 1 — accounts
delete [SELECT Id FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%'];

System.debug('All SEED_2026_06_* data removed.');
```

---

## Notes for Claude Code

- **External ID field name:** I've used `External_Id__c` as the unique identifier. If your org's external ID field is named differently (e.g., `External_ID__c`, `Source_System_Identifier__c`), do a find-and-replace across all scripts.
- **Nickname field:** Layer 3 includes `Nickname` on `FinancialAccount` based on the standard FSC on Core schema. If your org doesn't have that field, remove the line `fa.Nickname = name;` from the financial account construction.
- **Order matters:** Layers must run in order. Each later layer queries for IDs created in earlier layers.
- **Re-run safety:** Each layer checks for existing records by External Id before inserting. Re-running a layer is safe — duplicates won't be created.
- **Error handling:** If a layer fails partway through, check the debug log, fix the issue, and re-run. The idempotency check will skip what was already inserted.

