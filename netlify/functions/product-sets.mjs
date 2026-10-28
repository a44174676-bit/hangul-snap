const JAMO=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ'];
export default async function handler(request){
 if(request.method!=='GET')return new Response(JSON.stringify({error:'method-not-allowed'}),{status:405});
 const {searchParams}=new URL(request.url);const setId=searchParams.get('setId')||'basic14';
 if(setId!=='basic14')return Response.json({error:'unknown-set'}, {status:404,headers:{'cache-control':'no-store'}});
 return Response.json({setId,jamoList:JAMO,uiLangDefault:'vi',contentVersion:'1.1.1',usageGuide:{ko:'한글 모양 어포를 학습판 위 TOP 방향으로 놓아주세요.',vi:'Hãy đặt các miếng chữ trên mặt phẳng với TOP hướng lên.'}},{headers:{'cache-control':'public,max-age=3600'}});
}
