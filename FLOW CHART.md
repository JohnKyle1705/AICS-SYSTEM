# AICS SYSTEM — ADMINISTRATOR FLOW CHART & WORKFLOW SPECIFICATION
**Municipality of Daanbantayan, Cebu — Department of Social Welfare and Development (MSWD)**
*Assistance to Individuals in Crisis Situations (AICS) Request Management and Beneficiary Information System*

---

## 📋 Executive Overview

This document specifies the complete, role-exclusive operational flowcharts and decision logic for the **System Administrator** in the AICS Management System. The Administrator acts as the central executive and social welfare authority, responsible for user verification, beneficiary enrollment, case evaluation, assessment interviews, assistance approvals, fund allocation oversight, document policy configuration, and audit compliance.

---

## 🎨 Visual Flowchart Access & Formats

This documentation is available in three presentation formats:
1. **Interactive Vector Graphic**: Open **[FLOW CHART.html](file:///c:/Users/John%20Kyle/Desktop/AICS-System/FLOW%20CHART.html)** in any browser for interactive zoom, vector rendering, and single-click printing or PDF export.
2. **Standard Vector Image**: Direct SVG file **[FLOW_CHART_ADMIN.svg](file:///c:/Users/John%20Kyle/Desktop/AICS-System/FLOW_CHART_ADMIN.svg)** with ANSI symbols, drop shadows, and clean orthogonal routing arrows.
3. **Microsoft Word Document**: Official **[FLOW CHART.docx](file:///c:/Users/John%20Kyle/Desktop/AICS-System/FLOW%20CHART.docx)** matching municipal publication standards.

---

## 🔷 1. Flowchart of Administrator Process (ANSI/ISO Standard Symbols)

The diagram below reflects the exact standard flowchart logic formatted with **Oval Terminators** (Start/Stop), **Parallelograms** (Input/Output), **Diamonds** (Decisions), and **Rectangles** (Processes):

```mermaid
flowchart TD
    %% Node Styling Definitions
    classDef terminator fill:#ea580c,stroke:#c2410c,stroke-width:2.5px,color:#ffffff,font-weight:bold;
    classDef io fill:#ffedd5,stroke:#ea580c,stroke-width:2px,color:#431407,font-weight:600;
    classDef decision fill:#fed7aa,stroke:#c2410c,stroke-width:2px,color:#431407,font-weight:700;
    classDef process fill:#fff7ed,stroke:#fb923c,stroke-width:2px,color:#431407,font-weight:600;
    classDef stopDecline fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#ffffff,font-weight:bold;

    Start([Start]):::terminator
    Start --> InCred[/Input Admin Credentials & Agree to Terms/]:::io
    InCred --> DecAuth{Is Account Active & Role == Admin?}:::decision

    %% Authentication Branching
    DecAuth -- No --> OutDeny[/Display Error: Access Denied/]:::stopDecline
    OutDeny --> StopAuth([Stop]):::stopDecline

    DecAuth -- Yes --> OutDash[/Display Admin Dashboard & Notification Feeds/]:::io
    OutDash --> InReq[/Receive New AICS Assistance Request Medical / Burial/]:::io
    InReq --> ProcBen[Verify Beneficiary Profile, Barangay Pajo Residency & Household]:::process
    ProcBen --> DecDocs{Are Uploaded Documents Complete & Valid?}:::decision

    %% Document Branching
    DecDocs -- No --> FlagDocs[Flag Missing Documents & Notify Resident to Resubmit]:::process
    FlagDocs -. Re-upload .-> InReq

    DecDocs -- Yes --> ProcAssess[Conduct Social Case Assessment, Record Findings & Recommend Amount]:::process
    ProcAssess --> DecFund{Is Municipal Fund Balance Sufficient?}:::decision

    %% Fund Branching
    DecFund -- No --> AlertFund[Display Low Balance Warning & Allocate Municipal Funds]:::process
    AlertFund -. Deposited .-> DecFund

    DecFund -- Yes --> DecApprove{Admin Evaluation Decision: Approve or Decline?}:::decision

    %% Decline Branch
    DecApprove -- Decline --> ProcDecline[Record Written Justification & Set Status = 'Declined']:::process
    ProcDecline --> OutDeclineNotif[/Send Rejection Notice to Resident with Remarks/]:::io
    OutDeclineNotif --> StopDecline([Stop]):::stopDecline

    %% Approve Branch
    DecApprove -- Approve --> ProcApprove[Set amount_approved & Update Status = 'Approved']:::process
    ProcApprove --> ProcRoute[Route Request to Municipal Treasurer & Insert Audit Log in system_logs]:::process
    ProcRoute --> OutNotif[/Send Real-time Notifications to Resident Approved & Treasurers Ready/]:::io
    OutNotif --> Stop([Stop]):::terminator
```

---

## 🗺️ 2. Master Administrator System Architecture Flow

The following master flowchart depicts the end-to-end lifecycle and modules managed exclusively or primarily by the Administrator.

```mermaid
flowchart TD
    Start([Admin Launches Web / Mobile App]) --> Auth[Authentication Screen]
    Auth --> Credentials{Valid Admin Credentials & Accepted Terms?}
    Credentials -- No --> LoginError[Show Error / Deny Access] --> Auth
    Credentials -- Yes --> RoleCheck{Role == 'admin'?}
    RoleCheck -- No --> Divert[Redirect to Resident / Treasurer Dashboard]
    RoleCheck -- Yes --> AdminDash[Admin Central Dashboard]

    %% Main Navigation Pillars
    AdminDash --> M1[1. User & Account Management]
    AdminDash --> M2[2. Beneficiary Registry]
    AdminDash --> M3[3. AICS Request & Assessment Processing]
    AdminDash --> M4[4. Fund Tracking & Allocation Oversight]
    AdminDash --> M5[5. Document Requirements Setup]
    AdminDash --> M6[6. Announcements & Advisories]
    AdminDash --> M7[7. System Reports & Analytics]
    AdminDash --> M8[8. Audit Logs & System Oversight]

    %% Module 1 Subflow
    M1 --> U1[Review Pending Resident Registrations]
    M1 --> U2[Activate / Deactivate Accounts]
    M1 --> U3[Assign / Modify Staff Roles]

    %% Module 2 Subflow
    M2 --> B1[Encode / Verify Beneficiary Profile]
    M2 --> B2[Validate Barangay Pajo & Purok Residency]
    M2 --> B3[Cross-check Family Composition & Income]

    %% Module 3 Subflow
    M3 --> R1[Inspect In-Flight AICS Requests]
    R1 --> R2[Validate Supporting Documents]
    R2 --> R3[Conduct Social Worker Case Assessment]
    R3 --> R4{Admin Decision}
    R4 -- Approve --> R5[Set Approved Amount & Route to Treasury]
    R4 -- Decline --> R6[Record Official Justification & Notify Resident]

    %% Module 4 Subflow
    M4 --> F1[Monitor Fund Balances & Low-Threshold Alerts]
    M4 --> F2[Allocate Budget to Medical / Burial Pools]
    M4 --> F3[Inspect Fund Transaction Ledger]

    %% Module 5 Subflow
    M5 --> S1[Configure Mandatory vs Optional Checklist]

    %% Module 6 Subflow
    M6 --> A1[Publish Distribution Advisories & Alerts]

    %% Module 7 Subflow
    M7 --> REP1[Export Demographic & Financial Reports]

    %% Module 8 Subflow
    M8 --> LOG1[Inspect Immutable Security Trail]
```

---

## 🔐 2. Module 1: Administrator Authentication & Session Security Flow

Administrators authenticate with encrypted email and password credentials, subject to role verification and mandatory Terms & Conditions acknowledgement.

```mermaid
flowchart TD
    A([Admin Navigates to /login]) --> B[Input Email & Password]
    B --> C{Terms & Conditions Accepted?}
    C -- No --> D[Display Warning: Terms Agreement Mandatory]
    D --> B
    C -- Yes --> E[Submit Login Request]
    E --> F[Supabase Auth Authentication]
    F --> G{Credentials Valid & Email Confirmed?}
    G -- No --> H[Show Authentication Error]
    H --> A
    G -- Yes --> I[Fetch Profile Record from profiles table]
    I --> J{Profile is_active == true?}
    J -- No --> K[Redirect to /pending: Account Suspended / Inactive]
    J -- Yes --> L{Profile role == 'admin'?}
    L -- No --> M[Redirect to Authorized Role Space]
    L -- Yes --> N[Generate Secure Session & Cache Cookie]
    N --> O[Write Audit Log: LOGIN action]
    O --> P([Land on /admin/dashboard])

    P --> Q{User Clicks Sign Out?}
    Q -- Yes --> R[Synchronously Clear Local State & Tokens]
    R --> S[Send Fire-and-Forget Keepalive Beacon to /api/auth/signout]
    S --> T[Write Audit Log: LOGOUT action]
    T --> U[Redirect to /login?logout=true & Flush Cookies]
    U --> V([Session Terminated Cleanly])
```

---

## 👥 3. Module 2: User Account & Staff Management Flow

Administrators hold exclusive authority to activate newly registered residents, suspend accounts, and configure system staff (Admins, Treasurers).

```mermaid
flowchart TD
    A([Open /users Dashboard]) --> B[Fetch Users, Profiles & Beneficiary Info]
    B --> C{Select User Category}
    
    %% Staff Management
    C -- Staff Tab --> D[Display Admins & Treasurers]
    D --> E{Action Requested}
    E -- Change Role --> F[Select New Role: Admin <-> Treasurer]
    F --> G[Execute Role Update & Re-validate Permissions]
    E -- Toggle Access --> H[Toggle is_active Status]
    H --> I[Update Profile Status in Supabase]
    
    %% Resident Registration Review
    C -- Residents Tab --> J[Display Registered Residents]
    J --> K[Filter: Pending Approval vs Active vs Inactive]
    K --> L[Admin Reviews Resident Profile & Contact Details]
    L --> M{Admin Verification Decision}
    
    M -- Approve Account --> N[Set is_active = true]
    N --> O[Dispatch Notification to Resident: Account Activated]
    N --> P[Create Audit Log: USER_ACTIVATED]
    
    M -- Deactivate / Suspend --> Q[Set is_active = false]
    Q --> R[User Session Terminated / Prevented at AuthGuard]
    Q --> S[Create Audit Log: USER_DEACTIVATED]
    
    M -- Update Details --> T[Edit Name or Linked Beneficiary Info]
    T --> U[Save Changes & Refresh User Table]

    P --> V([User Management Complete])
    S --> V
    U --> V
```

---

## 🗂️ 4. Module 3: Beneficiary Registry & Profiling Flow

Every AICS assistance application requires a linked beneficiary. Administrators can directly encode beneficiaries or inspect and verify resident self-registered profiles.

```mermaid
flowchart TD
    A([Open /beneficiaries]) --> B[Load Beneficiary Directory]
    B --> C{Action Selection}
    
    %% Search / Filter
    C -- Search / Filter --> D[Filter by Barangay Pajo Purok 1-10 / Centro / etc.]
    D --> E[Search by First Name, Last Name, or Contact]
    
    %% New Beneficiary Enrollment
    C -- Enroll New Beneficiary --> F[Open /beneficiaries/new Form]
    F --> G[Input Personal Information: Full Name, Sex, Birthdate]
    G --> H[Validate Civil Status: Single, Married, Widowed, Separated, Annulled]
    H --> I[Assign Address: Barangay Pajo & Specific Purok]
    I --> J[Input Socioeconomic Details: Monthly Income, Family Size, Occupation]
    J --> K[Check Special Demographic Tags: PWD, Senior Citizen, Solo Parent, 4Ps]
    K --> L{Check Duplicate Records}
    L -- Match Found --> M[Alert Admin: Potential Duplicate Beneficiary]
    M --> N{Override or Merge?}
    N -- Cancel --> F
    N -- Proceed --> O[Persist Beneficiary Record]
    L -- No Match --> O
    O --> P[Auto-generate Unique Beneficiary QR / Identification ID]
    P --> Q[Log Action: CREATE_BENEFICIARY]
    Q --> R([Beneficiary Successfully Registered])
    
    %% Existing Record Edit
    C -- Edit Record --> S[Open /beneficiaries/id/edit]
    S --> T[Update Address, Contact, or Socioeconomic Status]
    T --> U[Commit Updates to beneficiaries table]
    U --> V[Log Action: UPDATE_BENEFICIARY]
    V --> R
```

---

## ⚖️ 5. Module 4: AICS Assistance Request Processing & Assessment Flow

This is the core operational workflow of the MSWD. It covers the end-to-end evaluation of requests from initial submission to social assessment, decision-making, and referral to the Municipal Treasurer.

```mermaid
flowchart TD
    A([Incoming Request on /requests]) --> B[Request Status: 'Pending']
    B --> C[Admin Inspects Request Details /requests/id]
    
    %% Document Inspection
    C --> D[Review Uploaded Required Documents]
    D --> E{Documents Complete & Valid?}
    E -- Missing / Illegible --> F[Flag Request & Send Notification to Resident]
    F --> G[Resident Re-uploads Document via Mobile or Web]
    G --> D
    
    %% Case Assessment
    E -- Complete & Verified --> H[Social Worker Intake Assessment /assessments/new]
    H --> I[Input Assessment Details: Interview Date, Home Visit Y/N]
    I --> J[Record Social Worker Findings & Family Crisis Evaluation]
    J --> K[Formulate Professional Recommendation]
    K --> L[Calculate Recommended Assistance Amount in PHP]
    L --> M[Save Assessment Record in assessments table]
    M --> N[Update Request: assessed_by = Admin ID]
    
    %% Fund Availability Verification
    N --> O[Check Available Fund Balance in funds table for Assistance Type]
    O --> P{Sufficient Fund Balance Available?}
    P -- Insufficient --> Q[Trigger Low Balance Alert; Refill / Reallocate Funds First]
    Q --> O
    
    %% Admin Decision
    P -- Sufficient --> R{Admin Official Decision}
    
    %% Approval Path
    R -- APPROVE --> S[Set status = 'Approved']
    S --> T[Set approved_by = Admin ID]
    T --> U[Set amount_approved = Evaluated Amount]
    U --> V[Create Audit Log: APPROVE_REQUEST]
    V --> W[Auto-dispatch Notification to Resident: Request Approved]
    W --> X[Auto-dispatch Notification to Treasurers: Ready for Processing]
    X --> Y[Request Routed to Municipal Treasurer Disbursement Queue]
    Y --> Z([Handed Off to Treasury for Voucher & Release])
    
    %% Rejection Path
    R -- DECLINE --> AA[Set status = 'Declined']
    AA --> AB[Input Mandatory Rejection Reason / Remarks]
    AB --> AC[Create Audit Log: DECLINE_REQUEST]
    AC --> AD[Dispatch Notification to Resident with Official Explanation]
    AD --> AE([Request Terminated as Declined])
```

---

## 💰 6. Module 5: Fund Allocation & Treasury Oversight Flow

The Administrator manages the municipal budget pool, monitors expenditures, and allocates resources to Medical and Burial assistance categories.

```mermaid
flowchart TD
    A([Navigate to /admin/funds]) --> B[Load Fund Balances from funds table]
    B --> C[Calculate Aggregate Metrics: Total Allocated, Released, Remaining]
    
    %% Health Monitoring
    C --> D{Check current_balance <= low_balance_threshold?}
    D -- Yes --> E[Display Prominent Amber Alert: Low Balance Warning]
    D -- No --> F[Display Normal Status Metric Card]
    
    %% Allocation Flow
    E & F --> G{Admin Action}
    G -- Allocate / Deposit Funds --> H[Open AllocationModal]
    H --> I[Select Target Fund: Medical Assistance vs Burial Assistance]
    I --> J[Select Transaction Type: Allocation, Deposit, or Adjustment]
    J --> K[Enter Amount in PHP & Reference Source e.g. LGU Annual Budget]
    K --> L[Enter Justification / Transaction Notes]
    L --> M[Submit Allocation Request]
    M --> N[Atomic DB Transaction via /api/treasury]
    N --> O[Update funds.current_balance & funds.total_allocated]
    O --> P[Insert Record into fund_transactions table]
    P --> Q[Create Audit Log: FUND_ALLOCATION]
    Q --> R[Refresh Dashboard & Dismiss Low Balance Alert]
    R --> S([Fund Allocation Recorded])

    %% Ledger Audit Flow
    G -- Inspect Financial Ledger --> T[Navigate to /admin/funds/transactions]
    T --> U[Filter by Date, Type, or Encoder]
    U --> V[Export Financial History to CSV / Excel]
    V --> S
```

---

## ⚙️ 7. Module 6: Requirements Configuration Flow

Administrators can dynamically tailor the mandatory documents required for each assistance type without modifying application source code.

```mermaid
flowchart TD
    A([Open /settings/requirements]) --> B[Fetch assistance_requirements table]
    B --> C[Display Requirements Grouped by Category: Medical vs Burial]
    
    C --> D{Select Action}
    
    %% Add Requirement
    D -- Add New Document --> E[Select Assistance Type: Medical or Burial]
    E --> F[Enter Document Name e.g. 'Clinical Abstract', 'Funeral Contract']
    F --> G[Submit Add Form]
    G --> H[Insert Row into assistance_requirements with is_required = true]
    H --> I[Create Audit Log: ADD_REQUIREMENT]
    I --> J[Form Updated & Resident Mobile/Web Upload Checklist Synced]
    
    %% Toggle Requirement
    D -- Toggle Mandatory / Optional --> K[Click Requirement Switch]
    K --> L[Update is_required boolean]
    L --> M[Update Live Form Validations]
    
    %% Delete Requirement
    D -- Remove Requirement --> N[Click Delete Icon]
    N --> O{Confirm Removal Dialog}
    O -- Confirm --> P[Delete Row from assistance_requirements]
    P --> Q[Create Audit Log: DELETE_REQUIREMENT]
    Q --> J
```

---

## 📢 8. Module 7: Announcements & Public Advisories Flow

The Administrator broadcasts important updates, payout distribution dates, and calamity advisories to residents.

```mermaid
flowchart TD
    A([Open /admin/announcements]) --> B[Load Existing Municipal Bulletins]
    B --> C{Action Selection}
    
    C -- Create Announcement --> D[Input Title, Description, and Category]
    D --> E[Set Target Audience: All Residents vs Specific Purok]
    E --> F[Attach Announcement Banner Image if applicable]
    F --> G[Select Publish Date & Expiration]
    G --> H[Save to announcements table]
    H --> I[Trigger In-App Push Notification to Residents]
    I --> J[Display Bulletin on Resident Web & Mobile Dashboards]
    
    C -- Edit / Archive --> K[Select Announcement to Modify]
    K --> L[Update Content or Set is_published = false]
    L --> M[Update announcements table]
    M --> N([Announcement Synced])
```

---

## 📊 9. Module 8: System Reports & DSWD Analytics Flow

Administrators generate official compliance reports for submission to the Daanbantayan Municipal Council, Mayor's Office, and the DSWD Regional Office.

```mermaid
flowchart TD
    A([Open /reports Dashboard]) --> B[Query requests, beneficiaries, and payouts]
    B --> C[Configure Analytical Filters]
    
    C --> D[Select Date Range: Daily, Monthly, Quarterly, Annual]
    C --> E[Select Assistance Type: Medical, Burial, All]
    C --> F[Select Geographic Scope: Barangay Pajo Puroks 1-10]
    C --> G[Select Status: Approved, Released, Declined]
    
    D & E & F & G --> H[Execute Aggregation Query]
    
    H --> I[Render Data Visualizations]
    I --> J[Total Funds Disbursed by Category KPI]
    I --> K[Total Beneficiaries Served Breakdown]
    I --> L[Demographic Distribution: Age, Gender, Income Bracket]
    
    J & K & L --> M{Select Export Format}
    M -- PDF Report --> N[Generate Official Formatted PDF with Municipality Header]
    M -- Excel / CSV --> O[Generate Structured Spreadsheet Data]
    M -- Direct Print --> P[Trigger Browser Print Preview with Standard Styling]
    
    N & O & P --> Q([Official Report Ready for Municipal Submission])
```

---

## 🛡️ 10. Module 9: System Audit Logging & Security Oversight Flow

To ensure complete transparency and prevent fraud, every action performed by any role (Admin, Treasurer, Resident) is audited. The Administrator possesses exclusive access to inspect these system logs.

```mermaid
flowchart TD
    A([System Event Occurs in Web or Mobile]) --> B{Event Type}
    B -- Auth --> C[LOGIN, LOGOUT, PASSWORD_RESET]
    B -- Workflow --> D[CREATE_REQUEST, APPROVE_REQUEST, DECLINE_REQUEST]
    B -- Treasury --> E[CONFIRM_RELEASE, FUND_ALLOCATION, VOUCHER_GENERATED]
    B -- Master Data --> F[CREATE_BENEFICIARY, UPDATE_USER, TOGGLE_REQUIREMENT]
    
    C & D & E & F --> G[Construct Audit Payload]
    G --> H[Record actor user_id, action, table_name, record_id, timestamp, IP/UserAgent, details JSON]
    H --> I[Insert into system_logs table with RLS Protection]
    
    I --> J([Administrator Opens /logs])
    J --> K[Search Logs by Actor Name, Action Type, Date, or Entity ID]
    K --> L[Expand Log Details JSON to view exact change diffs]
    L --> M[Export Audit Records for Regulatory Compliance]
```

---

## 🏊 11. Cross-Functional Swimlane Diagram (Administrator Central Role)

This swimlane demonstrates how the Administrator interacts with the Resident, the System Engine, and the Municipal Treasurer throughout an AICS transaction.

```mermaid
sequenceDiagram
    autonumber
    actor Resident as Resident / Beneficiary
    actor Admin as Administrator (MSWD)
    participant System as AICS Core Platform
    actor Treasurer as Municipal Treasurer

    Note over Resident,Treasurer: Phase 1: Intake & Account Setup
    Resident->>System: Register Account (Mobile / Web)
    System->>Admin: Alert: New Resident Registration Pending Review
    Admin->>System: Review Credentials & Activate Account (/users)
    System-->>Resident: Notification: Account Activated

    Note over Resident,Treasurer: Phase 2: Request Submission & Case Assessment
    Resident->>System: Submit AICS Assistance Request + Upload Documents
    System->>Admin: New Pending Request in Queue (/requests)
    Admin->>System: Inspect Request & Verify Documents
    Admin->>System: Conduct Assessment & Formulate Findings (/assessments/new)
    Admin->>System: Determine & Authorize Approved Amount

    Note over Resident,Treasurer: Phase 3: Administrative Decision & Treasury Referral
    Admin->>System: Click 'Approve Request'
    System->>System: Record Status = 'Approved' & Log APPROVE_REQUEST
    System-->>Resident: Notification: Assistance Request Approved
    System->>Treasurer: Notification: New Approved Request Ready for Processing

    Note over Resident,Treasurer: Phase 4: Disbursement by Treasury
    Treasurer->>System: Review Voucher & Verify Identity (/treasurer/requests)
    Treasurer->>System: Disburse Assistance & Confirm Release
    System->>System: Deduct Fund Balance & Record Payout in Ledger
    System-->>Resident: Notification: Assistance Released / Ready for Claim
    System-->>Admin: Dashboard Metric & Ledger Updated

    Note over Resident,Treasurer: Phase 5: Reporting & Audit
    Admin->>System: Review Real-Time Audit Logs & Export Monthly DSWD Report
```

---

## 📈 12. Request Status State Machine (Admin Governance)

The table below summarizes the exact state transitions governed by the Administrator:

| Initial State | Trigger / Action by Admin | Target State | Fund Impact | Notification Triggered |
| :--- | :--- | :--- | :--- | :--- |
| **Draft / Submitted** | System validates submission | **Pending** | None | Admin notified of incoming request |
| **Pending** | Admin conducts assessment & approves | **Approved** | Pre-encumbered | Resident & Treasurer notified |
| **Pending** | Admin rejects with formal reason | **Declined** | None | Resident notified with justification |
| **Approved** | Treasurer processes disbursement | **Released** | Current balance deducted | Resident notified of release |
| **Approved** | Treasurer flags discrepancy to Admin | **Pending** *(Returned)* | Returned to pool | Admin notified with return remarks |

---

## 📌 Document Control & Sign-off

- **Document Code**: `DOC-AICS-FLOW-ADMIN-001`
- **Target Audience**: Municipal Social Welfare and Development Officers (MSWDO), IT Administrators, Project Auditors.
- **System**: AICS Request Management and Beneficiary Information System
- **Municipality**: Municipality of Daanbantayan, Province of Cebu
- **Version**: 1.0.0
- **Status**: Official System Specification
