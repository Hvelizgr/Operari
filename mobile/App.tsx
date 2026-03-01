import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Activity, CheckCircle, XCircle, Clock, Settings, Layout } from 'lucide-react-native';

const WorkflowCard = ({ name, status, lastRun }: { name: string, status: 'success' | 'failed' | 'running', lastRun: string }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Layout size={20} color="#6366f1" />
      <Text style={styles.cardTitle}>{name}</Text>
    </View>
    <View style={styles.cardFooter}>
      <View style={styles.statusBadge}>
        {status === 'success' && <CheckCircle size={14} color="#22c55e" />}
        {status === 'failed' && <XCircle size={14} color="#ef4444" />}
        {status === 'running' && <Activity size={14} color="#3b82f6" />}
        <Text style={[styles.statusText, { color: status === 'success' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#3b82f6' }]}>
          {status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.lastRunText}>{lastRun}</Text>
    </View>
  </View>
);

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NanoFlow Mobile</Text>
        <TouchableOpacity>
          <Settings color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>124</Text>
            <Text style={styles.statLabel}>Executions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>98%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Workflows</Text>
        <WorkflowCard name="Customer Onboarding" status="success" lastRun="2m ago" />
        <WorkflowCard name="Inventory Sync" status="running" lastRun="Now" />
        <WorkflowCard name="Lead Enrichment" status="failed" lastRun="1h ago" />
        <WorkflowCard name="Slack Notification" status="success" lastRun="3h ago" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  lastRunText: {
    color: '#64748b',
    fontSize: 12,
  },
});
