import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Avatar, Header, Field, Chip, Loading, EmptyState } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { searchJobs } from '@/lib/jobs'
import { JOB_TYPES } from '@/types'
import { colors, spacing, typography } from '@/theme'
import type { Job, JobType } from '@/types'

export default function Jobs() {
  const { session } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<JobType[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setJobs(await searchJobs({ query, jobTypes: types }, { limit: 50 }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [query, types])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const toggleType = (t: JobType) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  return (
    <Screen>
      <Header title="Jobs" />
      <View style={styles.search}>
        <Field label="" value={query} onChangeText={setQuery} placeholder="Search jobs..." autoCapitalize="none" />
      </View>
      <View style={styles.chips}>
        {JOB_TYPES.map((t) => (
          <Chip key={t.id} label={t.label} active={types.includes(t.id)} onPress={() => toggleType(t.id)} />
        ))}
      </View>
      {loading && jobs.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="💼" title="No jobs found" subtitle="Try adjusting your filters" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/job/${item.id}`)}>
              <View style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.company}>
                  {item.startups?.name ?? item.profiles?.full_name ?? 'Company'}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{item.job_type?.replace('_', ' ')}</Text>
                  {item.is_remote ? <Text style={styles.meta}>Remote</Text> : item.location ? <Text style={styles.meta}>{item.location}</Text> : null}
                  {item.experience_level ? <Text style={styles.meta}>{item.experience_level}</Text> : null}
                </View>
                {item.salary_min != null && (
                  <Text style={styles.salary}>
                    ${item.salary_min.toLocaleString()} - ${item.salary_max?.toLocaleString() ?? '∞'}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: { ...typography.subheading },
  company: { ...typography.caption, color: colors.primary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  meta: { ...typography.small, color: colors.textSecondary, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden' },
  salary: { ...typography.caption, color: colors.success, fontWeight: '700', marginTop: spacing.sm },
})
