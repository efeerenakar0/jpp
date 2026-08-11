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
    color: '#18212f',
    fontFamily: 'Geist',
    fontSize: 9.2,
    lineHeight: 1.5,
    paddingTop: 78,
    paddingRight: 48,
    paddingBottom: 68,
    paddingLeft: 48,
  },
  header: {
    position: 'absolute',
    top: 22,
    left: 48,
    right: 48,
    height: 38,
    borderBottomWidth: 1.2,
    borderBottomColor: '#1f4d46',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logo: {
    width: 27,
    height: 27,
    objectFit: 'contain',
  },
  brandMark: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#123f39',
    borderRadius: 2,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
  },
  brandText: {
    flexDirection: 'column',
  },
  brandName: {
    color: '#123f39',
    fontSize: 9.4,
    fontWeight: 700,
  },
  brandUnit: {
    color: '#667085',
    fontSize: 6.7,
    letterSpacing: 0.9,
    marginTop: 1,
  },
  headerIdentity: {
    alignItems: 'flex-end',
  },
  documentNoLabel: {
    color: '#667085',
    fontSize: 6.5,
    letterSpacing: 0.7,
  },
  documentNo: {
    color: '#18212f',
    fontSize: 8.2,
    fontWeight: 700,
    marginTop: 1,
  },
  titleEyebrow: {
    color: '#52606f',
    fontSize: 7,
    letterSpacing: 1.2,
    marginBottom: 5,
    textAlign: 'center',
  },
  title: {
    color: '#101828',
    fontSize: 16.5,
    fontWeight: 700,
    lineHeight: 1.22,
    marginBottom: 10,
    textAlign: 'center',
  },
  identityBand: {
    borderWidth: 1,
    borderColor: '#aeb8c4',
    marginBottom: 7,
  },
  identityRow: {
    flexDirection: 'row',
  },
  identityCell: {
    width: '33.333%',
    minHeight: 40,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRightWidth: 1,
    borderRightColor: '#cbd2da',
  },
  identityCellLast: {
    width: '33.334%',
    minHeight: 40,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  identityLabel: {
    color: '#5d6877',
    fontSize: 6.5,
    letterSpacing: 0.65,
    marginBottom: 3,
  },
  identityValue: {
    color: '#18212f',
    fontSize: 8.2,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  statusBand: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#aeb8c4',
    backgroundColor: '#f5f7f8',
    marginBottom: 18,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusMarker: {
    width: 7,
    height: 7,
    backgroundColor: '#1f4d46',
    borderRadius: 1,
    marginRight: 7,
  },
  statusText: {
    color: '#263442',
    fontSize: 7.4,
    fontWeight: 700,
    letterSpacing: 0.35,
  },
  section: {
    marginBottom: 14,
  },
  sectionHeading: {
    backgroundColor: '#edf3f1',
    borderBottomWidth: 1,
    borderBottomColor: '#9caaa7',
    borderLeftWidth: 4,
    borderLeftColor: '#1f4d46',
    color: '#123f39',
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 7,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  paragraph: {
    color: '#202b38',
    marginBottom: 6,
    textAlign: 'justify',
  },
  warning: {
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#a66a12',
    color: '#5c3b0c',
    fontSize: 8.2,
    marginTop: 8,
    padding: 9,
  },
  noticeHeading: {
    fontSize: 7.3,
    fontWeight: 700,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  legal: {
    backgroundColor: '#f5f7f9',
    borderWidth: 1,
    borderColor: '#9aa6b2',
    color: '#374556',
    fontSize: 8,
    marginTop: 8,
    padding: 9,
  },
  signaturesHeading: {
    borderBottomWidth: 1,
    borderBottomColor: '#aeb8c4',
    color: '#293746',
    fontSize: 7.2,
    fontWeight: 700,
    letterSpacing: 0.75,
    marginTop: 23,
    paddingBottom: 4,
  },
  signatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 9,
  },
  signature: {
    width: '46%',
    minHeight: 66,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#465464',
    marginTop: 38,
    paddingTop: 5,
  },
  signatureLabel: {
    color: '#293746',
    fontSize: 8,
    fontWeight: 700,
  },
  signatureName: {
    color: '#687586',
    fontSize: 7.7,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    top: 794,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: '#aeb8c4',
    color: '#647180',
    flexDirection: 'row',
    fontSize: 6.8,
    justifyContent: 'space-between',
    paddingTop: 7,
  },
  footerLeft: {
    width: '38%',
  },
  footerCenter: {
    textAlign: 'center',
    width: '38%',
  },
  footerRight: {
    textAlign: 'right',
    width: '24%',
  },
});

function safeLogo(value: unknown) {
  return typeof value === 'string' &&
    /^data:image\/(?:png|jpe?g);base64,/i.test(value) &&
    value.length < 2_500_000
    ? value
    : null;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bilgisi yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(date);
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
  const statusLabel = rendered.officialFormWarning
    ? 'HAZIRLIK BELGESİ - RESMÎ FORM DEĞİLDİR'
    : 'KURUMSAL BELGE - İMZA ÖNCESİ KONTROL EDİN';
  const createdAt = formatCreatedAt(snapshot.createdAt);

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
            ) : (
              <View style={styles.brandMark}>
                <Text>
                  {companyName.trim().charAt(0).toLocaleUpperCase('tr-TR') || 'B'}
                </Text>
              </View>
            )}
            <View style={styles.brandText}>
              <Text style={styles.brandName}>{companyName}</Text>
              <Text style={styles.brandUnit}>BELGE MERKEZİ</Text>
            </View>
          </View>
          <View style={styles.headerIdentity}>
            <Text style={styles.documentNoLabel}>BELGE NUMARASI</Text>
            <Text style={styles.documentNo}>{rendered.documentNumber}</Text>
          </View>
        </View>

        <Text style={styles.titleEyebrow}>KURUMSAL BELGE</Text>
        <Text style={styles.title}>{rendered.title}</Text>

        <View style={styles.identityBand} wrap={false}>
          <View style={styles.identityRow}>
            <View style={styles.identityCell}>
              <Text style={styles.identityLabel}>BELGE NUMARASI</Text>
              <Text style={styles.identityValue}>{rendered.documentNumber}</Text>
            </View>
            <View style={styles.identityCell}>
              <Text style={styles.identityLabel}>DÜZENLENME</Text>
              <Text style={styles.identityValue}>{rendered.issueLine}</Text>
            </View>
            <View style={styles.identityCellLast}>
              <Text style={styles.identityLabel}>ŞABLON SÜRÜMÜ</Text>
              <Text style={styles.identityValue}>
                Sürüm {snapshot.templateVersion}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statusBand} wrap={false}>
          <View style={styles.statusMarker} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

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
            <Text style={styles.noticeHeading}>ÖNEMLİ UYARI</Text>
            <Text>{rendered.officialFormWarning}</Text>
          </View>
        ) : null}

        <View style={styles.legal} wrap={false}>
          <Text style={styles.noticeHeading}>HUKUKİ KONTROL NOTU</Text>
          <Text>{rendered.legalNotice}</Text>
        </View>

        {rendered.signatures.length > 0 ? (
          <View>
            <Text style={styles.signaturesHeading}>İMZA ALANLARI</Text>
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
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {`Belge No: ${rendered.documentNumber} · Şablon v${snapshot.templateVersion}`}
          </Text>
          <Text style={styles.footerCenter}>{`Oluşturma: ${createdAt}`}</Text>
          <Text
            style={styles.footerRight}
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
