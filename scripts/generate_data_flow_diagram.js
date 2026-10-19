const fs = require('fs');
const path = require('path');

// ==============================================================================
// 1. GENERATE DFD SVG (Level 1 Whole System Data Flow Diagram)
// ==============================================================================

function getSvgContent() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="aics-dfd-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1760 1260" width="1760" height="1260">
  <defs>
    <!-- Soft dropshadows for entities and processes -->
    <filter id="card-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.18" />
    </filter>
    <filter id="process-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1d4ed8" flood-opacity="0.25" />
    </filter>
    <filter id="store-shadow" x="-8%" y="-8%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.15" />
    </filter>

    <!-- Arrowhead markers -->
    <marker id="dfd-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
    </marker>
    <marker id="blue-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
    </marker>
    <marker id="green-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16a34a" />
    </marker>
    <marker id="orange-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ea580c" />
    </marker>

    <!-- Gradients -->
    <linearGradient id="header-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>

    <linearGradient id="entity-resident" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>

    <linearGradient id="entity-admin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#3730a3" />
    </linearGradient>

    <linearGradient id="entity-treasurer" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d9488" />
      <stop offset="100%" stop-color="#0f766e" />
    </linearGradient>

    <linearGradient id="entity-oversight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
  </defs>

  <!-- ── BACKGROUND CANVAS ────────────────────────────────────────────────── -->
  <rect width="100%" height="100%" fill="#f8fafc" />

  <!-- ── TOP HEADER BANNER ────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="1760" height="135" fill="url(#header-grad)" />

  <g id="header-text" transform="translate(50, 0)">
    <!-- Municipal Seal / Crest Graphic -->
    <g transform="translate(0, 22)">
      <circle cx="45" cy="45" r="42" fill="#1e40af" stroke="#60a5fa" stroke-width="2.5" />
      <circle cx="45" cy="45" r="35" fill="#0f172a" />
      <path d="M 45 22 L 54 36 L 68 39 L 57 50 L 60 65 L 45 57 L 30 65 L 33 50 L 22 39 L 36 36 Z" fill="#fbbf24" opacity="0.9" />
      <circle cx="45" cy="45" r="14" fill="#2563eb" />
      <text x="45" y="49" fill="#ffffff" font-size="11" font-weight="900" font-family="sans-serif" text-anchor="middle">AICS</text>
    </g>

    <text x="110" y="52" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="0.5">AICS REQUEST MANAGEMENT &amp; BENEFICIARY INFORMATION SYSTEM</text>
    <text x="110" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#93c5fd" letter-spacing="0.3">Level 1 Master System Data Flow Diagram (DFD) • Complete End-to-End Operational Architecture</text>
    <text x="110" y="104" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#cbd5e1">Municipality of Daanbantayan, Province of Cebu • MSWDO Social Welfare &amp; Office of the Municipal Treasurer</text>
  </g>

  <!-- Header Legend Box -->
  <g transform="translate(1360, 20)">
    <rect x="0" y="0" width="350" height="95" rx="8" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="15" y="22" fill="#93c5fd" font-size="11" font-weight="800" font-family="sans-serif" letter-spacing="0.5">DFD NOTATION STANDARD (Gane-Sarson):</text>
    <!-- Legend item 1: External Entity -->
    <rect x="15" y="34" width="22" height="14" rx="3" fill="#0284c7" />
    <text x="45" y="46" fill="#f8fafc" font-size="11" font-family="sans-serif">External Entity (Actor / Boundary)</text>
    <!-- Legend item 2: Process -->
    <rect x="15" y="54" width="22" height="14" rx="7" fill="#1d4ed8" />
    <text x="45" y="66" fill="#f8fafc" font-size="11" font-family="sans-serif">System Process (1.0 - 8.0)</text>
    <!-- Legend item 3: Data Store -->
    <path d="M 15 76 H 37 M 15 88 H 37" stroke="#0f172a" stroke-width="2.5" />
    <rect x="15" y="78" width="22" height="8" fill="#e2e8f0" />
    <text x="45" y="86" fill="#f8fafc" font-size="11" font-family="sans-serif">Data Store (D1 - D6 Database Tables)</text>
  </g>

  <!-- ── FLOW LINES GROUP (Connectors & Labels) ───────────────────────────── -->
  <g id="data-flows" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    
    <!-- 1. Resident -> Process 1.0 (Credentials & OTP) -->
    <path d="M 280 290 L 350 210" marker-end="url(#dfd-arrow)" />
    <!-- 1b. Process 1.0 -> D1 (Store User Auth) -->
    <path d="M 590 210 L 690 210" marker-end="url(#dfd-arrow)" />
    <!-- 1c. Process 1.0 -> Resident (Auth Status / JWT) -->
    <path d="M 350 225 L 280 310" marker-end="url(#blue-arrow)" stroke="#2563eb" stroke-dasharray="4,3" />

    <!-- 2. Resident -> Process 2.0 (Demographics & Vulnerabilities) -->
    <path d="M 280 370 L 350 350" marker-end="url(#dfd-arrow)" />
    <!-- 2b. Process 2.0 -> D2 (Save Beneficiary Registry) -->
    <path d="M 590 350 L 690 350" marker-end="url(#dfd-arrow)" />
    <!-- 2c. D2 -> Process 2.0 (Duplicate Check Queries) -->
    <path d="M 690 365 L 590 365" marker-end="url(#dfd-arrow)" />

    <!-- 3. Resident -> Process 3.0 (Assistance Request & Documents) -->
    <path d="M 280 430 L 350 490" marker-end="url(#dfd-arrow)" />
    <!-- 3b. Process 3.0 -> D3 (Insert Request & Upload Documents) -->
    <path d="M 590 490 L 690 490" marker-end="url(#dfd-arrow)" />

    <!-- 4. D3 -> Process 4.0 (Fetch Pending Claim & Scanned Proofs) -->
    <path d="M 700 525 L 590 630" marker-end="url(#dfd-arrow)" />
    <!-- 4b. D2 -> Process 4.0 (Fetch Beneficiary Profile & Family Size) -->
    <path d="M 720 385 L 500 385 L 500 590" marker-end="url(#dfd-arrow)" />
    <!-- 4c. Process 4.0 -> D3 (Save Assessment Notes & Case Findings) -->
    <path d="M 590 645 L 690 645 L 750 645 L 750 535" marker-end="url(#dfd-arrow)" />

    <!-- 5. Process 4.0 -> Process 5.0 (Evaluated Case Recommendation) -->
    <path d="M 470 670 L 470 705 L 1170 705 L 1170 540" marker-end="url(#dfd-arrow)" />
    <!-- 5b. Admin -> Process 5.0 (Approval Decision & Approved Amount) -->
    <path d="M 1400 310 L 1290 470" marker-end="url(#dfd-arrow)" />
    <!-- 5c. Process 5.0 -> D3 (Update Status = 'Approved' / 'Declined') -->
    <path d="M 1050 480 L 950 480" marker-end="url(#green-arrow)" stroke="#16a34a" />
    <!-- 5d. Process 5.0 -> D4 (Pre-Encumber Category Allocation) -->
    <path d="M 1050 500 L 980 500 L 980 670 L 950 670" marker-end="url(#green-arrow)" stroke="#16a34a" />

    <!-- 6. D3 & D4 -> Process 6.0 (Approved Requests & Liquidity Balance) -->
    <path d="M 830 525 L 830 670 L 1050 670" marker-end="url(#dfd-arrow)" />
    <path d="M 950 685 L 1050 685" marker-end="url(#dfd-arrow)" />
    <!-- 6b. Treasurer -> Process 6.0 (Voucher Preparation & Payment Method) -->
    <path d="M 1400 690 L 1290 675" marker-end="url(#dfd-arrow)" />
    <!-- 6c. Process 6.0 -> D3 (Set release_status = 'Ready for Release') -->
    <path d="M 1120 630 L 1120 580 L 890 580 L 890 525" marker-end="url(#dfd-arrow)" />
    <!-- 6d. Process 6.0 -> Oversight (Emergency Budget Appropriation Request) -->
    <path d="M 1290 700 L 1350 700 L 1350 1020 L 1400 1020" marker-end="url(#orange-arrow)" stroke="#ea580c" />

    <!-- 7. D3 & D4 -> Process 7.0 (Ready Voucher & Available Balance) -->
    <path d="M 845 525 L 845 860 L 1050 860" marker-end="url(#dfd-arrow)" />
    <path d="M 830 720 L 830 875 L 1050 875" marker-end="url(#dfd-arrow)" />
    <!-- 7b. Treasurer -> Process 7.0 (Confirm Payout & Counter Signatures) -->
    <path d="M 1400 760 L 1290 850" marker-end="url(#dfd-arrow)" />
    <!-- 7c. Resident -> Process 7.0 (Physical ID & Signed Payroll Sheet) -->
    <path d="M 170 540 L 170 910 L 1050 910" marker-end="url(#dfd-arrow)" />
    <!-- 7d. Process 7.0 -> Resident (Physical Cash / Check Grant Handover) -->
    <path d="M 1050 925 L 150 925 L 150 540" marker-end="url(#green-arrow)" stroke="#16a34a" stroke-width="2.5" />
    <!-- 7e. Process 7.0 -> D3 (Set status = 'Released') -->
    <path d="M 1190 820 L 1190 565 L 950 565 L 950 525" marker-end="url(#dfd-arrow)" />
    <!-- 7f. Process 7.0 -> D4 (Deduct current_balance, increment total_released) -->
    <path d="M 1050 845 L 970 845 L 970 710 L 950 710" marker-end="url(#dfd-arrow)" />
    <!-- 7g. Process 7.0 -> D5 (Insert payouts & fund_transactions record) -->
    <path d="M 1050 890 L 950 890" marker-end="url(#dfd-arrow)" />

    <!-- 8. D5 & D6 -> Process 8.0 (Financial Ledger & Logged Audits) -->
    <path d="M 950 915 L 1010 915 L 1010 1040 L 1050 1040" marker-end="url(#dfd-arrow)" />
    <path d="M 950 1055 L 1050 1055" marker-end="url(#dfd-arrow)" />
    <!-- 8b. System -> D6 (Record immutable audit row) -->
    <path d="M 1050 1070 L 950 1070" marker-end="url(#dfd-arrow)" />
    <!-- 8c. Process 8.0 -> Resident (Real-time In-App Notifications) -->
    <path d="M 1050 1085 L 130 1085 L 130 540" marker-end="url(#blue-arrow)" stroke="#2563eb" stroke-dasharray="4,3" />
    <!-- 8d. Process 8.0 -> Admin & Treasurer (Financial Dashboards & Threshold Alerts) -->
    <path d="M 1290 1030 L 1370 1030 L 1370 410 L 1400 410" marker-end="url(#dfd-arrow)" />
    <path d="M 1290 1045 L 1380 1045 L 1380 770 L 1400 770" marker-end="url(#dfd-arrow)" />
    <!-- 8e. Process 8.0 -> Mayor & COA / DSWD (Regulatory Liquidation Reports) -->
    <path d="M 1290 1065 L 1400 1065" marker-end="url(#green-arrow)" stroke="#16a34a" stroke-width="2.5" />
  </g>

  <!-- ── DATA FLOW TEXT LABELS (Badges) ──────────────────────────────────── -->
  <g id="flow-labels" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700">
    <!-- Flow 1 -->
    <rect x="250" y="235" width="105" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="302" y="248" fill="#1e293b" text-anchor="middle">Credentials &amp; OTP</text>

    <rect x="605" y="198" width="70" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="640" y="211" fill="#1e293b" text-anchor="middle">Store Profile</text>

    <rect x="250" y="268" width="95" height="18" rx="4" fill="#eff6ff" stroke="#93c5fd" />
    <text x="297" y="281" fill="#1d4ed8" text-anchor="middle">Auth Status &amp; JWT</text>

    <!-- Flow 2 -->
    <rect x="245" y="340" width="100" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="295" y="353" fill="#1e293b" text-anchor="middle">Demographics Data</text>

    <rect x="600" y="338" width="85" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="642" y="351" fill="#1e293b" text-anchor="middle">Save Beneficiary</text>

    <!-- Flow 3 -->
    <rect x="240" y="445" width="115" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="297" y="458" fill="#1e293b" text-anchor="middle">Application &amp; Proofs</text>

    <rect x="600" y="478" width="85" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="642" y="491" fill="#1e293b" text-anchor="middle">Save Claim &amp; Docs</text>

    <!-- Flow 4 & 5 -->
    <rect x="1305" y="365" width="95" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1352" y="378" fill="#1e293b" text-anchor="middle">Approval / Decline</text>

    <rect x="965" y="468" width="80" height="18" rx="4" fill="#ecfdf5" stroke="#a7f3d0" />
    <text x="1005" y="481" fill="#065f46" text-anchor="middle">Set 'Approved'</text>

    <rect x="740" y="692" width="125" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="802" y="705" fill="#1e293b" text-anchor="middle">Approved Case File</text>

    <!-- Flow 6 -->
    <rect x="1300" y="668" width="95" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1347" y="681" fill="#1e293b" text-anchor="middle">Voucher Details</text>

    <rect x="965" y="658" width="75" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1002" y="671" fill="#1e293b" text-anchor="middle">Fund Liquidity</text>

    <rect x="900" y="568" width="105" height="18" rx="4" fill="#eff6ff" stroke="#93c5fd" />
    <text x="952" y="581" fill="#1d4ed8" text-anchor="middle">Ready for Release</text>

    <!-- Flow 7 -->
    <rect x="200" y="898" width="130" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="265" y="911" fill="#1e293b" text-anchor="middle">Gov ID &amp; Signed Payroll</text>

    <rect x="230" y="932" width="155" height="18" rx="4" fill="#dcfce7" stroke="#86efac" />
    <text x="307" y="945" fill="#166534" text-anchor="middle">Disbursed Cash / Check (₱)</text>

    <rect x="960" y="878" width="85" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" />
    <text x="1002" y="891" fill="#1e293b" text-anchor="middle">Insert Payouts</text>

    <!-- Flow 8 -->
    <rect x="350" y="1073" width="135" height="18" rx="4" fill="#eff6ff" stroke="#bfdbfe" />
    <text x="417" y="1086" fill="#1e40af" text-anchor="middle">Notifications &amp; Bulletins</text>

    <rect x="1300" y="1053" width="100" height="18" rx="4" fill="#dcfce7" stroke="#86efac" />
    <text x="1350" y="1066" fill="#166534" text-anchor="middle">COA / DSWD Reports</text>
  </g>

  <!-- ── EXTERNAL ENTITIES (Actors) ────────────────────────────────────────── -->
  <g id="external-entities" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- ENTITY 1: RESIDENT / BENEFICIARY -->
    <g transform="translate(60, 270)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="220" height="270" rx="12" fill="#ffffff" stroke="#0284c7" stroke-width="2" />
      <rect x="0" y="0" width="220" height="48" rx="12" fill="url(#entity-resident)" />
      <rect x="0" y="36" width="220" height="12" fill="url(#entity-resident)" />
      <text x="110" y="24" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="110" y="40" fill="#e0f2fe" font-size="13" font-weight="800" text-anchor="middle">Resident / Beneficiary</text>
      
      <!-- Subtitle & Action list -->
      <g transform="translate(16, 68)" font-size="11" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#0369a1">System Role: Applicant / Claimant</text>
        <text x="0" y="22">• Registers Account &amp; Verifies OTP</text>
        <text x="0" y="42">• Enrolls Beneficiary Profile &amp; Purok</text>
        <text x="0" y="62">• Declares Vulnerabilities (PWD/4Ps)</text>
        <text x="0" y="82">• Submits Medical / Burial Claim</text>
        <text x="0" y="102">• Uploads Indigency &amp; Hospital Bills</text>
        <text x="0" y="122">• Tracks Status via Mobile / Web</text>
        <text x="0" y="142">• Signs Payroll &amp; Receives Cash</text>
        <text x="0" y="162">• Receives In-App Announcements</text>
        <rect x="0" y="174" width="188" height="20" rx="4" fill="#f0f9ff" stroke="#bae6fd" />
        <text x="94" y="188" fill="#0284c7" font-size="10" font-weight="800" text-anchor="middle">PORTAL: /login • /resident</text>
      </g>
    </g>

    <!-- ENTITY 2: MSWDO CASEWORKER / ADMINISTRATOR -->
    <g transform="translate(1410, 200)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="270" rx="12" fill="#ffffff" stroke="#4f46e5" stroke-width="2" />
      <rect x="0" y="0" width="240" height="48" rx="12" fill="url(#entity-admin)" />
      <rect x="0" y="36" width="240" height="12" fill="url(#entity-admin)" />
      <text x="120" y="24" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="40" fill="#e0e7ff" font-size="13" font-weight="800" text-anchor="middle">MSWDO Caseworker / Admin</text>
      
      <g transform="translate(16, 68)" font-size="11" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#4338ca">Role: Assessment &amp; Authorization</text>
        <text x="0" y="22">• Activates Resident Accounts (is_active)</text>
        <text x="0" y="42">• Audits Registry &amp; Checks Duplicates</text>
        <text x="0" y="62">• Conducts Social Worker Intake</text>
        <text x="0" y="82">• Evaluates Proofs &amp; Doctor Abstracts</text>
        <text x="0" y="102">• Grants Approvals &amp; Sets Amount (₱)</text>
        <text x="0" y="122">• Manages Dynamic Checklist Policies</text>
        <text x="0" y="142">• Broadcasts Public Announcements</text>
        <text x="0" y="162">• Inspects System Security Audit Logs</text>
        <rect x="0" y="174" width="208" height="20" rx="4" fill="#eef2ff" stroke="#c7d2fe" />
        <text x="104" y="188" fill="#4338ca" font-size="10" font-weight="800" text-anchor="middle">PORTAL: /admin • /requests</text>
      </g>
    </g>

    <!-- ENTITY 3: MUNICIPAL TREASURER (DISBURSING OFFICER) -->
    <g transform="translate(1410, 580)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="260" rx="12" fill="#ffffff" stroke="#0d9488" stroke-width="2" />
      <rect x="0" y="0" width="240" height="48" rx="12" fill="url(#entity-treasurer)" />
      <rect x="0" y="36" width="240" height="12" fill="url(#entity-treasurer)" />
      <text x="120" y="24" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="40" fill="#ccfbf1" font-size="13" font-weight="800" text-anchor="middle">Municipal Treasurer</text>
      
      <g transform="translate(16, 68)" font-size="11" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#0f766e">Role: Custodian &amp; Disbursing Officer</text>
        <text x="0" y="22">• Monitors Category Fund Liquidity</text>
        <text x="0" y="42">• Validates Approved Grants in Queue</text>
        <text x="0" y="62">• Prepares Disbursement Voucher (DV)</text>
        <text x="0" y="82">• Sets Payment Mode (Cash / Check)</text>
        <text x="0" y="102">• Verifies Recipient ID &amp; Signature</text>
        <text x="0" y="122">• Executes Atomic Release &amp; Payout</text>
        <text x="0" y="142">• Maintains Double-Entry Fund Ledger</text>
        <text x="0" y="162">• Exports Monthly COA Reports</text>
        <rect x="0" y="174" width="208" height="20" rx="4" fill="#f0fdfa" stroke="#99f6e4" />
        <text x="104" y="188" fill="#0f766e" font-size="10" font-weight="800" text-anchor="middle">PORTAL: /treasurer • /treasurer/funds</text>
      </g>
    </g>

    <!-- ENTITY 4: REGULATORY & OVERSIGHT BODIES -->
    <g transform="translate(1410, 930)" filter="url(#card-shadow)">
      <rect x="0" y="0" width="240" height="180" rx="12" fill="#ffffff" stroke="#d97706" stroke-width="2" />
      <rect x="0" y="0" width="240" height="48" rx="12" fill="url(#entity-oversight)" />
      <rect x="0" y="36" width="240" height="12" fill="url(#entity-oversight)" />
      <text x="120" y="24" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="1">EXTERNAL ENTITY</text>
      <text x="120" y="40" fill="#fef3c7" font-size="13" font-weight="800" text-anchor="middle">Mayor, COA &amp; DSWD</text>
      
      <g transform="translate(16, 68)" font-size="11" fill="#334155">
        <text x="0" y="0" font-weight="700" fill="#b45309">Role: Executive &amp; Audit Oversight</text>
        <text x="0" y="22">• Approves Emergency Fund Allocations</text>
        <text x="0" y="42">• Reviews Low Balance Notifications</text>
        <text x="0" y="62">• Audits Official Municipal PDF &amp; XLSX</text>
        <text x="0" y="82">• Validates Liquidation Compliance</text>
        <rect x="0" y="98" width="208" height="20" rx="4" fill="#fffbeb" stroke="#fde68a" />
        <text x="104" y="112" fill="#b45309" font-size="10" font-weight="800" text-anchor="middle">AUDIT COMPLIANCE STANDARDS</text>
      </g>
    </g>
  </g>

  <!-- ── PROCESSES (1.0 to 8.0) ───────────────────────────────────────────── -->
  <g id="processes" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- PROCESS 1.0 -->
    <g transform="translate(350, 160)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <!-- Process Number Header -->
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 1.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">AUTH &amp; SECURITY</text>
      <!-- Title & Description -->
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">User Authentication &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Account Gating</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">OTP Verify • RBAC • is_active Gate</text>
    </g>

    <!-- PROCESS 2.0 -->
    <g transform="translate(350, 305)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 2.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">REGISTRY</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Beneficiary Profiling &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Demographic Registry</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">Purok Tagging • Vulnerabilities • Deduplication</text>
    </g>

    <!-- PROCESS 3.0 -->
    <g transform="translate(350, 450)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 3.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">APPLICATION</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Assistance Application &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Document Ingestion</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">Medical / Burial Uploads • Storage Buckets</text>
    </g>

    <!-- PROCESS 4.0 -->
    <g transform="translate(350, 595)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 4.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">ASSESSMENT</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Social Case Intake &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Eligibility Evaluation</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">Caseworker Notes • Recommendation</text>
    </g>

    <!-- PROCESS 5.0 -->
    <g transform="translate(1050, 450)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 5.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">APPROVAL</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Admin Review &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Grant Authorization</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">Grant Amount ₱ • Encumbrance • Decline</text>
    </g>

    <!-- PROCESS 6.0 -->
    <g transform="translate(1050, 635)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 6.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">TREASURY</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Voucher Preparation &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Category Liquidity Gating</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">DV-YYYY-XXXX • Payment Mode • Readiness</text>
    </g>

    <!-- PROCESS 7.0 -->
    <g transform="translate(1050, 825)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 7.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">DISBURSEMENT</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">In-Person Payout &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Atomic Financial Sync</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">Cash/Check Handover • Balance Deduct • Payouts</text>
    </g>

    <!-- PROCESS 8.0 -->
    <g transform="translate(1050, 1010)" filter="url(#process-shadow)">
      <rect x="0" y="0" width="240" height="85" rx="16" fill="#1e40af" stroke="#3b82f6" stroke-width="2" />
      <rect x="0" y="0" width="240" height="26" rx="14" fill="#172554" />
      <rect x="0" y="14" width="240" height="12" fill="#172554" />
      <text x="15" y="18" fill="#93c5fd" font-size="11" font-weight="900">PROCESS 8.0</text>
      <text x="225" y="18" fill="#60a5fa" font-size="10" font-weight="700" text-anchor="end">AUDIT &amp; REPORTING</text>
      <text x="120" y="48" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">Audit Logging, Alerts &amp;</text>
      <text x="120" y="66" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle">COA Liquidation Reporting</text>
      <text x="120" y="78" fill="#bfdbfe" font-size="9.5" font-weight="500" text-anchor="middle">system_logs • Real-Time Alerts • PDF/Excel</text>
    </g>
  </g>

  <!-- ── DATA STORES (D1 to D6) ───────────────────────────────────────────── -->
  <g id="data-stores" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    
    <!-- DATA STORE D1: PROFILES -->
    <g transform="translate(690, 175)" filter="url(#store-shadow)">
      <!-- Gane-Sarson Open-ended Store: Top and Bottom horizontal lines with ID block -->
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <!-- Left ID badge -->
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D1</text>
      <!-- Table details -->
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">profiles &amp; auth.users</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">ID, email, role, is_active, session tokens</text>
    </g>

    <!-- DATA STORE D2: BENEFICIARIES -->
    <g transform="translate(690, 320)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D2</text>
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">beneficiaries &amp; members</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">Purok, income, civil status, PWD, 4Ps tags</text>
    </g>

    <!-- DATA STORE D3: REQUESTS & DOCUMENTS -->
    <g transform="translate(690, 460)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D3</text>
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">requests &amp; documents</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">Assistance claims, status, voucher_no, files</text>
    </g>

    <!-- DATA STORE D4: FUNDS -->
    <g transform="translate(690, 650)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D4</text>
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">funds (Category Pools)</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">Medical/Burial, current_balance, thresholds</text>
    </g>

    <!-- DATA STORE D5: PAYOUTS & TRANSACTIONS -->
    <g transform="translate(690, 850)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D5</text>
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">payouts &amp; fund_transactions</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">Disbursement receipts, double-entry debits</text>
    </g>

    <!-- DATA STORE D6: NOTIFICATIONS & AUDIT -->
    <g transform="translate(690, 1025)" filter="url(#store-shadow)">
      <line x1="0" y1="0" x2="260" y2="0" stroke="#0f172a" stroke-width="2.5" />
      <line x1="0" y1="65" x2="260" y2="65" stroke="#0f172a" stroke-width="2.5" />
      <rect x="0" y="0" width="260" height="65" fill="#f1f5f9" opacity="0.95" />
      <rect x="0" y="0" width="45" height="65" fill="#0f172a" />
      <text x="22" y="38" fill="#38bdf8" font-size="14" font-weight="900" text-anchor="middle">D6</text>
      <text x="60" y="28" fill="#0f172a" font-size="13" font-weight="800">notifications &amp; system_logs</text>
      <text x="60" y="48" fill="#64748b" font-size="10.5" font-weight="600">Real-time alerts, immutable audit trail &amp; diffs</text>
    </g>
  </g>

  <!-- ── BOTTOM FOOTER BANNER ──────────────────────────────────────────────── -->
  <rect x="0" y="1190" width="1760" height="70" fill="#0f172a" />

  <g transform="translate(50, 1230)">
    <circle cx="6" cy="-2" r="5" fill="#22c55e" />
    <text x="20" y="2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="0.5">AICS INFORMATION ARCHITECTURE • PRODUCTION SPECIFICATION</text>
  </g>

  <g transform="translate(1710, 1230)">
    <text x="0" y="2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="end">Municipality of Daanbantayan, Cebu • Philippine Local Government Unit Standards (COA / DSWD Compliance)</text>
  </g>
</svg>`;
}

// ==============================================================================
// 2. GENERATE INTERACTIVE HTML VIEWER WITH HIGH-RES EXPORT
// ==============================================================================

function getHtmlContent(svgContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AICS Level 1 Master Data Flow Diagram (DFD) • Municipality of Daanbantayan</title>
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
      max-width: 1800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #172554 100%);
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
      padding: 30px 20px;
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

    /* DFD Architecture Highlights */
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

    <!-- Technical Architecture Panel -->
    <div class="details-panel">
      <div class="specs-grid">
        <div class="spec-card">
          <h3>
            <span class="badge-tag">DATA STORES</span>
            Database Repositories (D1 - D6)
          </h3>
          <ul>
            <li><strong>D1: profiles &amp; auth.users:</strong> Stores registered user credentials, RBAC roles ('admin', 'treasurer', 'resident'), activation flags (is_active), and encrypted JWT sessions.</li>
            <li><strong>D2: beneficiaries &amp; members:</strong> Master demographic registry with Purok grouping in Barangay Pajo, monthly income, family composition, and demographic tags (PWD, Senior, Solo Parent, 4Ps).</li>
            <li><strong>D3: requests &amp; request_documents:</strong> Primary transaction table containing crisis assistance claims, status lifecycles, approved amounts, voucher numbers, and Supabase Storage signed URLs.</li>
            <li><strong>D4: funds:</strong> Earmarked category pools (Medical, Burial) with total_allocated, current_balance, total_released, and low_balance_threshold alarms.</li>
            <li><strong>D5: payouts &amp; fund_transactions:</strong> Double-entry financial audit ledger recording immutable debits, receipt numbers, and official disbursement timestamps.</li>
            <li><strong>D6: notifications &amp; system_logs:</strong> Real-time in-app alerts and immutable forensic audit trail recording actor IDs, IP logs, and JSON data diffs.</li>
          </ul>
        </div>

        <div class="spec-card">
          <h3>
            <span class="badge-tag">ENTITIES</span>
            External Actors &amp; Boundaries
          </h3>
          <ul>
            <li><strong>Resident / Beneficiary:</strong> Submits registration, profile declarations, crisis requests, and supporting documentation. Signs physical payroll receipt at payout counter.</li>
            <li><strong>MSWDO Caseworker / Admin:</strong> Activates accounts, verifies eligibility, performs social intake assessments, formulates recommendations, and executes grant approvals.</li>
            <li><strong>Municipal Treasurer:</strong> Enforces fund liquidity gating, prepares Disbursement Vouchers (DV), conducts in-person recipient ID check, disburses cash/check, and syncs ledger.</li>
            <li><strong>Mayor &amp; Regulatory (COA / DSWD):</strong> Authorizes emergency budget replenishments and receives quarterly and annual compliance liquidation reports.</li>
          </ul>
        </div>

        <div class="spec-card">
          <h3>
            <span class="badge-tag">PROCESSES</span>
            Core System Processes (1.0 - 8.0)
          </h3>
          <ul>
            <li><strong>1.0 Auth &amp; Gating:</strong> Manages registration, OTP verification, and role-based route proxy middleware.</li>
            <li><strong>2.0 Beneficiary Profiling:</strong> Ingests family rosters, geotags, and executes duplicate detection across households.</li>
            <li><strong>3.0 Application &amp; Uploads:</strong> Ingests Medical/Burial assistance claims and stores proofs in secure object storage.</li>
            <li><strong>4.0 Intake Assessment:</strong> Social worker conducts casework investigation and records professional recommendations.</li>
            <li><strong>5.0 Grant Authorization:</strong> Admin sets approved grant amounts (₱) and pre-encumbers category budget.</li>
            <li><strong>6.0 Treasury Voucher Preparation:</strong> Assigns DV-YYYY-XXXX, payment mode, and verifies liquidity balance.</li>
            <li><strong>7.0 In-Person Payout:</strong> Atomic multi-table release, cash handover, and instant balance deduction.</li>
            <li><strong>8.0 Audit &amp; Reporting:</strong> Generates real-time notifications, logs forensic diffs, and exports official COA reports.</li>
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

  <!-- Scripts -->
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
      a.download = 'aics_system_data_flow_diagram.svg';
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

      canvas.width = 1760 * 2;
      canvas.height = 1260 * 2;

      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'aics_system_data_flow_diagram.png';
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

  console.log('\nAll DFD artifacts generated successfully!');
}

run();
