import 'server-only';

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DocumentSnapshot } from './types';

interface DocumentDocxInput {
  snapshot: DocumentSnapshot;
  companyName: string;
}

const emptyBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

export async function renderDocumentDocx({
  snapshot,
  companyName,
}: DocumentDocxInput) {
  const rendered = snapshot.rendered;
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: companyName,
          bold: true,
          color: '047857',
          size: 20,
          font: 'Noto Sans',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: rendered.title,
          bold: true,
          size: 30,
          font: 'Noto Sans',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: `${rendered.documentNumber} · ${rendered.issueLine}`,
          color: '64748B',
          size: 17,
          font: 'Noto Sans',
        }),
      ],
    }),
  ];

  for (const section of rendered.sections) {
    children.push(
      new Paragraph({
        keepNext: true,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        shading: { fill: 'ECFDF5' },
        border: {
          left: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: '059669',
          },
        },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            color: '064E3B',
            size: 21,
            font: 'Noto Sans',
          }),
        ],
      })
    );
    for (const paragraph of section.paragraphs) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100, line: 300 },
          children: [
            new TextRun({
              text: paragraph,
              size: 19,
              font: 'Noto Sans',
            }),
          ],
        })
      );
    }
  }

  if (rendered.officialFormWarning) {
    children.push(
      new Paragraph({
        spacing: { before: 180, after: 120 },
        shading: { fill: 'FFFBEB' },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'F59E0B' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'F59E0B' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'F59E0B' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'F59E0B' },
        },
        children: [
          new TextRun({
            text: rendered.officialFormWarning,
            color: '78350F',
            size: 17,
            font: 'Noto Sans',
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 220 },
      shading: { fill: 'F8FAFC' },
      children: [
        new TextRun({
          text: rendered.legalNotice,
          color: '475569',
          italics: true,
          size: 16,
          font: 'Noto Sans',
        }),
      ],
    })
  );

  const signatureCells = rendered.signatures.map(
    (signature) =>
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: {
          top: emptyBorder,
          bottom: emptyBorder,
          left: emptyBorder,
          right: emptyBorder,
        },
        children: [
          new Paragraph({ spacing: { before: 720 } }),
          new Paragraph({
            border: {
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: '475569',
              },
            },
            children: [
              new TextRun({
                text: signature.label,
                bold: true,
                size: 17,
                font: 'Noto Sans',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: signature.name,
                color: '64748B',
                size: 16,
                font: 'Noto Sans',
              }),
            ],
          }),
        ],
      })
  );

  for (let index = 0; index < signatureCells.length; index += 2) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: emptyBorder,
          bottom: emptyBorder,
          left: emptyBorder,
          right: emptyBorder,
          insideHorizontal: emptyBorder,
          insideVertical: emptyBorder,
        },
        rows: [
          new TableRow({
            children: [
              signatureCells[index],
              signatureCells[index + 1] ||
                new TableCell({
                  borders: {
                    top: emptyBorder,
                    bottom: emptyBorder,
                    left: emptyBorder,
                    right: emptyBorder,
                  },
                  children: [new Paragraph('')],
                }),
            ],
          }),
        ],
      })
    );
  }

  const doc = new Document({
    creator: companyName,
    title: rendered.title,
    subject: rendered.documentNumber,
    description: 'Jasmine AI Belge Merkezi tarafından oluşturulmuştur.',
    styles: {
      default: {
        document: {
          run: { font: 'Noto Sans', size: 19, color: '172033' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Belge Merkezi · Sayfa ',
                    color: '94A3B8',
                    size: 14,
                    font: 'Noto Sans',
                  }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' / '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function safeDocumentFilename(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'belge'
  );
}
