import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
// The anonymous key is public by design. RLS and authenticated RPCs, never a
// browser service-role key, are responsible for protecting data.
export const supabase = url && key ? createClient(url, key) : null
export const cloudConfigured = Boolean(supabase)
const unavailable = () => ({ok:false,error:'Cloud service is not configured.'})

// Fetch all cloud reports
export async function getCloudReports() {
  if(!supabase)return unavailable()
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return {ok:true,reports:(data || []).map(r => ({...r.data,id:r.id,version:r.version,updated_at:r.updated_at}))}
  } catch (err) {
    console.warn('Supabase fetch failed:', err.message)
    return {ok:false,error:err.message}
  }
}

// Save or update a single report
export async function saveCloudReport(report) {
  if(!supabase)return unavailable()
  try {
    const {data,error} = await supabase.rpc('save_report',{p_report:report,p_expected_version:report.version||0})
    if (error) throw error
    return {ok:true,report:{...data.data,id:data.id,version:data.version,updated_at:data.updated_at}}
  } catch (err) {
    console.warn('Supabase save failed:', err.message)
    return {ok:false,error:err.message}
  }
}

// Delete a report from cloud
export async function deleteCloudReport(id,version) {
  if(!supabase)return unavailable()
  try {
    const { error } = await supabase.rpc('delete_report',{p_id:id,p_expected_version:version})
    if (error) throw error
    return {ok:true}
  } catch (err) {
    console.warn('Supabase delete failed:', err.message)
    return {ok:false,error:err.message}
  }
}

// Sync and merge local reports with cloud reports
export async function syncAllReports(localReports) {
  if(!supabase)return unavailable()
  try {
    const result = await getCloudReports()
    if (!result.ok) return result
    // Server is authoritative. Do not silently merge conflicting local copies.
    return result
  } catch (err) {
    console.warn('Sync failed:', err.message)
    return {ok:false,error:err.message}
  }
}
