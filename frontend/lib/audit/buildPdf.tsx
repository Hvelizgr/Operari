/**
 * Audit-log PDF builder — Sprint 5.
 *
 * Renders a human-readable PDF summary of the most recent audit events
 * via `@react-pdf/renderer`. Targets a different consumer than the
 * NDJSON export: compliance officers who want a printable, signed
 * record rather than a stream a SIEM ingests.
 *
 * Loaded lazily on click — the package is ~1MB unpacked. Keeping the
 * factory in its own file means the main settings bundle never pays
 * the cost; a dynamic `import('@/lib/audit/buildPdf')` only fetches
 * it when the operator actually presses Download PDF.
 */

import { Document, Font, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface AuditEventForPdf {
  seq: string;
  type: string;
  actorId: string | null;
  actorType: string | null;
  hash: string;
  prevHash: string;
  createdAt: string;
}

interface BuildOptions {
  tenantName: string;
  events: AuditEventForPdf[];
  /** Result of the chain verify call so the PDF reports tamper-status
   *  inline. Optional — when absent we just omit the badge. */
  verifyIntact?: boolean | null;
  verifyEventCount?: number | null;
  generatedAt?: Date;
}

// React-PDF doesn't share fonts with the browser; we pin Helvetica
// (built-in) so the document renders identically everywhere without
// an external font fetch.
Font.registerHyphenationCallback(word => [word]);

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 9,
    color: '#666666',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  badgeOk: { backgroundColor: '#d1f4dc', color: '#0f6b3a' },
  badgeWarn: { backgroundColor: '#ffe4c4', color: '#8a4500' },
  table: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e6e6e6',
  },
  rowHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  cellSeq: { width: 36, fontFamily: 'Courier', fontSize: 8 },
  cellType: { width: 110, fontFamily: 'Courier', fontSize: 8 },
  cellActor: { width: 120, fontFamily: 'Courier', fontSize: 8, color: '#444444' },
  cellHash: { width: 80, fontFamily: 'Courier', fontSize: 8, color: '#666666' },
  cellTime: { flex: 1, fontSize: 8, color: '#444444', textAlign: 'right' },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#444444' },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 7,
    color: '#999999',
    textAlign: 'center',
  },
});

function AuditDocument({
  tenantName,
  events,
  verifyIntact,
  verifyEventCount,
  generatedAt,
}: Required<Pick<BuildOptions, 'tenantName' | 'events'>> &
  Pick<BuildOptions, 'verifyIntact' | 'verifyEventCount' | 'generatedAt'>) {
  const stamp = (generatedAt ?? new Date()).toISOString();
  return (
    <Document
      title={`Operari audit log — ${tenantName}`}
      author="Operari"
      subject={`Tenant audit chain export ${stamp}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Operari audit log</Text>
            <Text style={styles.subtitle}>{tenantName}</Text>
            <Text style={styles.subtitle}>Generated {stamp}</Text>
          </View>
          {verifyIntact != null ? (
            <Text style={[styles.badge, verifyIntact ? styles.badgeOk : styles.badgeWarn]}>
              {verifyIntact
                ? `Chain intact${verifyEventCount != null ? ` · ${verifyEventCount} events` : ''}`
                : 'Chain integrity check failed'}
            </Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={[styles.cellSeq, styles.headerCell]}>SEQ</Text>
            <Text style={[styles.cellType, styles.headerCell]}>TYPE</Text>
            <Text style={[styles.cellActor, styles.headerCell]}>ACTOR</Text>
            <Text style={[styles.cellHash, styles.headerCell]}>HASH</Text>
            <Text style={[styles.cellTime, styles.headerCell]}>WHEN (UTC)</Text>
          </View>
          {events.map(ev => (
            <View key={ev.seq} style={styles.row} wrap={false}>
              <Text style={styles.cellSeq}>{ev.seq}</Text>
              <Text style={styles.cellType}>{ev.type}</Text>
              <Text style={styles.cellActor}>
                {ev.actorType ? `${ev.actorType}:` : ''}
                {ev.actorId ?? '—'}
              </Text>
              <Text style={styles.cellHash}>{ev.hash.slice(0, 12)}…</Text>
              <Text style={styles.cellTime}>{ev.createdAt}</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages} · Hashes are SHA-256 prefixes; full hashes ship in the NDJSON export.`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/**
 * Render the audit document and return a Blob ready to drop into an
 * anchor download. Pure async — caller owns the URL lifecycle.
 */
export async function buildAuditPdf(opts: BuildOptions): Promise<Blob> {
  return pdf(
    <AuditDocument
      tenantName={opts.tenantName}
      events={opts.events}
      verifyIntact={opts.verifyIntact ?? null}
      verifyEventCount={opts.verifyEventCount ?? null}
      generatedAt={opts.generatedAt}
    />
  ).toBlob();
}
