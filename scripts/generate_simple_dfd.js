const fs = require('fs');
const path = require('path');

// ==============================================================================
// 1. GENERATE DFD SVG (Simple Words & Crystal Clear Flow)
// ==============================================================================

function getSvgContent() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="aics-dfd-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 1180" width="1680" height="1180">
  <defs>
    <!-- Soft dropshadows -->
    <filter id="card-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.14" />
    </filter>
    <filter id="process-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#1d4ed8" flood-opacity="0.22" />
    </filter>
    <filter id="store-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.12" />
    </filter>

    <!-- Arrow markers -->
    <marker id="arrow-slate" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
    </marker>
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16a34a" />
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#d97706" />
    </marker>

    <!-- Gradients -->
    <linearGradient id="header-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="60%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>

    <linearGradient id="resident-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>

    <linearGradient id="admin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#3730a3" />
    </linearGradient>

    <linearGradient id="treasurer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d9488" />
      <stop offset="100%" stop-color="#0f766e" />
    </linearGradient>

    <linearGradient id="oversight-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
  </defs>

  <!-- ── CANVAS BACKGROUND ────────────────────────────────────────────────── -->
  <rect width="100%" height="100%" fill="#f1f5f9" />

  <!-- ── TOP BANNER ───────────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="1680" height="130" fill="url(#header-grad)" />

  <g id="header-content" transform="translate(45, 0)">
    <!-- Seal Icon Graphic -->
    <circle cx="45" cy="65" r="38" fill="#1e40af" stroke="#60a5fa" stroke-width="2.5" />
    <circle cx="45" cy="65" r="30" fill="#0f172a" />
    <path d="M 45 44 L 53 56 L 66 59 L 56 69 L 59 82 L 45 75 L 31 82 L 34 69 L 24 59 L 37 56 Z" fill="#fbbf24" />
    <circle cx="45" cy="65" r="12" fill="#2563eb" />
    <text x="45" y="69" fill="#ffffff" font-size="9" font-weight="900" font-family="sans-serif" text-anchor="middle">AICS</text>

    <!-- Main Title -->
    <text x="105" y="52" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="0.5">AICS SYSTEM • DATA FLOW DIAGRAM</text>
    <text x="105" y="78" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#93c5fd">Whole System Operational Data Flow (Level 1) • Simple &amp; Complete Process Overview</text>
    <text x="105" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#cbd5e1">Municipality of Daanbantayan, Cebu • MSWDO Social Welfare &amp; Office of the Municipal Treasurer</text>
  </g>

  <!-- Header Legend -->
  <g transform="translate(1310, 22)">
    <rect x="0" y="0" width="320" height="86" rx="8" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="14" y="20" fill="#93c5fd" font-size="10.5" font-weight="800" font-family="sans-serif">DIAGRAM NOTATION:</text>
    <!-- Item 1 -->
    <rect x="14" y="30" width="18" height="12" rx="3" fill="#0284c7" />
    <text x="38" y="40" fill="#ffffff" font-size="10.5" font-family="sans-serif">External Entity (User / Actor)</text>
    <!-- Item 2 -->
    <rect x="14" y="48" width="18" height="12" rx="6" fill="#1d4ed8" />
    <text x="38" y="58" fill="#ffffff" font-size="10.5" font-family="sans-serif">System Process (1.0 - 8.0)</text>
    <!-- Item 3 -->
    <path d="M 14 67 H 32 M 14 77 H 32" stroke="#ffffff" stroke-width="2" />
    <text x="38" y="75" fill="#ffffff" font-size="10.5" font-family="sans-serif">Data Store (D1 - D6 Database)</text>
  </g>

  <!-- ── DATA FLOW LINES & LABELS ─────────────────────────────────────────── -->
  <g id="flow-lines" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    
    <!-- 1. Resident -> Process 1.0 (Sign-up details & OTP) -->
    <path d="M 270 295 L 340 205" marker-end="url(#arrow-slate)" />
    <!-- 1b. Process 1.0 -> D1 (Save Account) -->
    <path d="M 570 205 L 670 205" marker-end="url(#arrow-slate)" />
    <!-- 1c. Process 1.0 -> Resident (Login Status & Token) -->
    <path d="M 340 220 L 270 315" marker-end="url(#arrow-blue)" stroke="#2563eb" stroke-dasharray="4,3" />

    <!-- 2. Resident -> Process 2.0 (Family & Purok Info) -->
    <path d="M 270 375 L 340 345" marker-end="url(#arrow-slate)" />
    <!-- 2b. Process 2.0 -> D2 (Save Beneficiary Record) -->
    <path d="M 570 345 L 670 345" marker-end="url(#arrow-slate)" />
    <!-- 2c. D2 -> Process 2.0 (Check Duplicates) -->
    <path d="M 670 360 L 570 360" marker-end="url(#arrow-slate)" />

    <!-- 3. Resident -> Process 3.0 (Assistance Request & ID) -->
    <path d="M 270 435 L 340 485" marker-end="url(#arrow-slate)" />
    <!-- 3b. Process 3.0 -> D3 (Save Request & Files) -->
    <path d="M 570 485 L 670 485" marker-end="url(#arrow-slate)" />

    <!-- 4. D3 -> Process 4.0 (Fetch Pending Claims) -->
    <path d="M 680 515 L 570 615" marker-end="url(#arrow-slate)" />
    <!-- 4b. D2 -> Process 4.0 (Fetch Profile) -->
    <path d="M 700 375 L 480 375 L 480 575" marker-end="url(#arrow-slate)" />
    <!-- 4c. Process 4.0 -> D3 (Save Assessment Notes) -->
    <path d="M 570 630 L 670 630 L 730 630 L 730 525" marker-end="url(#arrow-slate)" />

    <!-- 5. Process 4.0 -> Process 5.0 (Case Recommendation) -->
    <path d="M 455 655 L 455 685 L 1120 685 L 1120 535" marker-end="url(#arrow-slate)" />
    <!-- 5b. Admin -> Process 5.0 (Approval Decision & Amount) -->
    <path d="M 1340 295 L 1250 465" marker-end="url(#arrow-slate)" />
    <!-- 5c. Process 5.0 -> D3 (Set Status = 'Approved') -->
    <path d="M 1010 475 L 920 475" marker-end="url(#arrow-green)" stroke="#16a34a" />
    <!-- 5d. Process 5.0 -> D4 (Reserve Budget) -->
    <path d="M 1010 495 L 950 495 L 950 655 L 920 655" marker-end="url(#arrow-green)" stroke="#16a34a" />

    <!-- 6. D3 & D4 -> Process 6.0 (Approved Claim & Available Fund) -->
    <path d="M 800 515 L 800 655 L 1010 655" marker-end="url(#arrow-slate)" />
    <path d="M 920 670 L 1010 670" marker-end="url(#arrow-slate)" />
    <!-- 6b. Treasurer -> Process 6.0 (Prepare Voucher No. & Mode) -->
    <path d="M 1340 670 L 1240 660" marker-end="url(#arrow-slate)" />
    <!-- 6c. Process 6.0 -> D3 (Set 'Ready for Release') -->
    <path d="M 1080 615 L 1080 565 L 860 565 L 860 515" marker-end="url(#arrow-slate)" />
    <!-- 6d. Process 6.0 -> Oversight (Emergency Budget Request) -->
    <path d="M 1240 685 L 1300 685 L 1300 970 L 1340 970" marker-end="url(#arrow-amber)" stroke="#d97706" />

    <!-- 7. D3 & D4 -> Process 7.0 (Ready Voucher & Cash) -->
    <path d="M 815 515 L 815 835 L 1010 835" marker-end="url(#arrow-slate)" />
    <path d="M 800 705 L 800 850 L 1010 850" marker-end="url(#arrow-slate)" />
    <!-- 7b. Treasurer -> Process 7.0 (Confirm Payout) -->
    <path d="M 1340 735 L 1240 825" marker-end="url(#arrow-slate)" />
    <!-- 7c. Resident -> Process 7.0 (Valid ID & Signed Payroll) -->
    <path d="M 160 510 L 160 885 L 1010 885" marker-end="url(#arrow-slate)" />
    <!-- 7d. Process 7.0 -> Resident (Cash / Check Handover!) -->
    <path d="M 1010 900 L 140 900 L 140 510" marker-end="url(#arrow-green)" stroke="#16a34a" stroke-width="2.5" />
    <!-- 7e. Process 7.0 -> D3 (Set 'Released') -->
    <path d="M 1150 795 L 1150 550 L 920 550 L 920 515" marker-end="url(#arrow-slate)" />
    <!-- 7f. Process 7.0 -> D4 (Deduct Fund Balance) -->
    <path d="M 1010 820 L 940 820 L 940 690 L 920 690" marker-end="url(#arrow-slate)" />
    <!-- 7g. Process 7.0 -> D5 (Save Payout Record) -->
    <path d="M 1010 865 L 920 865" marker-end="url(#arrow-slate)" />

    <!-- 8. D5 & D6 -> Process 8.0 (Transactions & Logs) -->
    <path d="M 920 885 L 970 885 L 970 1010 L 1010 1010" marker-end="url(#arrow-slate)" />
    <path d="M 920 1025 L 1010 1025" marker-end="url(#arrow-slate)" />
    <!-- 8b. System -> D6 (Save Audit Log) -->
    <path d="M 1010 1040 L 920 1040" marker-end="url(#arrow-slate)" />
    <!-- 8c. Process 8.0 -> Resident (Status Alerts & SMS) -->
    <path d="M 1010 1055 L 120 1055 L 120 510" marker-end="url(#arrow-blue)" stroke="#2563eb" stroke-dasharray="4,3" />
    <!-- 8d. Process 8.0 -> Admin & Treasurer (Dashboard Alerts) -->
    <path d="M 1240 1000 L 1310 1000 L 1310 390 L 1340 390" marker-end="url(#arrow-slate)" />
    <path d="M 1240 1015 L 1320 1015 L 1320 745 L 1340 745" marker-end="url(#arrow-slate)" />
    <!-- 8e. Process 8.0 -> Mayor & COA (Liquidation Reports) -->
    <path d="M 1240 1035 L 1340 1035" marker-end="url(#arrow-green)" stroke="#16a34a" stroke-width="2.2" />
  </g>

  <!-- ── SIMPLE DATA FLOW TEXT LABELS ────────────────────────────────────── -->
  <g id="flow-badges" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700">
    <!-- Step 1 -->
    <rect x="235" y="235" width="120" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="295" y="249" fill="#1e293b" text-anchor="middle">Sign-up details &amp; OTP</text>

    <rect x="585" y="195" width="75" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="622" y="209" fill="#1e293b" text-anchor="middle">Save Account</text>

    <rect x="235" y="265" width="115" height="20" rx="4" fill="#eff6ff" stroke="#93c5fd" />
    <text x="292" y="279" fill="#1d4ed8" text-anchor="middle">Login Token &amp; Status</text>

    <!-- Step 2 -->
    <rect x="230" y="338" width="110" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="285" y="352" fill="#1e293b" text-anchor="middle">Family &amp; Purok info</text>

    <rect x="580" y="335" width="80" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="620" y="349" fill="#1e293b" text-anchor="middle">Save Profile</text>

    <!-- Step 3 -->
    <rect x="225" y="440" width="125" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="287" y="454" fill="#1e293b" text-anchor="middle">Medical/Burial Request</text>

    <rect x="580" y="475" width="80" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="620" y="489" fill="#1e293b" text-anchor="middle">Save Request</text>

    <!-- Step 4 & 5 -->
    <rect x="1245" y="360" width="105" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1297" y="374" fill="#1e293b" text-anchor="middle">Approve or Decline</text>

    <rect x="935" y="465" width="70" height="20" rx="4" fill="#ecfdf5" stroke="#a7f3d0" />
    <text x="970" y="479" fill="#065f46" text-anchor="middle">Approved (₱)</text>

    <rect x="705" y="672" width="125" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="767" y="686" fill="#1e293b" text-anchor="middle">Case Recommendation</text>

    <!-- Step 6 -->
    <rect x="1245" y="652" width="95" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1292" y="666" fill="#1e293b" text-anchor="middle">Voucher Details</text>

    <rect x="935" y="645" width="75" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="972" y="659" fill="#1e293b" text-anchor="middle">Check Budget</text>

    <rect x="870" y="555" width="105" height="20" rx="4" fill="#eff6ff" stroke="#93c5fd" />
    <text x="922" y="569" fill="#1d4ed8" text-anchor="middle">Ready for Release</text>

    <!-- Step 7 -->
    <rect x="195" y="875" width="130" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="260" y="889" fill="#1e293b" text-anchor="middle">Valid ID &amp; Signed Payroll</text>

    <rect x="225" y="908" width="150" height="20" rx="4" fill="#dcfce7" stroke="#86efac" />
    <text x="300" y="922" fill="#166534" text-anchor="middle">Cash / Check Payout (₱)</text>

    <rect x="930" y="855" width="75" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="967" y="869" fill="#1e293b" text-anchor="middle">Save Payout</text>

    <!-- Step 8 -->
    <rect x="340" y="1045" width="130" height="20" rx="4" fill="#eff6ff" stroke="#bfdbfe" />
    <text x="405" y="1059" fill="#1e40af" text-anchor="middle">Status Alerts &amp; SMS</text>

    <rect x="1245" y="1025" width="100" height="20" rx="4" fill="#dcfce7" stroke="#86efac" />
    <text x="1295" y="1039" fill="#166534" text-anchor="middle">COA / DSWD Reports</text>
  </g>

  <!-- ── EXTERNAL ENTITIES (Simple & Clear Cards) ──────────────────────────── -->
  <g id="entities" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- 1. RESIDENT / BENEFICIARY -->
    <g transform="translate(50, 260)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="220" height="250" rx="12" fill="#ffffff" stroke="#0284c7" stroke-width="2" />
      <rect x="0" y="0" width="220" height="44" rx="12" fill="url(#resident-grad)" />
      <rect x="0" y="32" width="220" height="12" fill="url(#resident-grad)" />
      <text x="110" y="22" fill="#ffffff" font-size="10.5" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="110" y="38" fill="#e0f2fe" font-size="13" font-weight="800" text-anchor="middle">Resident / Beneficiary</text>
      
      <g transform="translate(16, 62)" font-size="11.5" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#0369a1">Role: Applicant / Claimant</text>
        <text x="0" y="24">• Signs up &amp; verifies OTP</text>
        <text x="0" y="46">• Fills family &amp; Purok profile</text>
        <text x="0" y="68">• Submits Medical / Burial claim</text>
        <text x="0" y="90">• Uploads doctor bills &amp; valid ID</text>
        <text x="0" y="112">• Tracks status on mobile/web</text>
        <text x="0" y="134">• Signs payroll &amp; receives cash</text>
        <text x="0" y="156">• Gets alerts &amp; announcements</text>
      </g>
    </g>

    <!-- 2. MSWDO ADMIN / SOCIAL WORKER -->
    <g transform="translate(1340, 195)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="250" rx="12" fill="#ffffff" stroke="#4f46e5" stroke-width="2" />
      <rect x="0" y="0" width="240" height="44" rx="12" fill="url(#admin-grad)" />
      <rect x="0" y="32" width="240" height="12" fill="url(#admin-grad)" />
      <text x="120" y="22" fill="#ffffff" font-size="10.5" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="38" fill="#e0e7ff" font-size="13" font-weight="800" text-anchor="middle">MSWDO Admin / Caseworker</text>
      
      <g transform="translate(16, 62)" font-size="11.5" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#4338ca">Role: Reviewer &amp; Approver</text>
        <text x="0" y="24">• Activates resident accounts</text>
        <text x="0" y="46">• Checks duplicate records</text>
        <text x="0" y="68">• Interviews applicant</text>
        <text x="0" y="90">• Reviews uploaded proofs</text>
        <text x="0" y="112">• Approves or declines claims</text>
        <text x="0" y="134">• Sets cash grant amount (₱)</text>
        <text x="0" y="156">• Broadcasts announcements</text>
      </g>
    </g>

    <!-- 3. MUNICIPAL TREASURER -->
    <g transform="translate(1340, 565)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="250" rx="12" fill="#ffffff" stroke="#0d9488" stroke-width="2" />
      <rect x="0" y="0" width="240" height="44" rx="12" fill="url(#treasurer-grad)" />
      <rect x="0" y="32" width="240" height="12" fill="url(#treasurer-grad)" />
      <text x="120" y="22" fill="#ffffff" font-size="10.5" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="38" fill="#ccfbf1" font-size="13" font-weight="800" text-anchor="middle">Municipal Treasurer</text>
      
      <g transform="translate(16, 62)" font-size="11.5" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#0f766e">Role: Disbursing Officer</text>
        <text x="0" y="24">• Checks available fund budget</text>
        <text x="0" y="46">• Prepares Disbursement Voucher</text>
        <text x="0" y="68">• Marks ready for release</text>
        <text x="0" y="90">• Checks physical ID in person</text>
        <text x="0" y="112">• Collects payroll signature</text>
        <text x="0" y="134">• Hands over cash or check</text>
        <text x="0" y="156">• Deducts balance from ledger</text>
      </g>
    </g>

    <!-- 4. MAYOR, COA & DSWD -->
    <g transform="translate(1340, 900)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="175" rx="12" fill="#ffffff" stroke="#d97706" stroke-width="2" />
      <rect x="0" y="0" width="240" height="44" rx="12" fill="url(#oversight-grad)" />
      <rect x="0" y="32" width="240" height="12" fill="url(#oversight-grad)" />
      <text x="120" y="22" fill="#ffffff" font-size="10.5" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="38" fill="#fef3c7" font-size="13" font-weight="800" text-anchor="middle">Mayor, COA &amp; DSWD</text>
      
      <g transform="translate(16, 62)" font-size="11.5" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#b45309">Role: Audit &amp; Approvals</text>
        <text x="0" y="24">• Approves budget replenishments</text>
        <text x="0" y="46">• Audits liquidation reports</text>
        <text x="0" y="68">• Checks regulatory compliance</text>
        <text x="0" y="90">• Inspects quarterly spending</text>
      </g>
    </g>
  </g>

  <!-- ── CENTRAL PROCESSES (1.0 to 8.0) ───────────────────────────────────── -->
  <g id="processes" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- 1.0 Register & Login -->
    <g transform="translate(340, 160)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 1.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">AUTH</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Register &amp; Login</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Sign-up • OTP • Account Gating</text>
    </g>

    <!-- 2.0 Beneficiary Profiling -->
    <g transform="translate(340, 300)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 2.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">PROFILE</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Beneficiary Profiling</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Purok Tagging • PWD / Senior / 4Ps</text>
    </g>

    <!-- 3.0 Apply for Assistance -->
    <g transform="translate(340, 440)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 3.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">APPLY</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Apply for Assistance</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Medical / Burial Claim &amp; Proofs</text>
    </g>

    <!-- 4.0 Social Worker Assessment -->
    <g transform="translate(340, 580)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 4.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">EVALUATE</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Case Assessment</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Caseworker Notes &amp; Findings</text>
    </g>

    <!-- 5.0 Review & Grant Approval -->
    <g transform="translate(1010, 440)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 5.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">APPROVE</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Review &amp; Approval</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Set Grant Amount (₱) • Reserve Budget</text>
    </g>

    <!-- 6.0 Prepare Voucher & Check Budget -->
    <g transform="translate(1010, 620)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 6.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">VOUCHER</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Prepare Voucher</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Assign DV-YYYY-XXXX • Check Liquidity</text>
    </g>

    <!-- 7.0 Disburse Cash & Sync Ledger -->
    <g transform="translate(1010, 800)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 7.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">PAYOUT</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Release Assistance</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Handover Cash/Check • Deduct Balance</text>
    </g>

    <!-- 8.0 Alerts & COA Reports -->
    <g transform="translate(1010, 980)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="230" height="80" rx="14" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="230" height="24" rx="12" fill="#172554" />
      <rect x="0" y="12" width="230" height="12" fill="#172554" />
      <text x="12" y="17" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 8.0</text>
      <text x="218" y="17" fill="#60a5fa" font-size="9.5" font-weight="700" text-anchor="end">REPORTS</text>
      <text x="115" y="46" fill="#ffffff" font-size="13.5" font-weight="800" text-anchor="middle">Reports &amp; Alerts</text>
      <text x="115" y="65" fill="#bfdbfe" font-size="10" font-weight="500" text-anchor="middle">Audit Logs • Push Alerts • COA Reports</text>
    </g>
  </g>

  <!-- ── DATA STORES (D1 to D6) ───────────────────────────────────────────── -->
  <g id="stores" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- D1: User Accounts -->
    <g transform="translate(670, 175)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D1</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">User Accounts</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">profiles &amp; auth credentials</text>
    </g>

    <!-- D2: Beneficiary Records -->
    <g transform="translate(670, 315)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D2</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">Beneficiary Records</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">beneficiaries &amp; Purok tags</text>
    </g>

    <!-- D3: Assistance Requests -->
    <g transform="translate(670, 455)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D3</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">Assistance Requests</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">requests &amp; uploaded proofs</text>
    </g>

    <!-- D4: Fund Budgets -->
    <g transform="translate(670, 635)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D4</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">Fund Budgets</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">funds (Medical &amp; Burial pools)</text>
    </g>

    <!-- D5: Payouts & Ledger -->
    <g transform="translate(670, 825)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D5</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">Payouts &amp; Ledger</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">payouts &amp; fund_transactions</text>
    </g>

    <!-- D6: Notifications & Logs -->
    <g transform="translate(670, 995)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="250" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="60" x2="250" y2="60" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="250" height="60" fill="#ffffff" />
      <rect x="0" y="0" width="42" height="60" fill="#0f172a" />
      <text x="21" y="36" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D6</text>
      <text x="56" y="26" fill="#0f172a" font-size="13" font-weight="800">Notifications &amp; Logs</text>
      <text x="56" y="44" fill="#64748b" font-size="10.5">notifications &amp; system_logs</text>
    </g>
  </g>

  <!-- ── BOTTOM FOOTER ─────────────────────────────────────────────────────── -->
  <rect x="0" y="1120" width="1680" height="60" fill="#0f172a" />

  <g transform="translate(50, 1155)">
    <circle cx="6" cy="-2" r="5" fill="#22c55e" />
    <text x="20" y="2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="0.5">AICS DATA FLOW DIAGRAM • WHOLE SYSTEM ARCHITECTURE</text>
  </g>

  <g transform="translate(1630, 1155)">
    <text x="0" y="2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="600" fill="#94a3b8" text-anchor="end">Municipality of Daanbantayan, Cebu • Department of Social Welfare &amp; Development</text>
  </g>
</svg>`;
}

// ==============================================================================
// 2. GENERATE INTERACTIVE HTML VIEWER (Simple words & clear controls)
// ==============================================================================

function getHtmlContent(svgContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AICS Whole System Data Flow Diagram (DFD) • Municipality of Daanbantayan</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --primary: #1d4ed8;
      --primary-hover: #1e40af;
      --success: #16a34a;
      --danger: #dc2626;
      --accent: #0284c7;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      padding: 24px;
      line-height: 1.5;
    }

    .container {
      max-width: 1760px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%);
      color: white;
      padding: 24px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-titles h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .header-titles p {
      font-size: 13.5px;
      color: #93c5fd;
      margin-top: 4px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 9px 16px;
      font-size: 12.5px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.22);
      border-color: rgba(255, 255, 255, 0.45);
    }

    .btn-primary {
      background: #2563eb;
      border-color: #3b82f6;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }

    .chart-wrapper {
      padding: 24px 20px;
      background: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
    }

    #svg-container {
      transition: transform 0.2s ease;
      transform-origin: top center;
    }

    svg {
      max-width: 100%;
      height: auto;
      filter: drop-shadow(0 10px 25px rgba(0, 0, 0, 0.08));
      border-radius: 8px;
      background: #ffffff;
    }

    /* Explanation Cards */
    .details-panel {
      padding: 32px 40px;
      background: #ffffff;
    }

    .specs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
    }

    .spec-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 22px 24px;
      background: #ffffff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .spec-card h3 {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .spec-card ul {
      list-style-type: none;
      font-size: 13px;
      color: #475569;
    }

    .spec-card li {
      margin-bottom: 10px;
      padding-left: 16px;
      position: relative;
    }

    .spec-card li::before {
      content: "▸";
      color: #2563eb;
      font-weight: bold;
      position: absolute;
      left: 0;
    }

    .badge-tag {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      background: #dbeafe;
      color: #1e40af;
      margin-right: 6px;
    }

    footer.site-footer {
      padding: 18px 40px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="header-titles">
        <h1>AICS Whole System Data Flow Diagram (DFD Level 1)</h1>
        <p>AICS Request Management &amp; Beneficiary Information System • Municipality of Daanbantayan, Cebu</p>
      </div>
      <div class="toolbar">
        <button class="action-btn" onclick="zoomIn()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          Zoom In
        </button>
        <button class="action-btn" onclick="zoomOut()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          Zoom Out
        </button>
        <button class="action-btn" onclick="resetZoom()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset View
        </button>
        <button class="action-btn" onclick="downloadSVG()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download SVG
        </button>
        <button class="action-btn btn-primary" onclick="downloadPNG()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M20.4 14.5L16 10 4 20"/></svg>
          Export PNG Image
        </button>
        <button class="action-btn" onclick="window.print()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / PDF
        </button>
      </div>
    </header>

    <!-- Canvas -->
    <div class="chart-wrapper">
      <div id="svg-container">
        ${svgContent}
      </div>
    </div>

    <!-- Technical Architecture Panel in Simple Words -->
    <div class="details-panel">
      <div class="specs-grid">
        <div class="spec-card">
          <h3>
            <span class="badge-tag">DATA STORES</span>
            Database Repositories (D1 - D6)
          </h3>
          <ul>
            <li><strong>D1: User Accounts (profiles):</strong> Logins, emails, roles (resident, admin, treasurer), and approval status (is_active).</li>
            <li><strong>D2: Beneficiary Records (beneficiaries):</strong> Resident master records, Purok location in Barangay Pajo, income, and tags (PWD, Senior, 4Ps).</li>
            <li><strong>D3: Assistance Requests (requests):</strong> Medical and Burial assistance applications, status tracking, and uploaded proof documents.</li>
            <li><strong>D4: Fund Budgets (funds):</strong> Allocated money per assistance category, current balance, and low-balance alert thresholds.</li>
            <li><strong>D5: Payouts &amp; Ledger (payouts):</strong> Disbursement receipts, signed release records, and transaction history.</li>
            <li><strong>D6: Notifications &amp; Logs (system_logs):</strong> In-app message alerts, SMS announcements, and security audit logs.</li>
          </ul>
        </div>

        <div class="spec-card">
          <h3>
            <span class="badge-tag">ACTORS</span>
            System Users &amp; Roles
          </h3>
          <ul>
            <li><strong>Resident / Beneficiary:</strong> Signs up, fills out beneficiary profile, applies for crisis assistance, uploads bills/IDs, and claims cash/check.</li>
            <li><strong>MSWDO Admin / Worker:</strong> Activates resident accounts, checks for duplicates, investigates claims, and approves grant amounts (₱).</li>
            <li><strong>Municipal Treasurer:</strong> Checks available budget balance, prepares Disbursement Vouchers, verifies recipient in person, and releases cash.</li>
            <li><strong>Mayor &amp; COA Auditors:</strong> Refills budget when funds are low, reviews quarterly spending, and audits liquidation reports.</li>
          </ul>
        </div>

        <div class="spec-card">
          <h3>
            <span class="badge-tag">PROCESSES</span>
            8 Core Operations in Simple Words
          </h3>
          <ul>
            <li><strong>1.0 Register &amp; Login:</strong> Signs up user, verifies 6-digit OTP, checks account active status.</li>
            <li><strong>2.0 Beneficiary Profiling:</strong> Saves family and Purok info, tags vulnerabilities, prevents duplicate entries.</li>
            <li><strong>3.0 Apply for Assistance:</strong> Ingests Medical or Burial requests with hospital bills, funeral contracts, and valid IDs.</li>
            <li><strong>4.0 Case Assessment:</strong> Social worker interviews claimant, reviews documents, and writes evaluation notes.</li>
            <li><strong>5.0 Review &amp; Approval:</strong> Admin approves claim, sets cash grant amount (₱), and earmarks budget.</li>
            <li><strong>6.0 Prepare Voucher:</strong> Treasurer creates Disbursement Voucher (DV) number and checks fund balance.</li>
            <li><strong>7.0 Release Assistance:</strong> Hands over cash/check, collects signature on payroll, and deducts fund balance.</li>
            <li><strong>8.0 Reports &amp; Alerts:</strong> Sends SMS/app notifications, logs security events, and prints COA liquidation reports.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="site-footer">
      <div>© 2026 AICS Request Management &amp; Beneficiary Information System • Municipality of Daanbantayan, Cebu</div>
      <div>Level 1 Data Flow Diagram (DFD) • Software Engineering Specification for MSWDO &amp; Municipal Treasury</div>
    </footer>
  </div>

  <!-- Interactive Controls -->
  <script>
    let currentZoom = 1;
    const container = document.getElementById('svg-container');

    function zoomIn() {
      currentZoom = Math.min(currentZoom + 0.15, 2.5);
      container.style.transform = \`scale(\${currentZoom})\`;
    }

    function zoomOut() {
      currentZoom = Math.max(currentZoom - 0.15, 0.5);
      container.style.transform = \`scale(\${currentZoom})\`;
    }

    function resetZoom() {
      currentZoom = 1;
      container.style.transform = 'scale(1)';
    }

    function downloadSVG() {
      const svg = document.getElementById('aics-dfd-svg');
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      if (!source.match(/^<\\?xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\\r\\n' + source;
      }
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aics_data_flow_diagram.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function downloadPNG() {
      const svg = document.getElementById('aics-dfd-svg');
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      canvas.width = 1680 * 2;
      canvas.height = 1180 * 2;

      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'aics_data_flow_diagram.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 3. EXECUTE GENERATOR SCRIPT
// ==============================================================================

function run() {
  const rootDir = path.resolve(__dirname, '..');
  const svg = getSvgContent();
  const html = getHtmlContent(svg);

  // Write SVG file
  const svgPath = path.join(rootDir, 'data_flow_diagram.svg');
  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log('✓ Successfully generated data_flow_diagram.svg at:', svgPath);

  // Write HTML file
  const htmlPath = path.join(rootDir, 'data_flow_diagram.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✓ Successfully generated data_flow_diagram.html at:', htmlPath);

  console.log('\nAll simple-word DFD artifacts generated successfully!');
}

run();
