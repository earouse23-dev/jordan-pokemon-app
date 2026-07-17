import { fetchTcgdexSet } from '../lib/providers/tcgdex.js';

const LANGUAGES=new Set(['en','fr','es','de','it','pt','ja','zh-tw','id','th']);

function send(response,status,body,headers={}) {
  for(const [key,value] of Object.entries(headers))response.setHeader(key,value);
  return response.status(status).json(body);
}

export default async function handler(request,response) {
  if(request.method!=='GET'){
    response.setHeader('Allow','GET');
    return send(response,405,{error:'Method not allowed'});
  }
  const setId=String(request.query.setId||'').trim();
  const language=String(request.query.language||'en').toLowerCase();
  if(!/^[A-Za-z0-9.-]{1,40}$/.test(setId)||!LANGUAGES.has(language))return send(response,400,{error:'Provide a valid set ID and supported language.'});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8_000);
  try{
    const set=await fetchTcgdexSet(setId,language,controller.signal);
    if(!set)return send(response,404,{error:'Set not found.',provider:'tcgdex'});
    return send(response,200,{set,provider:'tcgdex',retrievedAt:new Date().toISOString()},{'Cache-Control':'s-maxage=86400, stale-while-revalidate=604800','CDN-Cache-Control':'max-age=86400'});
  }catch(error){
    console.error('[api/set] provider request failed',{name:error?.name||'Error'});
    return send(response,502,{error:'The set catalog is temporarily unavailable.',provider:'tcgdex'});
  }finally{clearTimeout(timeout);}
}
