import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://kqhmpqideymdocqlsjcm.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxaG1wcWlkZXltZG9jcWxzamNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwODc1MTAsImV4cCI6MjEwNjY2MzUxMH0.OEAeXHnaFkP7BqumbqTCsmncWDgK_enBzD_gAVEXChk'
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
    // 1. Try custom RPC function if created
    const rpcRes = await supabase.rpc('save_report',{p_report:report,p_expected_version:report.version||0})
    if (!rpcRes.error && rpcRes.data) {
      return {ok:true,report:{...(rpcRes.data.data||report),id:rpcRes.data.id||report.id,version:rpcRes.data.version||1,updated_at:rpcRes.data.updated_at}}
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Direct table upsert fallback (standard Supabase table)
  try {
    const { data: userData } = await supabase.auth.getUser().catch(()=>({data:null}))
    const userId = userData?.user?.id
    const payload = {
      id: report.id,
      date: report.date,
      owner: report.owner || '',
      cert: report.cert || '',
      total: report.total || 0,
      data: report,
      version: (report.version || 0) + 1,
      updated_at: new Date().toISOString()
    }
    if (userId) payload.user_id = userId

    const { error } = await supabase.from('reports').upsert(payload)
    if (error) throw error
    return {ok:true,report:{...report,version:payload.version,updated_at:payload.updated_at}}
  } catch (err) {
    console.warn('Supabase save failed:', err.message)
    return {ok:false,error:err.message}
  }
}

// Delete a report from cloud
export async function deleteCloudReport(id,version) {
  if(!supabase)return unavailable()
  try {
    const rpcRes = await supabase.rpc('delete_report',{p_id:id,p_expected_version:version})
    if (!rpcRes.error) return {ok:true}
  } catch (err) {
    // continue to fallback
  }

  try {
    const { error } = await supabase.from('reports').delete().eq('id',id)
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
