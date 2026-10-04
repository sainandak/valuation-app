import {useEffect,useState} from 'react'
import App from './App.jsx'
import {cloudConfigured,supabase} from './supabase.js'

export default function AuthGate(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[ready,setReady]=useState(false)
 useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>setSession(next));return()=>subscription.unsubscribe()},[])
 if(!cloudConfigured)return <main className="auth"><h1>Configuration required</h1><p>This build is disabled until approved Supabase environment variables are configured.</p></main>
 if(!ready)return <main className="auth"><p>Checking secure session…</p></main>
 if(session)return <App/>
 return <main className="auth"><h1>Jewellery Valuation</h1><p>Sign in with your staff account.</p><form onSubmit={async e=>{e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email,password});setMessage(error?error.message:'')}}><label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p role="alert">{message}</p>}<button className="p">Sign in</button></form></main>
}
