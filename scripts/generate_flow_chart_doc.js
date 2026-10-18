/**
 * Generates FLOW CHART.docx - Official Administrator Process Flowchart and Workflow Specification
 * for the Municipality of Daanbantayan AICS Request Management System.
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, NumberFormat, HeadingLevel,
  Packer
} = require('docx');

const COLOR_PRIMARY = '1E3A8A';   // Deep Navy Blue
const COLOR_SECONDARY = '2563EB'; // Royal Blue
const COLOR_TEXT = '0F172A';      // Slate Text
const COLOR_MUTED = '475569';     // Muted Grey
const COLOR_BORDER = 'CBD5E1';    // Border Grey
const COLOR_HEADER_BG = '1E3A8A'; // Table Header Fill
const COLOR_ROW_ALT = 'F8FAFC';   // Row Alt Fill
const COLOR_CARD_BG = 'F1F5F9';   // Box Fill
const FONT_FAMILY = 'Calibri';

const borderNone = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const tableCellBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };

function createTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: COLOR_PRIMARY,
        font: FONT_FAMILY
      })
    ]
  });
}

function createSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 300 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 22,
        color: COLOR_MUTED,
        font: FONT_FAMILY
      })
    ]
  });
}

function createH1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: COLOR_PRIMARY,
        font: FONT_FAMILY
      })
    ]
  });
}

function createH2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
        color: COLOR_SECONDARY,
        font: FONT_FAMILY
      })
    ]
  });
}

function createP(text) {
  return new Paragraph({
    spacing: { before: 60, after: 100 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: COLOR_TEXT,
        font: FONT_FAMILY
      })
    ]
  });
}

function createBullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 60 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: COLOR_TEXT,
        font: FONT_FAMILY
      })
    ]
  });
}

function createStepBox(stepNumber, title, description, decision = null) {
  const children = [
    new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [
        new TextRun({
          text: `STEP ${stepNumber}: `,
          bold: true,
          color: COLOR_PRIMARY,
          size: 20,
          font: FONT_FAMILY
        }),
        new TextRun({
          text: title,
          bold: true,
          color: COLOR_SECONDARY,
          size: 20,
          font: FONT_FAMILY
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 20, after: 40 },
      children: [
        new TextRun({
          text: description,
          size: 19,
          color: COLOR_TEXT,
          font: FONT_FAMILY
        })
      ]
    })
  ];

  if (decision) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: `▶ Decision / Branching: `,
            bold: true,
            color: 'B45309', // Amber dark
            size: 19,
            font: FONT_FAMILY
          }),
          new TextRun({
            text: decision,
            italics: true,
            size: 19,
            color: COLOR_TEXT,
            font: FONT_FAMILY
          })
        ]
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: borderNone,
              bottom: borderNone,
              right: borderNone,
              left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_PRIMARY }
            },
            shading: { type: ShadingType.CLEAR, fill: COLOR_CARD_BG },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children
          })
        ]
      })
    ]
  });
}

function createTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
      borders: { top: tableCellBorder, bottom: tableCellBorder, left: tableCellBorder, right: tableCellBorder },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 19, font: FONT_FAMILY })]
        })
      ]
    }))
  });

  const bodyRows = rows.map((row, idx) => new TableRow({
    children: row.map(cell => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 1 ? COLOR_ROW_ALT : 'FFFFFF' },
      borders: { top: tableCellBorder, bottom: tableCellBorder, left: tableCellBorder, right: tableCellBorder },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: cell, color: COLOR_TEXT, size: 18, font: FONT_FAMILY })]
        })
      ]
    }))
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows]
  });
}

async function buildDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'AICS SYSTEM — ADMINISTRATOR OPERATIONAL FLOW CHART',
                    size: 16,
                    color: COLOR_MUTED,
                    font: FONT_FAMILY
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page ', size: 18, color: COLOR_MUTED, font: FONT_FAMILY }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR_MUTED, font: FONT_FAMILY }),
                  new TextRun({ text: ' | Municipality of Daanbantayan, Cebu', size: 18, color: COLOR_MUTED, font: FONT_FAMILY })
                ]
              })
            ]
          })
        },
        children: [
          createTitle('AICS SYSTEM — ADMINISTRATOR FLOW CHART'),
          createSubtitle('Municipality of Daanbantayan, Cebu — Department of Social Welfare and Development (MSWD)\nOfficial Role-Exclusive Process Specifications and Decision Logic'),

          createH1('1. Overview & Administrator Scope'),
          createP('The System Administrator serves as the executive authority of the AICS Request Management and Beneficiary Information System. The Administrator oversees resident account approvals, demographic and beneficiary registries, social intake assessments, assistance request authorizations, municipal budget allocation pools, document checklist policies, system announcements, and regulatory audit compliance.'),

          createH1('2. Master Administrator Operational Lifecycle'),
          createP('The complete administrator workflow follows a structured multi-stage progression:'),

          createStepBox(
            '1',
            'Secure Authentication & Role Verification',
            'Admin signs in via web (/login) or mobile app with encrypted credentials and agrees to mandatory Terms & Conditions. The system validates JWT session cookies and verifies profiles.role === "admin". Non-admins are redirected to their respective dashboards.',
            'If is_active is false, account is blocked (/pending). If role is verified, lands on /admin/dashboard.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '2',
            'Resident & Staff Account Management (/users)',
            'Admin reviews newly registered residents. Unverified accounts have is_active = false. Admin verifies residency, identity, and linked beneficiary details before granting activation. Admin can also assign staff roles (Admin vs Treasurer) and suspend compromised accounts.',
            'Approve: is_active = true (auto-notifies resident). Suspend: is_active = false (revokes session immediately).'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '3',
            'Beneficiary Registry & Identity Verification (/beneficiaries)',
            'Admin manages the official beneficiary database. Each beneficiary is profiled with full name, civil status, birthdate, sex, contact number, Purok assignment within Barangay Pajo, monthly income, family size, and demographic tags (PWD, Senior Citizen, Solo Parent, 4Ps).',
            'Duplicate detection prevents multiple registrations of the same individual across households.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '4',
            'AICS Request Processing & Intake Assessment (/requests, /assessments/new)',
            'Incoming assistance requests (Medical or Burial) land in the Pending queue. Admin inspects uploaded documents (Clinical abstract, Barangay indigency certificate, death certificate, funeral contract). Social worker conducts intake interview, records findings, and formulates professional recommendation.',
            'Approval Decision: Admin sets approved amount -> status becomes "Approved" -> auto-routed to Municipal Treasurer. Decline Decision: Admin inputs mandatory rejection remarks -> status becomes "Declined" -> resident notified.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '5',
            'Municipal Fund Tracking & Allocation Oversight (/admin/funds)',
            'Admin monitors available municipal funds per assistance category (Medical, Burial). If current_balance falls below low_balance_threshold, prominent visual warnings are triggered. Admin allocates fresh budget from LGU funds, national subsidies, or calamity reserves.',
            'Admin creates allocation transaction via AllocationModal -> atomic database update to funds and fund_transactions table.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '6',
            'Document Requirements Policy Setup (/settings/requirements)',
            'Admin configures required documents per assistance type dynamically. Adding, toggling, or removing checklist requirements updates resident mobile and web forms in real time without altering source code.',
            'Changes immediately sync to resident file upload requirements.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '7',
            'Public Advisories & Bulletins (/admin/announcements)',
            'Admin broadcasts official advisories regarding disbursement schedules, requirements guidelines, and emergency relief distribution. Announcements are displayed on web/mobile resident dashboards with optional push notifications.',
            'Target audience can be municipal-wide or targeted to specific barangay/purok groups.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '8',
            'Analytics, Reporting & DSWD Compliance (/reports)',
            'Admin exports official quarterly and annual AICS reports filtered by date range, assistance category, purok, and status. Aggregates include total budget spent, beneficiaries served, and demographic distributions for submission to the Mayor and DSWD regional office.',
            'Formats supported: Formatted PDF with municipal seal, Excel spreadsheet (CSV), and browser print preview.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '9',
            'System Security & Audit Logging (/logs)',
            'Admin has exclusive access to the immutable system_logs ledger. Every login, logout, account status modification, assessment entry, approval, decline, and fund transaction is recorded with actor ID, timestamp, entity diffs, and IP records.',
            'Logs cannot be deleted or manipulated by any non-database administrator.'
          ),

          createH1('3. Request Status State Machine (Admin Governance)'),
          createP('The table below defines every status transition governed by the Administrator:'),
          createTable(
            ['Current Status', 'Trigger / Action by Admin', 'Next Status', 'Fund Pool Impact', 'Automated Notifications'],
            [
              ['Draft / New', 'Resident submits request online', 'Pending', 'No change', 'Admin alerted of new queue item'],
              ['Pending', 'Admin conducts assessment & approves', 'Approved', 'Amount pre-encumbered', 'Resident & Treasurer notified'],
              ['Pending', 'Admin declines with justification', 'Declined', 'No change', 'Resident notified with remarks'],
              ['Approved', 'Treasurer processes disbursement', 'Released', 'Fund balance deducted', 'Resident notified of payout'],
              ['Approved', 'Treasurer returns request for review', 'Pending (Returned)', 'Encumbrance restored', 'Admin alerted with return notes']
            ]
          ),

          createH1('4. Cross-Functional Swimlane Interactions'),
          createP('The interaction between the Administrator and other system stakeholders follows these precise responsibilities:'),
          createBullet('Resident / Beneficiary: Submits account registration, uploads required crisis documents, checks real-time tracking, receives notification on approval or release.'),
          createBullet('Administrator (MSWD): Reviews resident eligibility, verifies identity, conducts intake interview, formulates social findings, determines approved grant, executes approval decision, monitors municipal budget.'),
          createBullet('Municipal Treasurer: Receives approved requests, inspects voucher and claim identity, confirms physical/electronic cash disbursement, updates fund ledger.'),
          createBullet('AICS Core Engine: Dispatches real-time in-app alerts, enforces row-level security (RLS), records immutable audit logs, updates fund balances atomically.'),

          createH1('5. Document Control & Sign-Off'),
          createP('Document Reference: DOC-AICS-FLOW-ADMIN-001\nVersion: 1.0.0\nSystem: AICS Request Management and Beneficiary Information System\nMunicipality: Municipality of Daanbantayan, Province of Cebu\nOffice: Municipal Social Welfare and Development Office (MSWDO)')
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '..', 'FLOW CHART.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Successfully generated: ${outPath} (${buffer.length} bytes)`);
}

buildDocx().catch((err) => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
