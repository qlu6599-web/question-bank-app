/* One playback channel: validated bundled MP3, then served MP3, then device speech. */
(function (browser) {
 "use strict";
 const cleanText=value=>String(value??"").replace(/º([CFcf])/g,"°$1").normalize("NFKC").replace(/[‘’]/g,"'").replace(/\s+/g," ").trim();
 const keyFor=text=>cleanText(text).toLowerCase();
 const silentMessage="没能播出声音。请调高媒体音量，检查蓝牙耳机，然后用 Safari 再点一次喇叭。";

 function createPlayer(onFailure=()=>{}){
  let player=null,ownedMedia=null,utterance=null,serial=0,watchdog=null;
  // Cooldown attaches only to the failed source, never the whole word.
  const unavailableUntil=new Map();
  const synth=()=>browser.speechSynthesis;
  const clearWatchdog=()=>{if(watchdog!==null){browser.clearTimeout(watchdog);watchdog=null}};
  const later=(fn,ms)=>{clearWatchdog();watchdog=browser.setTimeout(fn,ms)};
  const clearMedia=()=>{
   if(!player)return;
   player.onplaying=player.ontimeupdate=player.onended=player.onerror=null;
   try{player.pause()}catch(_){}
  };
  const stopNative=()=>{
   if(utterance){utterance.onstart=utterance.onend=utterance.onerror=null;utterance=null}
   try{const tts=synth();if(tts?.speaking||tts?.pending)tts.cancel()}catch(_){}
  };
  const tip=(token,report)=>{if(token!==serial)return;clearWatchdog();report("failed");onFailure(silentMessage)};
  function validClip(relative){
   if(typeof relative!=="string")return null;
   if(relative.startsWith("data:")){
    const prefix="data:audio/mpeg;base64,";
    const payload=relative.slice(prefix.length);
    return relative.startsWith(prefix)&&payload.length>=8&&payload.length<=4e6&&payload.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(payload)?relative:null;
   }
   try{
    const base=new URL("./",browser.location.href), path=new URL(relative,base);
    return path.origin===base.origin&&path.pathname.startsWith(base.pathname+"audio/")&&/\.mp3$/i.test(path.pathname)?path.href:null;
   }catch(_){return null}
  }
  function clipsFor(key){
   const manifest=browser.BEC_AUDIO_MANIFEST;
   const clips=manifest?.clips||manifest;
   const row=clips&&Object.prototype.hasOwnProperty.call(clips,key)?clips[key]:null;
   const offline=browser.BEC_OFFLINE_AUDIO;
   const raw=offline&&Object.prototype.hasOwnProperty.call(offline,key)?offline[key]:null;
   const bundled=validClip(typeof raw==="string"?"data:audio/mpeg;base64,"+raw:null);
   const served=validClip(typeof row==="string"?row:row?.src);
   const out=[];
   // A bundled clip starts on the trusted tap without a network request.
   if(bundled)out.push({slot:"bundle",src:bundled});
   if(served&&served!==bundled)out.push({slot:"manifest",src:served});
   return out;
  }
  function getSources(value){return clipsFor(keyFor(value)).map(clip=>clip.src)}
  function nativeSpeech(text,rate,token,report){
   if(token!==serial)return;
   const tts=synth(),Utterance=browser.SpeechSynthesisUtterance;
   if(!tts||!Utterance){tip(token,report);return}
   try{
    const u=new Utterance(text), voices=tts.getVoices?.()||[];
    const english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v?.lang||""));
    const voice=english.find(v=>v.localService&&/^en[-_]gb$/i.test(v.lang))||
      english.find(v=>v.localService)||english.find(v=>/^en[-_]gb$/i.test(v.lang))||english[0];
    u.lang=voice?.lang||"en-GB";
    if(voice)u.voice=voice;
    u.rate=rate;
    utterance=u; // Retain the utterance until terminal callbacks.
    let started=false;
    u.onstart=()=>{if(utterance===u){started=true;clearWatchdog();report("playing",{source:"device"})}};
    u.onend=()=>{if(utterance===u){utterance=null;clearWatchdog();if(started)report("ended",{source:"device"});else tip(token,report)}};
    u.onerror=()=>{if(utterance===u){utterance=null;tip(token,report)}};
    later(()=>{
     if(token!==serial||utterance!==u||started)return;
     stopNative();tip(token,report);
    },3200);
    report("loading",{source:"device"});
    if(tts.paused)tts.resume();
    tts.speak(u);
   }catch(_){stopNative();tip(token,report)}
  }
  function speak(value,slow=false,speed=0.82,options={}){
   const text=cleanText(value);
   if(!text)return;
   const token=++serial,rate=slow?0.65:Math.min(1.5,Math.max(0.5,Number(speed)||0.82));
   const report=(status,detail={})=>{if(token===serial){try{options?.onStatus?.(status,detail)}catch(_){}}};
   clearWatchdog();clearMedia();stopNative();
   const key=keyFor(text), supplied=options?.media;
   const callerMedia=typeof supplied?.play==="function"&&typeof supplied?.pause==="function"?supplied:null;
   const clips=callerMedia||browser.Audio?clipsFor(key):[];
   function tryClip(index){
    if(token!==serial)return;
    let clip, cooldown;
    while(index<clips.length){
     clip=clips[index++];
     cooldown=clip.slot+"|"+key;
     if((unavailableUntil.get(cooldown)||0)<=Date.now())break;
     clip=null;
    }
    if(!clip){nativeSpeech(text,rate,token,report);return}
    const {slot,src}=clip;
    let resolved=false, verified=false, media=null;
    const active=()=>token===serial&&!resolved&&media===player;
    function verifyProgress(){
     if(!active()||verified||media.seeking||(media.currentSrc&&media.currentSrc!==src)||!(Number(media.currentTime)>.02))return;
     verified=true;clearWatchdog();report("playing",{source:slot});
    }
    function fallback(error){
     if(token!==serial||resolved)return;
     resolved=true;clearWatchdog();clearMedia();
     // A playback policy rejection does not prove the bytes are broken.
     if(error?.name!=="NotAllowedError")unavailableUntil.set(cooldown,Date.now()+60000);
     report("retry",{source:slot});
     tryClip(index);
    }
    try{
     if(callerMedia)player=callerMedia;
     else{
      if(!ownedMedia){ownedMedia=new browser.Audio();ownedMedia.preload="none"}
      player=ownedMedia;
     }
     media=player;
     // Set/reset the source before installing handlers so previous callbacks do not count.
     const sameSource=media.src===src;
     if(!sameSource)media.src=src;
     else try{media.currentTime=0}catch(_){}
     media.playbackRate=rate;
     media.onplaying=verifyProgress;
     media.ontimeupdate=verifyProgress;
     media.onerror=()=>{if(active()&&(!media.currentSrc||media.currentSrc===src))fallback(media.error)};
     media.onended=()=>{
      if(!active()||(media.currentSrc&&media.currentSrc!==src))return;
      verifyProgress();
      if(!verified){fallback();return}
      resolved=true;clearWatchdog();report("ended",{source:slot});
     };
     report("loading",{source:slot});
     // .play() happens on the original click; its promise only acknowledges acceptance.
     later(()=>{verifyProgress();if(!verified)fallback()},4500);
     const pending=media.play();
     if(pending&&typeof pending.then==="function")pending.then(verifyProgress,fallback);
    }catch(error){fallback(error)}
   }
   tryClip(0);
  }
  function stop(){serial++;clearWatchdog();clearMedia();stopNative()}
  try{synth()?.getVoices?.()}catch(_){} // Warm the OS voice catalog without speaking.
  return {speak,stop,getSources};
 }
 browser.createBecAudioPlayer=createPlayer;
})(window);
