import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://kqhmpqideymdocqlsjcm.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxaG1wcWlkZXltZG9jcWxzamNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwODc1MTAsImV4cCI6MjEwNjY2MzUxMH0.OEAeXHnaFkP7BqumbqTCsmncWDgK_enBzD_gAVEXChk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Fetch all cloud reports
export async function getCloudReports() {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map(r => r.data || r)
  } catch (err) {
    console.warn('Supabase fetch failed:', err.message)
    return null
  }
}

// Save or update a single report
export async function saveCloudReport(report) {
  try {
    const { error } = await supabase.from('reports').upsert({
      id: report.id,
      date: report.date,
      owner: report.owner || '',
      cert: report.cert || '',
      total: report.total || 0,
      data: report,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn('Supabase save failed:', err.message)
    return false
  }
}

// Delete a report from cloud
export async function deleteCloudReport(id) {
  try {
    const { error } = await supabase.from('reports').delete().eq('id', id)
    if (error) throw error
    return true
  } catch (err) {
    console.warn('Supabase delete failed:', err.message)
    return false
  }
}

// Sync and merge local reports with cloud reports
export async function syncAllReports(localReports) {
  try {
    const cloud = await getCloudReports()
    if (!cloud) return localReports

    const map = new Map()
    // Add local reports
    localReports.forEach(r => map.set(r.id, r))
    // Add / merge cloud reports
    cloud.forEach(r => map.set(r.id, r))

    const merged = Array.from(map.values())

    // If local has reports missing in cloud, upload them
    const missingInCloud = localReports.filter(lr => !cloud.some(cr => cr.id === lr.id))
    if (missingInCloud.length > 0) {
      await Promise.all(missingInCloud.map(saveCloudReport))
    }

    return merged
  } catch (err) {
    console.warn('Sync failed:', err.message)
    return localReports
  }
}
