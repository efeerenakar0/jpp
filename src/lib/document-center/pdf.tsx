import 'server-only';

import path from 'node:path';
import React from 'react';
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { DocumentSnapshot } from './types';

const geistFontPath = path.join(
  process.cwd(),
  'node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf',
);

Font.register({
  family: 'Geist',
  fonts: [
    {
      src: geistFontPath,
      fontWeight: 400,
    },
    {
      src: geistFontPath,
      fontWeight: 700,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#172033',
    fontFamily: 'Geist',
    fontSize: 9.4,
    lineHeight: 1.55,
    paddingTop: 66,
    paddingRight: 52,
    paddingBottom: 60,
    paddingLeft: 52,
  },
  header: {
    position: 'absolute',
    top: 24,
    left: 52,
    right: 52,
    height: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#d6dde8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
  },
  brandName: {
    color: '#065f46',
    fontSize: 9,
    fontWeight: 700,
  },
  documentNo: {
    color: '#667085',
    fontSize: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: 700,
    lineHeight: 1.25,
    marginBottom: 5,
    textAlign: 'center',
  },
  issue: {
    color: '#667085',
    fontSize: 8.5,
    marginBottom: 18,
    textAlign: 'center',
  },
  section: {
    marginBottom: 13,
  },
  sectionHeading: {
    backgroundColor: '#ecfdf5',
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    color: '#064e3b',
    fontSize: 10.5,
    fontWeight: 700,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  paragraph: {
    marginBottom: 5,
    textAlign: 'justify',
  },
  warning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 3,
    color: '#78350f',
    fontSize: 8.5,
    marginTop: 7,
    padding: 8,
  },
  legal: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    color: '#475569',
    fontSize: 8.2,
    marginTop: 8,
    padding: 8,
  },
  signatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 24,
  },
  signature: {
    width: '46%',
    minHeight: 64,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#475569',
    marginTop: 34,
    paddingTop: 4,
  },
  signatureLabel: {
    color: '#334155',
    fontSize: 8,
    fontWeight: 700,
  },
  signatureName: {
    color: '#64748b',
    fontSize: 8,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    color: '#94a3b8',
    flexDirection: 'row',
    fontSize: 7.5,
    justifyContent: 'space-between',
    paddingTop: 6,
  },
});

function safeLogo(value: unknown) {
  return typeof value === 'string' &&
    /^data:image\/(?:png|jpe?g);base64,/i.test(value) &&
    value.length < 2_500_000
    ? value
    : null;
}

interface DocumentPdfProps {
  snapshot: DocumentSnapshot;
  companyName: string;
  logo: string | null;
}

export function DocumentPdf({
  snapshot,
  companyName,
  logo,
}: DocumentPdfProps) {
  const rendered = snapshot.rendered;
  const validLogo = safeLogo(logo);

  return (
    <Document
      title={rendered.title}
      author={companyName}
      subject={rendered.documentNumber}
      language="tr-TR"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            {validLogo ? (
              // React PDF's Image is not a DOM image and has no alt prop.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={validLogo} style={styles.logo} />
            ) : null}
            <Text style={styles.brandName}>{companyName}</Text>
          </View>
          <Text style={styles.documentNo}>{rendered.documentNumber}</Text>
        </View>

        <Text style={styles.title}>{rendered.title}</Text>
        <Text style={styles.issue}>{rendered.issueLine}</Text>

        {rendered.sections.map((section) => (
          <View
            key={section.id}
            style={styles.section}
            wrap={!section.keepTogether}
          >
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={`${section.id}-${index}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        {rendered.officialFormWarning ? (
          <View style={styles.warning} wrap={false}>
            <Text>{rendered.officialFormWarning}</Text>
          </View>
        ) : null}

        <View style={styles.legal} wrap={false}>
          <Text>{rendered.legalNotice}</Text>
        </View>

        <View style={styles.signatures}>
          {rendered.signatures.map((signature, index) => (
            <View
              key={`${signature.label}-${index}`}
              style={styles.signature}
              wrap={false}
            >
              <View style={styles.signatureLine}>
                <Text style={styles.signatureLabel}>{signature.label}</Text>
                <Text style={styles.signatureName}>{signature.name}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Belge Merkezi · Değiştirilemez sürüm {snapshot.templateVersion}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Sayfa ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(input: DocumentPdfProps) {
  return renderToBuffer(<DocumentPdf {...input} />);
}
