// Layer 6 — Seed AccountAccountRelation records (household linkages)
// Links related accounts together to demonstrate household relationships
// PartyRoleRelation IDs queried from this org:
//   Organization-Client-AAR: 0zlg70000000MS0AAM
//   Client-Organization-AAR: 0zlg70000000MRzAAM

Map<String, Id> accIdByExtId = new Map<String, Id>();
for (Account a : [SELECT Id, External_Id__c FROM Account WHERE External_Id__c LIKE 'SEED_2026_06_ACC_%']) {
    accIdByExtId.put(a.External_Id__c, a.Id);
}

// Look up the AAR PartyRoleRelation ID dynamically
Id prrId = null;
List<SObject> prrs = Database.query('SELECT Id FROM PartyRoleRelation WHERE Name = \'Organization-Client-AAR\' LIMIT 1');
if (!prrs.isEmpty()) {
    prrId = (Id) prrs[0].get('Id');
}
if (prrId == null) {
    System.debug('No Organization-Client-AAR PartyRoleRelation found. Aborting Layer 6.');
    return;
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
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
    ));
}

// Lakeshore and Halsted — both restaurant industry, business partners
if (accIdByExtId.containsKey('SEED_2026_06_ACC_LAKESHORE') && accIdByExtId.containsKey('SEED_2026_06_ACC_HALSTED')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_LAKESHORE'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_HALSTED'),
        IsActive = true,
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
    ));
}

// Prairie Engineering and Riverview Properties — engineering firm for developer
if (accIdByExtId.containsKey('SEED_2026_06_ACC_PRAIRIE') && accIdByExtId.containsKey('SEED_2026_06_ACC_RIVERVIEW')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_PRAIRIE'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_RIVERVIEW'),
        IsActive = true,
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
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
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
    ));
}

// Sterling and Midwest Logistics — supply chain relationship
if (accIdByExtId.containsKey('SEED_2026_06_ACC_STERLING') && accIdByExtId.containsKey('SEED_2026_06_ACC_MIDWEST')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_STERLING'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_MIDWEST'),
        IsActive = true,
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
    ));
}

// Northbrook supplies Sterling Manufacturing
if (accIdByExtId.containsKey('SEED_2026_06_ACC_NORTHBROOK') && accIdByExtId.containsKey('SEED_2026_06_ACC_STERLING')) {
    toInsert.add(new AccountAccountRelation(
        AccountId = accIdByExtId.get('SEED_2026_06_ACC_NORTHBROOK'),
        RelatedAccountId = accIdByExtId.get('SEED_2026_06_ACC_STERLING'),
        IsActive = true,
        HierarchyType = 'Peer',
        PartyRoleRelationId = prrId
    ));
}

if (!toInsert.isEmpty()) {
    insert toInsert;
    System.debug('Inserted ' + toInsert.size() + ' account relationships.');
}
