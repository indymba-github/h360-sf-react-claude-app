// Layer 2 — Seed Contacts
Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}
List<Contact> toInsert = new List<Contact>();
toInsert.add(new Contact(FirstName='Michael', LastName='Patterson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Title='Software Engineer', Email='mpatterson@example.com', Phone='(630) 555-0142', External_Id__c='SEED_2026_06_CON_PATTERSON_M'));
toInsert.add(new Contact(FirstName='Jennifer', LastName='Patterson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PATTERSON'), Title='HR Director', Email='jpatterson@example.com', Phone='(630) 555-0143', External_Id__c='SEED_2026_06_CON_PATTERSON_J'));
toInsert.add(new Contact(FirstName='David', LastName='Nguyen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Title='Small Business Owner', Email='dnguyen@example.com', Phone='(630) 555-0167', External_Id__c='SEED_2026_06_CON_NGUYEN_D'));
toInsert.add(new Contact(FirstName='Linda', LastName='Nguyen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NGUYEN'), Title='Teacher', Email='lnguyen@example.com', Phone='(630) 555-0168', External_Id__c='SEED_2026_06_CON_NGUYEN_L'));
toInsert.add(new Contact(FirstName='Sofia', LastName='Reyes', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Title='Product Manager', Email='sreyes@example.com', Phone='(312) 555-0189', External_Id__c='SEED_2026_06_CON_REYES_S'));
toInsert.add(new Contact(FirstName='Carlos', LastName='Reyes', AccountId=accIdByExtId.get('SEED_2026_06_ACC_REYES'), Title='Data Scientist', Email='creyes@example.com', Phone='(312) 555-0190', External_Id__c='SEED_2026_06_CON_REYES_C'));
toInsert.add(new Contact(FirstName='Adaeze', LastName='Okonkwo', AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), Title='Physician', Email='aokonkwo@example.com', Phone='(708) 555-0234', External_Id__c='SEED_2026_06_CON_OKONKWO_A'));
toInsert.add(new Contact(FirstName='Chidi', LastName='Okonkwo', AccountId=accIdByExtId.get('SEED_2026_06_ACC_OKONKWO'), Title='Nurse Practitioner', Email='cokonkwo@example.com', Phone='(708) 555-0235', External_Id__c='SEED_2026_06_CON_OKONKWO_C'));
toInsert.add(new Contact(FirstName='Wei', LastName='Lin', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), Title='Engineering Manager', Email='wlin@example.com', Phone='(847) 555-0156', External_Id__c='SEED_2026_06_CON_LIN_W'));
toInsert.add(new Contact(FirstName='Mei', LastName='Lin', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LIN'), Title='Pharmacist', Email='mlin@example.com', Phone='(847) 555-0157', External_Id__c='SEED_2026_06_CON_LIN_M'));
toInsert.add(new Contact(FirstName='Robert', LastName='Henderson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), Title='Retired Executive', Email='rhenderson@example.com', Phone='(847) 555-0289', External_Id__c='SEED_2026_06_CON_HENDERSON_R'));
toInsert.add(new Contact(FirstName='Margaret', LastName='Henderson', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HENDERSON'), Title='Board Member', Email='mhenderson@example.com', Phone='(847) 555-0290', External_Id__c='SEED_2026_06_CON_HENDERSON_M'));
toInsert.add(new Contact(FirstName='Elena', LastName='Velazquez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), Title='Cardiothoracic Surgeon', Email='evelazquez@example.com', Phone='(630) 555-0301', External_Id__c='SEED_2026_06_CON_VELAZQUEZ_E'));
toInsert.add(new Contact(FirstName='Marcus', LastName='Velazquez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_VELAZQUEZ'), Title='Litigation Partner', Email='mvelazquez@example.com', Phone='(630) 555-0302', External_Id__c='SEED_2026_06_CON_VELAZQUEZ_M'));
toInsert.add(new Contact(FirstName='Howard', LastName='Chen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), Title='Retired CFO', Email='hchen@example.com', Phone='(847) 555-0345', External_Id__c='SEED_2026_06_CON_CHEN_H'));
toInsert.add(new Contact(FirstName='Catherine', LastName='Chen', AccountId=accIdByExtId.get('SEED_2026_06_ACC_CHEN'), Title='Retired Educator', Email='cchen@example.com', Phone='(847) 555-0346', External_Id__c='SEED_2026_06_CON_CHEN_C'));
toInsert.add(new Contact(FirstName='Patrick', LastName='Brennan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), Title='Investment Banker', Email='pbrennan@example.com', Phone='(847) 555-0367', External_Id__c='SEED_2026_06_CON_BRENNAN_P'));
toInsert.add(new Contact(FirstName='Erin', LastName='Brennan', AccountId=accIdByExtId.get('SEED_2026_06_ACC_BRENNAN'), Title='Art Curator', Email='ebrennan@example.com', Phone='(847) 555-0368', External_Id__c='SEED_2026_06_CON_BRENNAN_E'));
toInsert.add(new Contact(FirstName='Arjun', LastName='Kapoor', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), Title='Founder, Retired CEO', Email='akapoor@example.com', Phone='(312) 555-0412', External_Id__c='SEED_2026_06_CON_KAPOOR_A'));
toInsert.add(new Contact(FirstName='Priya', LastName='Kapoor', AccountId=accIdByExtId.get('SEED_2026_06_ACC_KAPOOR'), Title='Philanthropist', Email='pkapoor@example.com', Phone='(312) 555-0413', External_Id__c='SEED_2026_06_CON_KAPOOR_P'));
toInsert.add(new Contact(FirstName='William', LastName='Sutherland III', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SUTHERLAND'), Title='Trust Beneficiary', Email='wsutherland@example.com', Phone='(847) 555-0445', External_Id__c='SEED_2026_06_CON_SUTHERLAND_W'));
toInsert.add(new Contact(FirstName='Kwame', LastName='Asante', AccountId=accIdByExtId.get('SEED_2026_06_ACC_ASANTE'), Title='Dermatologist', Email='kasante@example.com', Phone='(847) 555-0478', External_Id__c='SEED_2026_06_CON_ASANTE_K'));
toInsert.add(new Contact(FirstName='Ama', LastName='Asante', AccountId=accIdByExtId.get('SEED_2026_06_ACC_ASANTE'), Title='Foundation Director', Email='aasante@example.com', Phone='(847) 555-0479', External_Id__c='SEED_2026_06_CON_ASANTE_A'));
toInsert.add(new Contact(FirstName='Diego', LastName='Mendez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), Title='Marketing Coordinator', Email='dmendez@example.com', Phone='(708) 555-0512', External_Id__c='SEED_2026_06_CON_MENDEZ_D'));
toInsert.add(new Contact(FirstName='Camila', LastName='Mendez', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MENDEZ'), Title='Nurse', Email='cmendez@example.com', Phone='(708) 555-0513', External_Id__c='SEED_2026_06_CON_MENDEZ_C'));
toInsert.add(new Contact(FirstName='Sean', LastName='Walsh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WALSH'), Title='University Professor', Email='swalsh@example.com', Phone='(847) 555-0534', External_Id__c='SEED_2026_06_CON_WALSH_S'));
toInsert.add(new Contact(FirstName='Bridget', LastName='Walsh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WALSH'), Title='Librarian', Email='bwalsh@example.com', Phone='(847) 555-0535', External_Id__c='SEED_2026_06_CON_WALSH_B'));
toInsert.add(new Contact(FirstName='Raj', LastName='Singh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), Title='VP Engineering', Email='rsingh@example.com', Phone='(630) 555-0556', External_Id__c='SEED_2026_06_CON_SINGH_R'));
toInsert.add(new Contact(FirstName='Anjali', LastName='Singh', AccountId=accIdByExtId.get('SEED_2026_06_ACC_SINGH'), Title='Product Designer', Email='asingh@example.com', Phone='(630) 555-0557', External_Id__c='SEED_2026_06_CON_SINGH_A'));
toInsert.add(new Contact(FirstName='Ben', LastName='Reilly', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), Title='Founder & CEO', Email='breilly@lakeshore-coffee.example', Phone='(312) 555-0601', External_Id__c='SEED_2026_06_CON_LAKESHORE_B'));
toInsert.add(new Contact(FirstName='Sarah', LastName='Reilly', AccountId=accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'), Title='COO', Email='sreilly@lakeshore-coffee.example', Phone='(312) 555-0602', External_Id__c='SEED_2026_06_CON_LAKESHORE_S'));
toInsert.add(new Contact(FirstName='James', LastName='Whitfield', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), Title='Managing Partner', Email='jwhitfield@prairie-eng.example', Phone='(630) 555-0623', External_Id__c='SEED_2026_06_CON_PRAIRIE_J'));
toInsert.add(new Contact(FirstName='Rita', LastName='Patel', AccountId=accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'), Title='CFO', Email='rpatel@prairie-eng.example', Phone='(630) 555-0624', External_Id__c='SEED_2026_06_CON_PRAIRIE_R'));
toInsert.add(new Contact(FirstName='Dr. Steven', LastName='Park', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHSHORE'), Title='Managing Partner', Email='spark@northshore-dental.example', Phone='(847) 555-0645', External_Id__c='SEED_2026_06_CON_NORTHSHORE_S'));
toInsert.add(new Contact(FirstName='Maya', LastName='Goldberg', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), Title='CEO', Email='mgoldberg@greentech-solar.example', Phone='(630) 555-0667', External_Id__c='SEED_2026_06_CON_GREENTECH_M'));
toInsert.add(new Contact(FirstName='Tony', LastName='DeMarco', AccountId=accIdByExtId.get('SEED_2026_06_ACC_GREENTECH'), Title='CFO', Email='tdemarco@greentech-solar.example', Phone='(630) 555-0668', External_Id__c='SEED_2026_06_CON_GREENTECH_T'));
toInsert.add(new Contact(FirstName='Frank', LastName='Kowalski', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), Title='President', Email='fkowalski@midwest-logistics.example', Phone='(815) 555-0689', External_Id__c='SEED_2026_06_CON_MIDWEST_F'));
toInsert.add(new Contact(FirstName='Stephanie', LastName='Kowalski', AccountId=accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'), Title='VP Operations', Email='skowalski@midwest-logistics.example', Phone='(815) 555-0690', External_Id__c='SEED_2026_06_CON_MIDWEST_S'));
toInsert.add(new Contact(FirstName='Robert', LastName='Sterling', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), Title='CEO', Email='rsterling@sterling-mfg.example', Phone='(815) 555-0701', External_Id__c='SEED_2026_06_CON_STERLING_R'));
toInsert.add(new Contact(FirstName='Janet', LastName='Holt', AccountId=accIdByExtId.get('SEED_2026_06_ACC_STERLING'), Title='CFO', Email='jholt@sterling-mfg.example', Phone='(815) 555-0702', External_Id__c='SEED_2026_06_CON_STERLING_J'));
toInsert.add(new Contact(FirstName='David', LastName='Riverview', AccountId=accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'), Title='Founder & CEO', Email='driverview@riverview-prop.example', Phone='(312) 555-0723', External_Id__c='SEED_2026_06_CON_RIVERVIEW_D'));
toInsert.add(new Contact(FirstName='Dr. Lisa', LastName='Bahar', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), Title='CEO', Email='lbahar@wabash-health.example', Phone='(847) 555-0745', External_Id__c='SEED_2026_06_CON_WABASH_L'));
toInsert.add(new Contact(FirstName='Marcus', LastName='Heller', AccountId=accIdByExtId.get('SEED_2026_06_ACC_WABASH'), Title='CFO', Email='mheller@wabash-health.example', Phone='(847) 555-0746', External_Id__c='SEED_2026_06_CON_WABASH_M'));
toInsert.add(new Contact(FirstName='Tony', LastName='Costa', AccountId=accIdByExtId.get('SEED_2026_06_ACC_HALSTED'), Title='Owner', Email='tcosta@halsted-restaurants.example', Phone='(312) 555-0767', External_Id__c='SEED_2026_06_CON_HALSTED_T'));
toInsert.add(new Contact(FirstName='Greg', LastName='Beckman', AccountId=accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'), Title='CEO', Email='gbeckman@northbrook-supply.example', Phone='(847) 555-0789', External_Id__c='SEED_2026_06_CON_NORTHBROOK_G'));
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
