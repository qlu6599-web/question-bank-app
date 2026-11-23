const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const code=fs.readFileSync(require("node:path").join(__dirname,"../audio-player.js"),"utf8");

function fixture(manifest,withNative=true){
 const media=[],calls=[],notices=[],timers=new Map();let serial=0;
 const browser={
  BEC_AUDIO_MANIFEST:manifest,location:{href:"https://example.test/question-bank-app/bec/?from=home"},
  setTimeout(fn,ms){timers.set(++serial,{fn,ms});return serial},clearTimeout(id){timers.delete(id)},
  Audio:class{constructor(){media.push(this)}pause(){}play(){calls.push({type:"mp3",src:this.src,rate:this.playbackRate});return Promise.resolve()}}
 };
 if(withNative){
  browser.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
  browser.speechSynthesis={getVoices:()=>[{lang:"en-US",localService:true},{lang:"en-GB",localService:true}],speak(u){calls.push({type:"native",text:u.text,rate:u.rate});u.onstart();u.onend()}};
 }
 vm.runInNewContext(code,{window:browser,URL,Date});
 const player=browser.createBecAudioPlayer(s=>notices.push(s));
 return {player,browser,media,calls,notices,timers};
}

(async()=>{
 const f=fixture({clips:{"company":"./audio/company.mp3","what's new?":{src:"audio/sentence.mp3"},"bad":"https://elsewhere.test/sample.mp3"}});
 f.player.speak("  COMPANY\u00a0 ");
 assert.deepEqual(f.calls,[{type:"mp3",src:"https://example.test/question-bank-app/bec/audio/company.mp3",rate:0.82}],"MP3 must start synchronously");
 await Promise.resolve();
 assert.equal(f.timers.size,0,"MP3 start clears the watchdog");
 f.player.speak("What’s   new?",true);
 assert.equal(f.media.length,1,"reuse audio element");
 assert.deepEqual(f.calls.at(-1),{type:"mp3",src:"https://example.test/question-bank-app/bec/audio/sentence.mp3",rate:0.65});
 f.player.speak("bad");
 assert.deepEqual(f.calls.at(-1),{type:"native",text:"bad",rate:0.82},"external clips cannot load");
 f.player.speak("unmapped");
 assert.deepEqual(f.calls.at(-1),{type:"native",text:"unmapped",rate:0.82});

 const packed=fixture({"sample":"data:audio/mpeg;base64,SUQzBAAA","unsupported":"data:text/html;base64,PGgxPg==","broken":"data:audio/mpeg;base64,SGVs bG8="});
 packed.player.speak("sample");
 assert.deepEqual(packed.calls.at(-1),{type:"mp3",src:"data:audio/mpeg;base64,SUQzBAAA",rate:0.82});
 packed.player.speak("unsupported");
 assert.deepEqual(packed.calls.at(-1),{type:"native",text:"unsupported",rate:0.82});
 packed.player.speak("broken");
 assert.deepEqual(packed.calls.at(-1),{type:"native",text:"broken",rate:0.82});

 const bad=fixture({s:"./audio/nonexistent.mp3"});
 bad.browser.Audio.prototype.play=function(){return Promise.reject(new Error("load failed"))};
 bad.player.speak("S");
 await Promise.resolve();
 assert.deepEqual(bad.calls.at(-1),{type:"native",text:"S",rate:0.82});
 bad.player.speak("s");
 assert.deepEqual(bad.calls.at(-1),{type:"native",text:"s",rate:0.82},"retry triggers native synchronously");

 const slow=fixture({x:"./audio/slow.mp3"});
 slow.browser.Audio.prototype.play=function(){return new Promise(()=>{})};
 slow.player.speak("x");
 assert.deepEqual([...slow.timers.values()].map(t=>t.ms),[4500]);
 [...slow.timers.values()][0].fn();
 assert.deepEqual(slow.calls.at(-1),{type:"native",text:"x",rate:0.82});

 const none=fixture({},false);
 none.player.speak("nothing");
 assert.match(none.notices.at(-1),/Safari/);
 const silent=fixture({});
 silent.browser.speechSynthesis.speak=()=>{}; // WebKit no-start/no-error path.
 silent.player.speak("nothing");
 assert.deepEqual([...silent.timers.values()].map(t=>t.ms),[3200]);
 [...silent.timers.values()][0].fn();
 assert.match(silent.notices.at(-1),/媒体音量/);
 console.log("PASS direct same-origin MP3, reuse, slow mode, URL constraint, rejected/silent file fallback, unmapped native request, and silent-native notice.");
})().catch(error=>{console.error(error);process.exitCode=1});
