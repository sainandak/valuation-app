import {useState,useEffect} from 'react'
import {calc,inr,num,ratePerGram,validateReport} from './valuation.js'
import {saveCloudReport,deleteCloudReport,syncAllReports,supabase} from './supabase.js'
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function useLS(k,d){const[v,s]=useState(()=>load(k,d));useEffect(()=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}},[k,v]);return[v,s]}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6)
const today=()=>new Date().toISOString().slice(0,10)
const newItem=(p={})=>({id:uid(),name:p.name||'',metal:p.metal||'Silver',qty:1,gross:'',stone:'',purity:p.purity||'',fixed:''})
const DEF=[
  {name:'Eyes',metal:'Silver',purity:35},
  {name:'Jula',metal:'Silver',purity:40},
  {name:'Bracelet',metal:'Silver',purity:50},
  {name:'House & Hourse',metal:'Silver',purity:50},
  {name:'Big Jula & Others',metal:'Silver',purity:40},
  {name:'Katori',metal:'Silver',purity:40},
  {name:'Nath',metal:'Gold',purity:65},
  {name:'Pusthay & Wire Nath',metal:'Gold',purity:65},
  {name:'2 USD Dollars',metal:'Other',purity:''},
  {name:'Kuwait 100 Files',metal:'Other',purity:''},
  {name:'US Quarter Coin',metal:'Other',purity:''},
  {name:'US Penny',metal:'Other',purity:''},
  {name:'Pus Nickel or Dime',metal:'Other',purity:''},
  {name:'Canadian Dollar Loonie',metal:'Other',purity:''},
  {name:'Srilankan Coin',metal:'Other',purity:''},
  {name:'Other Small Coin',metal:'Other',purity:''},
]
const L=({t,children})=><label>{t}{children}</label>
const N=p=><input type="number" inputMode="decimal" step="any" {...p}/>

export default function App({ user }){
const handleSignOut=async()=>{
  try{sessionStorage.removeItem('bday_greeted')}catch{}
  if(supabase)await supabase.auth.signOut()
}
useEffect(()=>{
  if(!supabase)return
  let timer
  const resetTimer=()=>{
    clearTimeout(timer)
    timer=setTimeout(()=>{
      try{sessionStorage.removeItem('bday_greeted')}catch{}
      supabase.auth.signOut()
    },30*60*1000)
  }
  const events=['mousemove','keydown','click','scroll','touchstart']
  events.forEach(e=>window.addEventListener(e,resetTimer,{passive:true}))
  resetTimer()
  return()=>{
    clearTimeout(timer)
    events.forEach(e=>window.removeEventListener(e,resetTimer))
  }
},[])
const[bdayEnabled,setBdayEnabled]=useLS('bdayGreeting',true)
const[showBday,setShowBday]=useState(()=>{try{return!sessionStorage.getItem('bday_greeted')}catch{return true}})
const closeBday=()=>{try{sessionStorage.setItem('bday_greeted','1')}catch{};setShowBday(false)}
const[tab,setTab]=useState('calc')
const[cfg,setCfg]=useLS('cfg',{valuer:'',valuerTitle:'Valuer',place:'',silver:'',gold:''})
const[presets,setPresets]=useLS('presets',DEF)
const[list,setList]=useLS('reports',[])
const[shop,setShop]=useLS('shop',{name:'Sri Vijaya Laxmi Jewellery Works',addr:'',phone:'',note:'',logo:''})
const fresh=()=>({id:uid(),date:today(),owner:'',phone:'',cert:cfg.cert||'',place:cfg.place,footerPlace:'',valuer:cfg.valuer,valuerTitle:cfg.valuerTitle||'Valuer',silverG:cfg.silverG||'',goldG:cfg.goldG||'',items:[newItem()]})
const[r,setR]=useState(fresh)
const[q,setQ]=useState('')
const[period,setPeriod]=useState('all')
const[pCat,setPCat]=useState('All')
const newCItem=(metal='Gold')=>({id:uid(),name:'',metal,rate:'',gross:'',stone:'',purity:''})
const[cGoldRate,setCGoldRate]=useState('')
const[cSilverRate,setCSilverRate]=useState('')
const[cItems,setCItems]=useState([newCItem('Gold')])
const updateCItem=(id,k,v)=>setCItems(arr=>arr.map(i=>i.id===id?{...i,[k]:v}:i))
const addCItem=(metal='Gold')=>setCItems(arr=>[...arr,newCItem(metal)])
const removeCItem=id=>setCItems(arr=>arr.length>1?arr.filter(i=>i.id!==id):[newCItem('Gold')])
const resetCalc=()=>{setCGoldRate('');setCSilverRate('');setCItems([newCItem('Gold')]);flash('Calculator cleared')}
const cCalcRows=cItems.map(it=>{
  const activeRate=it.rate!==''?num(it.rate):(it.metal==='Gold'?num(cGoldRate):num(cSilverRate))
  const gross=num(it.gross),stone=num(it.stone),net=Math.max(gross-stone,0),purity=num(it.purity),fine=net*(purity/100)
  const val=Math.floor(Math.round(fine*activeRate*1e6)/1e6)
  return{...it,gross,stone,net,purity,fine,activeRate,val}
})
const cTotalGross=cCalcRows.reduce((s,x)=>s+x.gross,0),cTotalStone=cCalcRows.reduce((s,x)=>s+x.stone,0),cTotalNet=cCalcRows.reduce((s,x)=>s+x.net,0),cTotalFine=cCalcRows.reduce((s,x)=>s+x.fine,0),cTotalVal=cCalcRows.reduce((s,x)=>s+x.val,0)
const validCalc=()=>{const bad=cCalcRows.find(x=>x.gross<=0||x.activeRate<=0||x.purity<=0||x.purity>100||x.stone<0||x.stone>x.gross);if(bad){flash('Each estimate needs positive weight, rate and purity; stone weight cannot exceed gross weight');return false}return true}
const shareCalc=()=>{
  if(!validCalc())return
  if(!cTotalVal&&!cTotalGross){flash('Enter weight and rate to share');return}
  const lines=[
    shop.name||'Sri Vijaya Laxmi Jewellery Works',
    'Quick Valuation Estimation',
    `Date: ${today().split('-').reverse().join('-')}`,
    '────────────────────────',
    ...cCalcRows.filter(x=>x.gross||x.val).map((x,idx)=>
      `${idx+1}. ${x.name||(x.metal+' Ornament')} (${x.metal})\n`+
      `   Gross: ${x.gross.toFixed(3)}g | Stone: ${x.stone?x.stone.toFixed(3)+'g':'Nil'} | Net: ${x.net.toFixed(3)}g | Purity: ${x.purity}%\n`+
      `   Value: ₹${x.val.toLocaleString('en-IN')}`
    ),
    '────────────────────────',
    `Total Items: ${cCalcRows.filter(x=>x.gross||x.val).length||1}`,
    `Total Gross Wt: ${cTotalGross.toFixed(3)} g`,
    cTotalStone>0?`Total Stone Wt: ${cTotalStone.toFixed(3)} g`:null,
    `Total Net Wt: ${cTotalNet.toFixed(3)} g`,
    `Total Fine Metal: ${cTotalFine.toFixed(3)} g`,
    `ESTIMATED TOTAL: ₹${cTotalVal.toLocaleString('en-IN')}/-`,
    shop.phone?`Phone: ${shop.phone}`:null
  ].filter(Boolean).join('\n');
  navigator.share?navigator.share({title:'Quick Valuation Estimation',text:lines}).catch(()=>{}) : window.open('https://wa.me/?text='+encodeURIComponent(lines));
}
const[msg,setMsg]=useState('')
const flash=t=>{setMsg(t);setTimeout(()=>setMsg(''),1800)}
const up=(k,v)=>setR(x=>({...x,[k]:v}))
const rate=(k,v)=>{up(k,v);setCfg(c=>({...c,[k]:v}))}
const setItem=(id,k,v)=>setR(x=>({...x,items:x.items.map(i=>i.id===id?{...i,[k]:v}:i)}))
const add=p=>setR(x=>({...x,items:[...x.items.filter(i=>i.name||i.gross||i.fixed),newItem(p)]}))
const rows=r.items.map(i=>({i,c:calc(i,r)}))
const total=rows.reduce((s,x)=>s+x.c.value,0)
const requireValid=()=>{const errors=validateReport(r,list);if(errors.length){flash(errors[0]);return false}return true}
const save=async()=>{
  if(!requireValid())return;
  const updated={...r,total};
  setList(l=>[updated,...l.filter(x=>x.id!==updated.id)]);
  flash('Saving...');
  const result=await saveCloudReport(updated);
  if(!result.ok){
    flash('Saved on device');
    return;
  }
  setR(result.report);
  setList(l=>[result.report,...l.filter(x=>x.id!==result.report.id)]);
  flash('Saved & Synced ☁️');
}
useEffect(()=>{
  syncAllReports().then(result=>{
    if(result.ok){
      setList(result.reports);
    }
  }).catch(()=>{});
},[])
const owners=[...new Set(list.map(x=>x.owner).filter(Boolean))]
const exp=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),cfg,presets,list,shop})],{type:'application/json'}));a.href=url;a.download='valuation-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
const imp=f=>{const rd=new FileReader();rd.onload=()=>{try{const o=JSON.parse(rd.result);if(!o||typeof o!=='object'||(o.list!==undefined&&!Array.isArray(o.list))||(o.presets!==undefined&&!Array.isArray(o.presets)))throw new Error();o.cfg&&setCfg(o.cfg);o.presets&&setPresets(o.presets);o.list&&setList(o.list);o.shop&&setShop(o.shop);flash('Backup restored')}catch{flash('Not a valid backup file')}};rd.onerror=()=>flash('Could not read backup file');rd.readAsText(f)}
const share=()=>{if(!requireValid())return;const t=[shop.name,'Valuation '+r.date+(r.cert?' No. '+r.cert:''),'Owner: '+r.owner,...rows.filter(({i})=>i.name||i.gross||i.fixed).map(({i,c},n)=>`${n+1}. ${i.name} ${i.gross?num(i.gross)+' g ':''}${inr(c.value)}`),'Total: '+inr(total),shop.phone].filter(Boolean).join('\n');navigator.share?navigator.share({title:'Valuation',text:t}).catch(()=>{}):window.open('https://wa.me/?text='+encodeURIComponent(t))}
const logo=f=>{const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,300/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);setShop(x=>({...x,logo:c.toDataURL('image/png')}))};im.src=rd.result};rd.readAsDataURL(f)}
const shown=list.filter(x=>(x.owner+x.cert+x.date+(x.phone||'')).toLowerCase().includes(q.toLowerCase()))
const periodList=list.filter(x=>{
  if(period==='today')return x.date===today()
  if(period==='month')return x.date?.startsWith(today().slice(0,7))
  return true
})
const stats={
  val:periodList.reduce((s,x)=>s+(x.total||0),0),
  count:periodList.length,
  gold:periodList.reduce((s,x)=>s+(x.items||[]).filter(i=>i.metal==='Gold').reduce((a,b)=>a+(num(b.gross)||0),0),0),
  silver:periodList.reduce((s,x)=>s+(x.items||[]).filter(i=>i.metal==='Silver').reduce((a,b)=>a+(num(b.gross)||0),0),0)
}
const exportToExcel=()=>{
  if(!list.length){flash('No saved reports to export');return}
  const headers=['S.No','Date','Certificate No','Owner Name','Customer Phone','Place','Valuer','Total Items','Total Gross Wt (g)','Total Net Wt (g)','Total Pure Wt (g)','Valuation Amount (INR)','Items Summary']
  const rowsData=list.map((item,idx)=>{
    const reportRows=(item.items||[]).map(i=>({i,c:calc(i,item)}))
    const gross=reportRows.reduce((s,x)=>s+(num(x.i.gross)||0),0)
    const net=reportRows.reduce((s,x)=>s+(x.c.net||0),0)
    const pure=reportRows.reduce((s,x)=>s+(x.c.pure||0),0)
    const itemsSummary=(item.items||[]).filter(i=>i.name||i.gross).map(i=>`${i.name} (${i.metal} ${i.gross||0}g)`).join('; ')
    return[
      idx+1,
      `"${item.date||''}"`,
      `"${item.cert||''}"`,
      `"${(item.owner||'').replace(/"/g,'""')}"`,
      `"${item.phone||''}"`,
      `"${(item.place||'').replace(/"/g,'""')}"`,
      `"${(item.valuer||'').replace(/"/g,'""')}"`,
      item.items?.length||0,
      gross.toFixed(3),
      net.toFixed(3),
      pure.toFixed(3),
      item.total||0,
      `"${itemsSummary.replace(/"/g,'""')}"`
    ].join(',')
  })
  const csvContent='\uFEFF'+[headers.join(','),...rowsData].join('\r\n')
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=`Jewellery_Valuations_${today()}.csv`
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),500)
  flash('Excel CSV downloaded 📊')
}
const sendCustomerWhatsApp=target=>{
  const item=target||r
  const targetRows=item.items?item.items.map(i=>({i,c:calc(i,item)})):rows
  const targetTotal=item.total||total
  const phoneClean=(item.phone||'').replace(/[^0-9]/g,'')
  const phoneNum=phoneClean.length===10?'91'+phoneClean:(phoneClean.length>10?phoneClean:null)
  const lines=[
    `*${shop.name||'Sri Vijaya Laxmi Jewellery Works'}*`,
    `Jewellery Valuation Certificate`,
    `────────────────────────`,
    `Customer: ${item.owner||'Valued Customer'}`,
    `Date: ${item.date.split('-').reverse().join('-')}`,
    item.cert?`Certificate No: ${item.cert}`:null,
    `────────────────────────`,
    ...targetRows.filter(({i})=>i.name||i.gross||i.fixed).map(({i,c},n)=>
      `${n+1}. ${i.name} (${i.metal}) - ${i.gross?num(i.gross).toFixed(3)+'g ':''}₹${c.value.toLocaleString('en-IN')}`
    ),
    `────────────────────────`,
    `*TOTAL VALUATION: ₹ ${targetTotal.toLocaleString('en-IN')}/-*`,
    `Valuer: ${item.valuer||cfg.valuer}`,
    shop.phone?`Shop Phone: ${shop.phone}`:null,
    `\nThank you for choosing ${shop.name}!`
  ].filter(Boolean).join('\n')

  if(phoneNum){
    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(lines)}`)
  }else{
    navigator.share?navigator.share({title:'Valuation Certificate',text:lines}).catch(()=>{}) : window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`)
  }
}

return <div className="app">
{bdayEnabled&&showBday&&<div className="bday-overlay noprint" onClick={closeBday}><div className="bday-modal" onClick={e=>e.stopPropagation()}><div className="bday-icon">🎂🎉✨</div><h2 className="bday-title">Happy Birthday Bava!</h2><p className="bday-sub">Wishing you a fantastic year filled with happiness, good health, peace, and great prosperity!</p><button className="p bday-btn" onClick={closeBday}>Thank you! 🍰</button></div></div>}
<div className="noprint app-header">
{user&&<div className="user-bar"><div className="user-info"><span>👤</span> <strong>{user.email}</strong></div><button className="btn-logout" onClick={handleSignOut} title="Sign out">🚪 Sign out</button></div>}
<h1>{shop.name || 'Sri Vijaya Laxmi Jewellery Works'}</h1>
<div className="app-sub">Jewellery Valuation Center</div>
<nav>{[['calc','Quick Calc'],['new','Report'],['saved','Saved'],['set','Settings']].map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t}</button>)}</nav></div>

{tab==='new'&&<>
<div className="noprint">
<div className="card"><h2>Today's rates</h2><div className="g2"><L t="Silver ₹ per gram"><N value={r.silverG} onChange={e=>rate('silverG',e.target.value)}/></L><L t="Gold ₹ per gram"><N value={r.goldG} onChange={e=>rate('goldG',e.target.value)}/></L></div><p className="val">Report shows silver ₹{(ratePerGram(r,'Silver')*1000).toLocaleString('en-IN')} per kg, gold ₹{(ratePerGram(r,'Gold')*10).toLocaleString('en-IN')} per 10 g</p></div>
<div className="card"><h2>Details</h2><div className="g2"><L t="Date of Valuation"><input type="date" value={r.date} onChange={e=>up('date',e.target.value)}/></L><L t="Certificate no."><input value={r.cert} onChange={e=>up('cert',e.target.value)}/></L></div>
<div className="g2"><L t="Name of the owner(s)"><input list="own" value={r.owner} onChange={e=>up('owner',e.target.value)} placeholder="e.g. Ramesh Kumar"/></L><L t="Customer Mobile / WhatsApp (Optional)"><input type="tel" value={r.phone||''} onChange={e=>up('phone',e.target.value)} placeholder="e.g. 9848012345"/></L></div><datalist id="own">{owners.map(o=><option key={o} value={o}/>)}</datalist>
<div className="g2"><L t="Name of Valuer"><input value={r.valuer} onChange={e=>up('valuer',e.target.value)}/></L><L t="Valuer title (Footer)"><input value={r.valuerTitle||''} onChange={e=>up('valuerTitle',e.target.value)}/></L></div>
<L t="Place (Address)"><input value={r.place} onChange={e=>up('place',e.target.value)}/></L>
<L t="Place (Footer)"><input value={r.footerPlace||''} onChange={e=>up('footerPlace',e.target.value)} placeholder="e.g. Hyderabad"/></L></div>
<div className="card"><h2>Items</h2>
<div className="preset-filter">
  {['All','Silver','Gold','Other'].map(cat=><button key={cat} className={pCat===cat?'on':''} onClick={()=>setPCat(cat)}>{cat}</button>)}
</div>
<div className="chips">
  {presets.filter(p=>pCat==='All'||p.metal===pCat).map((p,k)=><button key={k} onClick={()=>add(p)}>+ {p.name}</button>)}
  <button className="x" onClick={()=>add()}>+ Blank</button>
</div>
{rows.map(({i,c},n)=><div className="row" key={i.id}><div className="rh"><b>Item {n+1} {i.metal?`· ${i.metal}`:''}</b>{r.items.length>1&&<button className="x danger" onClick={()=>setR(x=>({...x,items:x.items.filter(y=>y.id!==i.id)}))}>✕ Remove</button>}</div>
<L t="Description"><input value={i.name} onChange={e=>setItem(i.id,'name',e.target.value)}/></L>
<div className="g3"><L t="Metal"><select value={i.metal} onChange={e=>setItem(i.id,'metal',e.target.value)}><option>Silver</option><option>Gold</option><option>Other</option></select></L><L t="Qty"><N value={i.qty} onChange={e=>setItem(i.id,'qty',e.target.value)}/></L><L t="Purity %"><N value={i.purity} onChange={e=>setItem(i.id,'purity',e.target.value)}/></L></div>
<div className="g3"><L t="Gross wt (g)"><N value={i.gross} onChange={e=>setItem(i.id,'gross',e.target.value)}/></L><L t="Stone wt"><N value={i.stone} onChange={e=>setItem(i.id,'stone',e.target.value)}/></L><L t="Fixed ₹ (coins/other)"><N value={i.fixed} onChange={e=>setItem(i.id,'fixed',e.target.value)}/></L></div>
<p className="val"><span>Pure metal: <b>{c.pure.toFixed(3)} g</b></span><span>Value: <b>{inr(c.value)}</b></span></p></div>)}
<div className="total"><span>Total</span><b>{inr(total)}</b></div></div></div></>}

{tab==='new'&&<><div className="scroll-hint noprint">↔ Swipe horizontally to view full table</div><div className="sheet" style={{marginTop:4}}><div className="hd">{shop.logo&&<img src={shop.logo} alt=""/>}<div><h4>{shop.name}</h4><div>{shop.addr}</div><div>{shop.phone}</div></div></div><h3 style={{margin:'10px 0 26px'}}>Jewellery Valuation Report</h3>
<div className="m" style={{marginBottom:16}}><span><b>Date of Valuation:</b> {r.date.split('-').reverse().join('-')}<br/><b>Name of the owner(s) of the Jewellery:</b> {r.owner}</span><span style={{textAlign:'right'}}><b>Name of the Valuer:</b> {r.valuer},<br/>{(()=>{const i=r.place.indexOf(',');if(i<0)return r.place;const p1=r.place.slice(0,i);const rest=r.place.slice(i+1).trim();return <>{p1},<br/>{rest}</>;})()}<br/><b>Certificate No:</b> {r.cert}</span></div>
<div className="tbl-wrap"><table><thead><tr>{[
  'S.No',
  'Description of each item of jewellery 22k Gold, Silver & Misalliances items',
  'Quantity',
  'Total gross weight of each items of jewellery grams',
  'Weight or each precious or semi precious stone in carats',
  'Net weight of precious metal such as gold, silver,platinum etc, in item of jerwellerygrms.',
  'Purity of metals',
  'Weight of pure metal in grams',
  'Rate of metals',
  'Total value of the jewellery (the valuer should discuss the special features if any of the jewellery, such as its antique value aesthetic value etc.)'
].map(h=><th key={h} style={{fontSize:9.5,lineHeight:1.25,verticalAlign:'top',padding:'4px 3px'}}>{h}</th>)}</tr></thead><tbody>
{rows.filter(({i})=>i.name||i.gross||i.fixed).map(({i,c},n)=><tr key={i.id}><td>{n+1}</td><td>{i.name}{i.metal!=='Other'&&` (${i.metal})`}</td><td>{i.qty}</td><td className="r">{i.gross?num(i.gross).toFixed(3):'--'}</td><td className="r">{i.stone||'Nil'}</td><td className="r">{i.gross?c.net.toFixed(3):'--'}</td><td className="r">{i.purity?i.purity+'%':'--'}</td><td className="r">{i.gross?c.pure.toFixed(3):'--'}</td><td className="r">{c.rate?c.rate.toLocaleString('en-IN'):'--'}</td><td className="r">{c.value.toLocaleString('en-IN')}</td></tr>)}
<tr><td colSpan="9"><b>Total</b></td><td className="r"><b>{total.toLocaleString('en-IN')}/-</b></td></tr></tbody></table></div>
{shop.note&&<p>{shop.note}</p>}<div className="sg"><span><b>Place:</b> {r.footerPlace||''}<br/><b>Date:</b> {r.date.split('-').reverse().join('-')}</span><span style={{textAlign:'center'}}><b>{r.valuer}</b><br/>{r.valuerTitle||cfg.valuerTitle||'Valuer'}</span></div></div></>}

{tab==='new'&&<div className="bar noprint"><button className="p" onClick={save}>💾 Save</button><button onClick={()=>{if(requireValid())window.print()}}>🖨️ Print / PDF</button><button style={{background:'#25d366',color:'#fff',borderColor:'#25d366'}} onClick={()=>sendCustomerWhatsApp(r)}>📲 WhatsApp Customer</button><button onClick={share}>↗️ Share</button><button className="x" onClick={()=>{setR(fresh());window.scrollTo(0,0)}}>➕ New</button></div>}

{tab==='calc'&&<>
<div className="calc-card noprint">
  <h2>
    <span>💰 Quick Valuation Calculator</span>
    <button className="x" style={{fontSize:12,padding:'4px 10px'}} onClick={resetCalc}>🔄 Reset All</button>
  </h2>

  <p style={{fontSize:13,color:'#666',marginTop:0,marginBottom:12}}>
    Scratchpad / Counter estimate. Rates and purity are entered manually and do not affect formal reports.
  </p>

  <div className="g2" style={{marginBottom:14,background:'#fffdf7',padding:10,borderRadius:8,border:'1px solid #ebd9a2'}}>
    <L t="Gold Rate (₹ per gram)">
      <N value={cGoldRate} placeholder="Enter Gold rate (e.g. 7250)" onChange={e=>setCGoldRate(e.target.value)}/>
    </L>
    <L t="Silver Rate (₹ per gram)">
      <N value={cSilverRate} placeholder="Enter Silver rate (e.g. 96)" onChange={e=>setCSilverRate(e.target.value)}/>
    </L>
  </div>

  {cCalcRows.map((it, idx) => (
    <div className="calc-item" key={it.id}>
      <div className="calc-item-head">
        <b>Item #{idx + 1} {it.name ? `— ${it.name}` : ''}</b>
        {cCalcRows.length > 1 && (
          <button className="x danger" style={{padding:'2px 8px',fontSize:12,minHeight:26}} onClick={()=>removeCItem(it.id)}>✕ Remove</button>
        )}
      </div>

      <div className="g2">
        <L t="Metal">
          <select value={it.metal} onChange={e=>updateCItem(it.id, 'metal', e.target.value)}>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
          </select>
        </L>
        <L t="Item Name (Optional)">
          <input value={it.name} placeholder={`e.g. ${it.metal} Chain / Ring / Coins`} onChange={e=>updateCItem(it.id, 'name', e.target.value)}/>
        </L>
      </div>

      <div className="g2">
        <L t="Gross Wt (g)">
          <N value={it.gross} placeholder="0.000" onChange={e=>updateCItem(it.id, 'gross', e.target.value)}/>
        </L>
        <L t="Stone Wt (g)">
          <N value={it.stone} placeholder="0.000" onChange={e=>updateCItem(it.id, 'stone', e.target.value)}/>
        </L>
      </div>

      <div className="g2">
        <L t="Purity (%)">
          <N value={it.purity} placeholder={it.metal==='Gold'?'91.6':'92.5'} onChange={e=>updateCItem(it.id, 'purity', e.target.value)}/>
        </L>
        <L t={`Rate (₹/g) [Default: ₹${it.metal==='Gold'?(cGoldRate||0):(cSilverRate||0)}]`}>
          <N value={it.rate} placeholder={`₹${it.metal==='Gold'?(cGoldRate||0):(cSilverRate||0)}`} onChange={e=>updateCItem(it.id, 'rate', e.target.value)}/>
        </L>
      </div>

      <div className="purity-pills">
        {it.metal==='Gold' ? (
          <>
            <button className={it.purity==='91.6'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '91.6')}>91.6% (22k)</button>
            <button className={it.purity==='75'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '75')}>75% (18k)</button>
            <button className={it.purity==='99.9'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '99.9')}>99.9% (24k)</button>
            <button className={it.purity==='83.3'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '83.3')}>83.3% (20k)</button>
          </>
        ) : (
          <>
            <button className={it.purity==='92.5'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '92.5')}>92.5% (Sterling)</button>
            <button className={it.purity==='70'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '70')}>70%</button>
            <button className={it.purity==='50'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '50')}>50%</button>
            <button className={it.purity==='40'?'on':''} onClick={()=>updateCItem(it.id, 'purity', '40')}>40%</button>
          </>
        )}
      </div>

      <div className="calc-item-val">
        <span>Net: <b>{it.net.toFixed(3)}g</b> | Fine: <b>{it.fine.toFixed(3)}g</b></span>
        <span>Item Value: <b>₹{it.val.toLocaleString('en-IN')}/-</b></span>
      </div>
    </div>
  ))}

  <div style={{display:'flex',gap:8,marginBottom:12}}>
    <button className="calc-add-btn" onClick={()=>addCItem('Gold')}>➕ Add Gold Item</button>
    <button className="calc-add-btn" onClick={()=>addCItem('Silver')}>➕ Add Silver Item</button>
  </div>

  <div className="calc-summary">
    <h3>📋 Instant Valuation Summary ({cCalcRows.filter(x=>x.gross||x.val).length || 1} Item{cCalcRows.length>1?'s':''})</h3>
    <div className="calc-row">
      <span>Total Gross Weight</span>
      <strong>{cTotalGross.toFixed(3)} g</strong>
    </div>
    {cTotalStone > 0 && (
      <div className="calc-row">
        <span>Total Stone Weight</span>
        <strong>{cTotalStone.toFixed(3)} g</strong>
      </div>
    )}
    <div className="calc-row">
      <span>Total Net Weight</span>
      <strong>{cTotalNet.toFixed(3)} g</strong>
    </div>
    <div className="calc-row">
      <span>Total Fine / Pure Metal</span>
      <strong>{cTotalFine.toFixed(3)} g</strong>
    </div>
    <div className="calc-row highlight">
      <span>Estimated Total Value</span>
      <strong>₹ {cTotalVal.toLocaleString('en-IN')}/-</strong>
    </div>
  </div>

  <div className="calc-actions">
    <button className="p" onClick={shareCalc}>↗️ Share via WhatsApp</button>
    <button onClick={()=>{if(validCalc())window.print()}}>🖨️ Print / PDF Slip</button>
    <button className="x" onClick={resetCalc}>🔄 Reset</button>
  </div>
</div>

<div className="calc-slip">
  <div style={{textAlign:'center',marginBottom:16,borderBottom:'2px solid #222',paddingBottom:10}}>
    <h2 style={{margin:'0 0 4px',fontSize:20,fontFamily:'Georgia,serif'}}>{shop.name||'Sri Vijaya Laxmi Jewellery Works'}</h2>
    {shop.addr&&<p style={{margin:'2px 0',fontSize:12.5,color:'#333'}}>{shop.addr}</p>}
    {shop.phone&&<p style={{margin:'2px 0',fontSize:12.5,color:'#333'}}>Phone: {shop.phone}</p>}
    <h3 style={{margin:'8px 0 3px',fontSize:16,letterSpacing:2,textTransform:'uppercase',fontWeight:700}}>ESTIMATION</h3>
    <small style={{fontSize:12,color:'#444'}}>Date: {today().split('-').reverse().join('-')}</small>
  </div>
  <table>
    <thead>
      <tr>
        <th className="c" style={{width:'4%'}}>#</th>
        <th style={{width:'17%'}}>Item</th>
        <th className="c" style={{width:'8%'}}>Metal</th>
        <th className="r" style={{width:'9%'}}>Gross (g)</th>
        <th className="r" style={{width:'9%'}}>Stone (g)</th>
        <th className="r" style={{width:'9%'}}>Net (g)</th>
        <th className="c" style={{width:'8%'}}>Purity</th>
        <th className="r" style={{width:'9%'}}>Fine (g)</th>
        <th className="r" style={{width:'12%'}}>Rate (₹/g)</th>
        <th className="r" style={{width:'15%'}}>Value (₹)</th>
      </tr>
    </thead>
    <tbody>
      {cCalcRows.map((x,idx)=>(
        <tr key={x.id}>
          <td className="c">{idx+1}</td>
          <td><b>{x.name||(x.metal+' Ornament')}</b></td>
          <td className="c">{x.metal}</td>
          <td className="r">{x.gross?x.gross.toFixed(3):'0.000'}</td>
          <td className="r">{x.stone?x.stone.toFixed(3):'Nil'}</td>
          <td className="r">{x.net?x.net.toFixed(3):'0.000'}</td>
          <td className="c">{x.purity?x.purity+'%':'-'}</td>
          <td className="r">{x.fine?x.fine.toFixed(3):'0.000'}</td>
          <td className="r">{x.activeRate?x.activeRate.toLocaleString('en-IN'):'-'}</td>
          <td className="r"><b>{x.val?x.val.toLocaleString('en-IN'):'0'}</b></td>
        </tr>
      ))}
      <tr style={{fontWeight:'bold',background:'#f8f4ec'}}>
        <td colSpan="3" className="c">Total</td>
        <td className="r">{cTotalGross.toFixed(3)}</td>
        <td className="r">{cTotalStone?cTotalStone.toFixed(3):'Nil'}</td>
        <td className="r">{cTotalNet.toFixed(3)}</td>
        <td className="c">-</td>
        <td className="r">{cTotalFine.toFixed(3)}</td>
        <td className="r">-</td>
        <td className="r">₹ {cTotalVal.toLocaleString('en-IN')}/-</td>
      </tr>
    </tbody>
  </table>
  <div style={{marginTop:28,fontSize:12,color:'#444',fontStyle:'italic'}}>
    * Counter estimation slip for reference only.
  </div>
</div>
</>}

{tab==='saved'&&<div className="noprint">
<div className="analytics-card">
  <div className="analytics-head">
    <h3>📈 Valuation Analytics</h3>
    <div className="analytics-pills">
      <button className={period==='all'?'on':''} onClick={()=>setPeriod('all')}>All Time</button>
      <button className={period==='month'?'on':''} onClick={()=>setPeriod('month')}>This Month</button>
      <button className={period==='today'?'on':''} onClick={()=>setPeriod('today')}>Today</button>
    </div>
  </div>
  <div className="analytics-grid">
    <div className="stat-box">
      <div className="lbl">Total Evaluated</div>
      <div className="val">₹ {stats.val.toLocaleString('en-IN')}</div>
    </div>
    <div className="stat-box">
      <div className="lbl">Certificates</div>
      <div className="val">{stats.count}</div>
    </div>
    <div className="stat-box">
      <div className="lbl">Gold Evaluated</div>
      <div className="val">{stats.gold.toFixed(3)} g</div>
    </div>
    <div className="stat-box">
      <div className="lbl">Silver Evaluated</div>
      <div className="val">{stats.silver.toFixed(3)} g</div>
    </div>
  </div>
</div>

<div className="card">
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
    <h2 style={{margin:0}}>Saved reports ({shown.length})</h2>
    <button className="p" style={{fontSize:12,padding:'6px 12px'}} onClick={exportToExcel}>📊 Download Excel</button>
  </div>
  <input placeholder="Search owner, phone, certificate or date" value={q} onChange={e=>setQ(e.target.value)}/>
  {shown.length?shown.map(x=><div className="li" key={x.id}><div><b>{x.owner||'(no owner)'}</b><small>{x.date} · {x.cert||'No cert'} · {inr(x.total)}{x.phone?` · 📞 ${x.phone}`:''}</small></div>
  <div className="li-actions">
    <button onClick={()=>{setR(x);setTab('new')}}>Open</button>
    <button className="x" style={{background:'#25d366',color:'#fff',borderColor:'#25d366'}} onClick={()=>sendCustomerWhatsApp(x)}>📲 WhatsApp</button>
    <button className="x" onClick={()=>{setR({...x,id:uid(),date:today(),version:0});setTab('new')}}>Copy</button>
    <button className="x danger" onClick={async()=>{if(confirm('Delete this report?')){const result=await deleteCloudReport(x.id,x.version);if(result.ok){setList(l=>l.filter(y=>y.id!==x.id));flash('Report deleted')}else flash(result.error||'Could not delete report')}}}>Delete</button>
  </div></div>):<p>No saved reports yet.</p>}
</div>
</div>}

{tab==='set'&&<div className="noprint"><div className="card"><h2>👤 Staff Account & Security</h2><p style={{fontSize:13,color:'#554c47',margin:'0 0 10px'}}>Logged in as <b>{user?.email||'Staff'}</b>. Inactivity auto-lock logs out after 30 minutes of idle time.</p><button className="x danger" onClick={handleSignOut}>🚪 Sign out</button></div>
<div className="card"><h2>🎉 Birthday Greeting</h2><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><div style={{fontWeight:600,fontSize:14}}>Show "Happy Birthday Bava" on login</div><small style={{color:'var(--mut)'}}>Toggle on or off to control the greeting message</small></div><button className={bdayEnabled?'p':'x'} style={{minWidth:95,fontSize:13,padding:'6px 14px'}} onClick={()=>{const next=!bdayEnabled;setBdayEnabled(next);flash(next?'Birthday greeting enabled':'Birthday greeting disabled')}}>{bdayEnabled?'✓ Enabled':'✕ Disabled'}</button></div></div>
<div className="card"><h2>☁️ Secure cloud sync</h2><p style={{fontSize:13,color:'#554c47',margin:'0 0 10px'}}>Reports are loaded from the authenticated cloud account. Conflicts must be refreshed before saving.</p><button onClick={async()=>{const result=await syncAllReports();if(result.ok){setList(result.reports);flash('Cloud sync complete')}else flash(result.error||'Cloud sync failed')}}>🔄 Refresh from cloud</button></div>
<div className="card"><h2>Defaults for new reports</h2><L t="Certificate no."><input value={cfg.cert||''} onChange={e=>{setCfg({...cfg,cert:e.target.value});flash('Settings saved')}}/></L><div className="g2"><L t="Valuer name"><input value={cfg.valuer} onChange={e=>{setCfg({...cfg,valuer:e.target.value});flash('Settings saved')}}/></L><L t="Valuer title (Footer)"><input value={cfg.valuerTitle||'Valuer'} onChange={e=>{setCfg({...cfg,valuerTitle:e.target.value});flash('Settings saved')}}/></L></div><L t="Place"><input value={cfg.place} onChange={e=>{setCfg({...cfg,place:e.target.value});flash('Settings saved')}}/></L></div>
<div className="card"><h2>Shop details (printed on every report)</h2><L t="Shop name"><input value={shop.name} onChange={e=>{setShop({...shop,name:e.target.value});flash('Shop details saved')}}/></L><L t="Address"><input value={shop.addr} onChange={e=>{setShop({...shop,addr:e.target.value});flash('Shop details saved')}}/></L><L t="Phone numbers"><input value={shop.phone} onChange={e=>{setShop({...shop,phone:e.target.value});flash('Shop details saved')}}/></L><L t="Footer note (optional)"><input value={shop.note} onChange={e=>{setShop({...shop,note:e.target.value});flash('Shop details saved')}}/></L>
<L t="Logo"><input type="file" accept="image/*" onChange={e=>e.target.files[0]&&logo(e.target.files[0])}/></L>{shop.logo&&<p><img src={shop.logo} alt="" style={{maxHeight:60}}/> <button className="x" onClick={()=>{setShop({...shop,logo:''});flash('Logo removed')}}>Remove logo</button></p>}</div>
<div className="card"><h2>Item presets (one tap adds the row)</h2>{presets.map((p,k)=><div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}} key={k}><input value={p.name} onChange={e=>{setPresets(presets.map((y,j)=>j===k?{...y,name:e.target.value}:y));flash('Preset updated')}}/><select value={p.metal} onChange={e=>{setPresets(presets.map((y,j)=>j===k?{...y,metal:e.target.value}:y));flash('Preset updated')}}><option>Silver</option><option>Gold</option><option>Other</option></select><button className="x" onClick={()=>{setPresets(presets.filter((_,j)=>j!==k));flash('Preset removed')}}>X</button></div>)}
<button onClick={()=>{setPresets([...presets,{name:'',metal:'Silver',purity:''}]);flash('Preset added')}}>Add preset</button></div>
<div className="card"><h2>Backup</h2><div className="g2"><button onClick={exp}>Download backup</button><label style={{margin:0}}><input type="file" accept=".json" onChange={e=>e.target.files[0]&&imp(e.target.files[0])}/></label></div><p style={{color:'#6b625d',fontSize:13}}>Data is stored on this device only. Download a backup now and then.</p></div></div>}
{msg&&<div className="noprint" style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'#231c19',color:'#fff',padding:'8px 16px',borderRadius:20}}>{msg}</div>}
</div>}
