/* Single BEC playback channel: same-origin MP3 first, then device TTS. */
(function (browser) {
 "use strict";
 const cleanText=value=>String(value??"").replace(/º([CFcf])/g,"°$1").normalize("NFKC").replace(/[‘’]/g,"'").replace(/\s+/g," ").trim();
 const keyFor=text=>cleanText(text).toLowerCase();
 const silentMessage="没能播出声音。请调高媒体音量，检查蓝牙耳机，然后用 Safari 再点一次喇叭。";

 function createPlayer(onFailure=()=>{}){
  let player=null,utterance=null,serial=0,watchdog=null;
  // A failed clip stays on native fallback briefly so a second tap invokes TTS directly.
  const unavailableUntil=new Map();
  const synth=()=>browser.speechSynthesis;
  const clearWatchdog=()=>{if(watchdog!==null){browser.clearTimeout(watchdog);watchdog=null}};
  const later=(fn,ms)=>{clearWatchdog();watchdog=browser.setTimeout(fn,ms)};
  const clearMedia=()=>{
   if(!player)return;
   player.onplaying=player.onended=player.onerror=null;
   try{player.pause()}catch(_){}
  };
  const stopNative=()=>{
   if(utterance){utterance.onstart=utterance.onend=utterance.onerror=null;utterance=null}
   try{const tts=synth();if(tts?.speaking||tts?.pending)tts.cancel()}catch(_){}
  };
  const tip=token=>{if(token!==serial)return;clearWatchdog();onFailure(silentMessage)};
  function clipFor(key){
   const sources=browser.BEC_AUDIO_MANIFEST;
   const clips=sources?.clips||sources;
   const row=clips&&Object.prototype.hasOwnProperty.call(clips,key)?clips[key]:null;
   const offline=browser.BEC_OFFLINE_AUDIO;
   const raw=offline&&Object.prototype.hasOwnProperty.call(offline,key)?offline[key]:null;
   const relative=(typeof row==="string"?row:row?.src) || (typeof raw==="string"?"data:audio/mpeg;base64,"+raw:null);
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
  function nativeSpeech(text,rate,token){
   if(token!==serial)return;
   const tts=synth(),Utterance=browser.SpeechSynthesisUtterance;
   if(!tts||!Utterance){tip(token);return}
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
    u.onstart=()=>{if(utterance===u){started=true;clearWatchdog()}};
    u.onend=()=>{if(utterance===u){utterance=null;clearWatchdog();if(!started)tip(token)}};
    u.onerror=()=>{if(utterance===u){utterance=null;tip(token)}};
    later(()=>{
     if(token!==serial||utterance!==u||started)return;
     stopNative();tip(token);
    },3200);
    if(tts.paused)tts.resume();
    tts.speak(u);
   }catch(_){stopNative();tip(token)}
  }
  function speak(value,slow=false,speed=0.82){
   const text=cleanText(value);
   if(!text)return;
   const token=++serial,rate=slow?0.65:Math.min(1.5,Math.max(0.5,Number(speed)||0.82));
   clearWatchdog();clearMedia();stopNative();
   const key=keyFor(text), src=clipFor(key);
   if(!src||(unavailableUntil.get(key)||0)>Date.now()||!browser.Audio){nativeSpeech(text,rate,token);return}
   let resolved=false;
   const fallback=()=>{
    if(token!==serial||resolved)return;
    resolved=true;clearWatchdog();clearMedia();
    unavailableUntil.set(key,Date.now()+60000);
    nativeSpeech(text,rate,token);
   };
   const started=()=>{if(token!==serial||resolved)return;clearWatchdog()};
   try{
    if(!player){player=new browser.Audio();player.preload="none"}
    player.onplaying=started;
    player.onerror=fallback;
    player.onended=()=>{if(token===serial){resolved=true;clearWatchdog()}};
    if(player.src!==src)player.src=src;
    try{player.currentTime=0}catch(_){}
    player.playbackRate=rate;
    // Keep play() on the original click stack for iPhone Safari.
    later(fallback,4500);
    const pending=player.play();
    if(pending&&typeof pending.then==="function")pending.then(started,fallback);
   }catch(_){fallback()}
  }
  function stop(){serial++;clearWatchdog();clearMedia();stopNative()}
  try{synth()?.getVoices?.()}catch(_){} // Warm the OS voice catalog without speaking.
  return {speak,stop};
 }
 browser.createBecAudioPlayer=createPlayer;
})(window);
