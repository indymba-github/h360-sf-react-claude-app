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
