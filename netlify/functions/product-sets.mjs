import {PRODUCT_SET} from '../../site/js/jamo-data.js';

export default async function handler(request){
 if(request.method!=='GET')return new Response(JSON.stringify({error:'method-not-allowed'}),{status:405});
 const {searchParams}=new URL(request.url);const setId=searchParams.get('setId')||PRODUCT_SET.setId;
 if(setId!==PRODUCT_SET.setId)return Response.json({error:'unknown-set'}, {status:404,headers:{'cache-control':'no-store'}});
 return Response.json(PRODUCT_SET,{headers:{'cache-control':'public,max-age=3600'}});
}
