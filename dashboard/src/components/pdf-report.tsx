import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.5,
  },
  coverPage: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Times-Roman',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 28,
    marginBottom: 20,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 16,
    color: '#444',
    marginBottom: 50,
  },
  coverMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 100,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  paragraph: {
    marginBottom: 15,
    textAlign: 'justify',
  },
  chartContainer: {
    marginTop: 15,
    marginBottom: 15,
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  chartLabel: {
    width: 120,
    fontSize: 9,
    fontFamily: 'Times-Roman',
  },
  chartBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartValue: {
    fontSize: 8,
    marginLeft: 5,
    color: '#4b5563',
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000',
    marginTop: 15,
    marginBottom: 15,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row"
  },
  tableHeader: {
    margin: "auto",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    paddingTop: 5,
  },
  tableCellHeader: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
  },
  tableCell: {
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 9,
    color: '#9ca3af',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});

interface PdfReportProps {
  data: any[];
  severityData: any[];
  topRules: any[];
}

export const SecurityReportPDF = ({ data, severityData, topRules }: PdfReportProps) => {
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);
  const totalBlocked = data.reduce((sum, d) => sum + d.blocked, 0);
  const blockRate = totalRequests === 0 ? 0 : ((totalBlocked / totalRequests) * 100).toFixed(1);

  // Calculate max values for bar charts
  const maxRequests = Math.max(...data.map(d => d.requests), 1);
  const maxSeverity = Math.max(...severityData.map(d => d.value), 1);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverTitle}>PromptWall</Text>
        <Text style={styles.coverSubtitle}>Enterprise Cybersecurity & Audit Report</Text>
        
        <Text style={styles.coverMeta}>
          Date: {new Date().toLocaleDateString()}{'\n'}
          Classification: TLP:AMBER (Confidential){'\n'}
          Prepared by: PromptWall Security
        </Text>
      </Page>

      {/* Report Content */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>1.0 Executive Summary</Text>
        <Text style={styles.paragraph}>
          This document serves as the formal technical analysis of API traffic and threat telemetry observed by PromptWall. 
          During this reporting period, the firewall processed a total of {totalRequests.toLocaleString()} LLM requests. 
          A total of {totalBlocked.toLocaleString()} malicious or out-of-policy requests were successfully intercepted and blocked, 
          representing an overall threat mitigation rate of {blockRate}%.
        </Text>

        <Text style={styles.sectionTitle}>2.0 Threat Telemetry</Text>
        <Text style={styles.paragraph}>
          The following native plot illustrates the volume of benign API traffic versus blocked malicious requests at various intervals.
        </Text>
        
        {/* Native Bar Chart for Traffic */}
        <View style={styles.chartContainer}>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 10, marginBottom: 10, textAlign: 'center' }}>Traffic Volume (Blue: Allowed, Red: Blocked)</Text>
          {data.map((d, i) => {
            const reqWidth = maxRequests > 0 ? `${(d.requests / maxRequests) * 100}%` : '0%';
            const blockWidth = maxRequests > 0 ? `${(d.blocked / maxRequests) * 100}%` : '0%';
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{d.time} (Allowed)</Text>
                  <View style={styles.chartBarContainer}>
                    <View style={{ width: reqWidth, height: 10, backgroundColor: '#3b82f6' }} />
                    <Text style={styles.chartValue}>{d.requests}</Text>
                  </View>
                </View>
                <View style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{d.time} (Blocked)</Text>
                  <View style={styles.chartBarContainer}>
                    <View style={{ width: blockWidth, height: 10, backgroundColor: '#ef4444' }} />
                    <Text style={styles.chartValue}>{d.blocked}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.paragraph}>
          A breakdown of the severity levels for the blocked requests is provided below. High severity threats typically involve prompt injection or secret leakage attempts.
        </Text>
        
        {/* Native Bar Chart for Severity */}
        <View style={styles.chartContainer}>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 10, marginBottom: 10, textAlign: 'center' }}>Threat Severity Distribution</Text>
          {severityData.map((d, i) => {
            const width = maxSeverity > 0 ? `${(d.value / maxSeverity) * 100}%` : '0%';
            return (
              <View key={i} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{d.name}</Text>
                <View style={styles.chartBarContainer}>
                  <View style={{ width: width, height: 12, backgroundColor: d.color }} />
                  <Text style={styles.chartValue}>{d.value}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>3.0 Policy Violations</Text>
        <Text style={styles.paragraph}>
          The table below details the specific security and compliance policies that were triggered during the reporting period, ordered by frequency of violation.
        </Text>
        
        {/* Academic LaTeX Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={{width: '10%'}}><Text style={styles.tableCellHeader}>Rank</Text></View>
            <View style={{width: '60%'}}><Text style={styles.tableCellHeader}>Policy / Rule Name</Text></View>
            <View style={{width: '30%'}}><Text style={styles.tableCellHeader}>Violation Count</Text></View>
          </View>
          {topRules.map((rule, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={{width: '10%', paddingTop: 5, paddingBottom: 5}}>
                <Text style={styles.tableCell}>{index + 1}</Text>
              </View>
              <View style={{width: '60%', paddingTop: 5, paddingBottom: 5}}>
                <Text style={styles.tableCell}>{rule.rule}</Text>
              </View>
              <View style={{width: '30%', paddingTop: 5, paddingBottom: 5}}>
                <Text style={styles.tableCell}>{rule.hits.toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>TLP:AMBER - CONFIDENTIAL</Text>
          <Text>PromptWall Analytics</Text>
        </View>
      </Page>
    </Document>
  );
};
