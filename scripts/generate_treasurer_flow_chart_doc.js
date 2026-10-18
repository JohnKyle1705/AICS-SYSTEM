/**
 * Generates FLOW CHART - TREASURER.docx - Official Municipal Treasurer Flowchart and Workflow Specification
 * for the Municipality of Daanbantayan AICS Request Management System.
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, HeadingLevel,
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
            color: 'B45309',
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
                    text: 'AICS SYSTEM — MUNICIPAL TREASURER OPERATIONAL FLOW CHART',
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
                  new TextRun({ text: ' | Office of the Municipal Treasurer — Daanbantayan, Cebu', size: 18, color: COLOR_MUTED, font: FONT_FAMILY })
                ]
              })
            ]
          })
        },
        children: [
          createTitle('AICS SYSTEM — MUNICIPAL TREASURER FLOW CHART'),
          createSubtitle('Municipality of Daanbantayan, Cebu — Office of the Municipal Treasurer\nOfficial Role-Exclusive Process Specifications and Disbursement Lifecycle'),

          createH1('1. Overview & Treasurer Mandate'),
          createP('The Municipal Treasurer serves as the financial custodian and disbursing officer of the AICS System. The Treasurer is responsible for reviewing social worker approved grants, preparing official Disbursement Vouchers (DV), ensuring municipal budget liquidity, conducting in-person payout distributions, updating the financial ledger, and producing regulatory liquidation reports for COA and DSWD.'),

          createH1('2. Master Treasurer Operational Lifecycle'),
          createP('The complete treasurer workflow follows a structured sequence of checks, voucher processing, cash disbursement, and multi-table ledger synchronization:'),

          createStepBox(
            '1',
            'Secure Authentication & Role Verification',
            'Treasurer signs in via /login with encrypted credentials and accepts Terms & Conditions. The proxy middleware validates profiles.role === "treasurer". Unauthorized or inactive accounts are blocked.',
            'If role is valid, lands on /treasurer dashboard.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '2',
            'Financial Dashboard & Liquidity Inspection (/treasurer)',
            'Treasurer reviews municipal budget cards: Total Budget, Available Liquid Balance, Total Released, and Earmarked Reserves for pending claims. Threshold warnings alert the Treasurer if Medical or Burial pools are depleted.',
            'Category liquidity cards display real-time remaining cash reserves.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '3',
            'Approved Releases Queue & Verification (/treasurer/requests)',
            'Treasurer accesses the queue of requests approved by the Administrator/Social Worker. Treasurer cross-checks beneficiary government ID, grant justification, and approved amount in PHP.',
            'Discrepancy Check: If documents or amounts have errors, Treasurer clicks Return to Admin with written remarks. If verified, proceeds to voucher preparation.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '4',
            'Fund Liquidity Verification',
            'The system programmatically validates that the target category fund balance is greater than or equal to the approved grant amount (funds.current_balance >= amount_approved).',
            'Insufficient Funds: Alert triggered to Admin and Mayor; request held in queue until budget is deposited. Sufficient Funds: Proceeds to voucher generation.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '5',
            'Disbursement Voucher (DV) Preparation',
            'Treasurer opens the Voucher modal to input official Disbursement Voucher Number (DV-YYYY-XXXX), optional Check Number, Payment Method (Cash, Check, Bank Transfer), and Disbursing Officer name. Request is elevated to "Ready for Release".',
            'Audit log TREASURY_PROCESS_VOUCHER is recorded.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '6',
            'Physical Claim & Identity Verification',
            'The beneficiary or authorized representative presents valid government ID at the Municipal Treasury and signs the official payroll/acknowledgment sheet.',
            'Treasurer verifies recipient signature against registered beneficiary profile.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '7',
            'Atomic Financial Release & Multi-Table Sync',
            'Treasurer clicks Confirm Release. An atomic backend transaction executes via /api/treasury: (1) Deducts funds.current_balance, (2) Increments funds.total_released, (3) Sets requests.status = "Released", (4) Inserts official record in payouts, (5) Inserts debit row in fund_transactions, and (6) Logs TREASURY_CONFIRM_RELEASE in system_logs.',
            'Release is complete. Resident and Admins receive real-time notifications.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '8',
            'Financial Ledger & Transaction Monitoring (/treasurer/transactions)',
            'Treasurer audits the immutable double-entry ledger. All historical allocations, disbursements, adjustments, and emergency reversals are searchable and filterable by date, assistance category, and voucher number.',
            'Reversal Protocol: Erroneous releases can be reversed with mandatory administrative justification.'
          ),
          new Paragraph({ spacing: { after: 120 } }),

          createStepBox(
            '9',
            'Regulatory Reporting & COA Liquidation (/treasurer/reports)',
            'Treasurer exports official monthly, quarterly, and annual disbursement reports filtered by date range, barangay, and assistance category.',
            'Export formats: Official Municipal PDF with letterhead and signature blocks, Excel (.xlsx), and CSV.'
          ),

          createH1('3. Request Status Lifecycle (Treasurer Perspective)'),
          createP('The table below defines status transitions and financial impacts during disbursement:'),
          createTable(
            ['Request State', 'Release Status', 'Action Available to Treasurer', 'Ledger Impact', 'Automated Notifications'],
            [
              ['Pending', 'N/A', 'View-only in All Requests queue', 'None', 'None'],
              ['Approved', 'Pending Release', 'Prepare Voucher or Return to Admin', 'Earmarked in pool', 'None'],
              ['Approved', 'Ready for Release', 'Confirm Release or Return to Admin', 'Earmarked in pool', 'Admin notified of readiness'],
              ['Released', 'Released', 'Inspect Payout & Print Voucher', 'Current balance deducted', 'Resident & Admin notified'],
              ['Approved', 'Pending Release (Returned)', 'View return status in ledger', 'Encumbrance restored', 'Admin notified with return notes']
            ]
          ),

          createH1('4. Anti-Fraud & Regulatory Controls'),
          createBullet('No Overdraft Guarantee: The system programmatically blocks release if fund balance is less than approved amount.'),
          createBullet('Duplicate Payout Prevention: Unique database constraints prevent double disbursement of the same request.'),
          createBullet('Immutable Financial Audit Trail: Every transaction logs user ID, IP address, voucher number, and timestamp in system_logs.'),
          createBullet('COA/DSWD Compliance: All payouts generate cross-referenced payout, transaction, and voucher entries matching Philippine accounting standards.')
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '..', 'FLOW CHART - TREASURER.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Successfully generated: ${outPath} (${buffer.length} bytes)`);
}

buildDocx().catch((err) => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
