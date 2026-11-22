export async function request(url:string,signal?:AbortSignal):Promise<any>{
 const controller=new AbortController();
 const abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Source timeout','TimeoutError')),16000);
 try{
  let response:Response|undefined;
  for(let attempt=0;attempt<2;attempt++){
   if(controller.signal.aborted)throw controller.signal.reason;
   try{response=await fetch(url,{signal:controller.signal,credentials:'omit'});if(attempt===0&&response.status>=500){await response.body?.cancel();continue;}break;}catch(error){if(controller.signal.aborted||attempt===1)throw error;}
  }
  if(!response)throw new Error('Источник не ответил. Попробуй позже.');
  if(!response.ok){
   if(response.status===429)throw new Error('Каталог временно ограничил запросы. Подожди немного и повтори поиск.');
   if(response.status===401||response.status===403)throw new Error('Этот запрос недоступен без доступа к источнику. Выбери другой каталог.');
   throw new Error(`Источник недоступен (${response.status})`);
  }
  return await response.json();
 }catch(error){
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  if(controller.signal.aborted)throw new Error('Каталог отвечает слишком долго. Попробуй ещё раз.');
  throw error;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
