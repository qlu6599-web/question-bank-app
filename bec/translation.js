(function (global) {
 "use strict";
 const translations = {"en-zh":"英文 → 中文","zh-en":"中文 → 英文"};
 const list = values => [...new Set((Array.isArray(values) ? values : [values]).filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim()))];
 const han=/[\u3400-\u9fff]/u, placeholder=/释义待补|中文待补|待人工|暂无释义|未提供释义|待补充/;
 function normalize(value,language) {
  const s=String(value??"").normalize("NFKC").trim().toLowerCase().replace(/[‘’]/g,"'");
  if (language==="zh") return s.replace(/[\s\p{P}]+/gu,"");
  return s.replace(/\bi'm\b/g,"i am")
   .replace(/\b(he|she|it|that|what|there)'s\b/g,"$1 is")
   .replace(/\b(you|we|they)'re\b/g,"$1 are")
   .replace(/\b(is|are|do|does|did|was|were|has|have|had)n't\b/g,"$1 not")
   .replace(/["“”.,!?;:。！？；：，]+/g," ").replace(/\s+/g," ").trim();
 }
 function check(input,card) {
  if (!String(input??"").trim()) return "empty";
  const key=normalize(input,card.target);
  if (key&&card.answers.some(answer=>normalize(answer,card.target)===key)) return "match";
  return card.target==="zh"||card.flexible?"review":"retry";
 }
 function zhMeanings(raw) {
  const text=String(raw??"").replace(/\\n/g,"；").replace(/\s+/g," ").trim();
  if (!han.test(text)||placeholder.test(text)) return [];
  const simplified=text.replace(/^\s*(?:(?:n|v|vt|vi|adj|adv|prep|pron|abbr)\.?[\s./&]+)+/i,"");
  const chunks=simplified.split(/[；;。]/u).map(x=>x.trim()).filter(x=>han.test(x));
  // Common dictionary separators offer usable alternatives for exact recognition.
  const equivalents=chunks.flatMap(c=>c.split(/[、，,／]/u)).map(x=>x.trim()).filter(x=>han.test(x));
  return list([simplified,...chunks,...equivalents]);
 }
 function makeWords(entries,direction,{meaning=w=>w.zh,aliases=()=>[],examplesFor=()=>[]}={}) {
  const zh=direction==="en-zh";
  return (entries||[]).flatMap(entry=>{
   if (!entry?.w||entry.needs_review) return [];
   const chinese=zhMeanings(meaning(entry));
   if (!chinese.length) return [];
   const en=list([entry.w,...(aliases(entry)||[])]), english=entry.w;
   const example=(examplesFor(entry)||[]).find(x=>
    typeof x?.en==="string"&&typeof x?.zh==="string"&&/[.!?]["']?$/.test(x.en.trim())&&han.test(x.zh));
   return [{entry,english,term:entry.w,target:zh?"zh":"en",prompt:zh?english:chinese[0],
    answers:zh?chinese:en,example,why:"按这张词卡的意思来练。同一个意思也可能有其他正确说法。"}];
  });
 }
 function makeSentences(entries,direction) {
  const zh=direction==="en-zh";
  return (entries||[]).flatMap(row=>{
   const en=list(row.en), cn=list(row.zh);
   return en.length&&cn.length?[{prompt:zh?en[0]:cn[0],english:en[0],target:zh?"zh":"en",
    answers:zh?cn:en,why:row.why,source:row.source}]:[];
  });
 }
 function makeGuide(entries) {
  return (entries||[]).flatMap(row=>makeSentences([row],"zh-en").map(card=>({...card,hint:row.hint,parts:row.parts})));
 }
 function shuffle(values) {
  const out=values.slice();
  for (let i=out.length-1;i>0;i--) {
   const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
 }
 function exampleGuide(card) {
  const e=card.example;
  if (!e) return null;
  const parts=e.en.trim().match(/\S+/g)||[];
  if (parts.length<2||parts.length>16) return null;
  return {term:card.term,english:e.en,prompt:e.zh,target:"en",answers:[e.en],parts,
   hint:"先找出句子在说谁，再找动作。「"+card.term+"」应该放在哪个位置？可以先试着拼词块。",
   why:"这是词库里的参考例句。先读一遍，找出「"+card.term+"」，再试着换一个人、时间或对象。"};
 }
 function mount({root, launchers, data, words, wordAdapters, speak, stop, speakerIcon,
                 masteryButtons, bindMastery, audioSources, toast}) {
  const doc=root.ownerDocument, at=id=>root.querySelector("#"+id);
  const body=at("translationBody"), foot=at("translationFoot"), progress=at("translationProgress"), count=at("translationCount");
  const modeName={word:"词汇双向翻译",sentence:"句子双向翻译",guide:"引导造句"};
  let trigger, mode, direction, cards=[], index=0, session=null, mistakes=[], correct=0;
  const element=(tag,cls,text)=>{
   const e=doc.createElement(tag); if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
  };
  function button(label,cls,action) {
   const b=element("button",cls,label); b.type="button"; b.addEventListener("click",action); return b;
  }
  function heading(label) {
   const h=element("h2","translation-title",label); h.id="translationTitle"; h.tabIndex=-1; return h;
  }
  function text(cls,label){return element("p",cls,label)}
  function close(){if(root.open)root.close()}
  function reset(value,total,label) {
   stop?.(); body.scrollTop=0; body.replaceChildren(); foot.replaceChildren();
   progress.max=Math.max(1,total);progress.value=value; count.textContent=label;
  }
  function focus(el){el?.focus({preventScroll:true})}
  function launch(type,b) {
   if (typeof root.showModal!=="function"){toast("请用新版 Safari 或 Chrome 打开翻译练习");return}
   trigger=b; mode=type; session=null;
   if(type==="guide")start("zh-en");
   else menu();
   root.showModal();doc.documentElement.classList.add("sprint-modal-open"); syncViewport();
   focus(at("translationTitle"));
  }
  function menu() {
   reset(0,1,"翻译");
   const h=heading(modeName[mode]); body.append(h,text("translation-intro","选一个方向，自己输入答案，再看参考说法。"));
   const group=element("div","translation-directions");
   for(const [key,name] of Object.entries(translations)) group.append(button(name,"sprint-action",()=>start(key)));
   body.append(group);focus(h);
  }
  function start(dir,preset) {
   direction=dir; index=0;correct=0;mistakes=[];
   cards=preset||(mode==="word"?makeWords(words(),dir,wordAdapters):mode==="sentence"?
    makeSentences(data.sentences,dir):makeGuide(data.guide));
   render();
  }
  function showSummary() {
   reset(cards.length,cards.length,"完成");
   const h=heading(cards.length?"这一组练完了":"没有可出题的词");
   body.append(h);
   if(cards.length)body.append(text("translation-intro","与参考答案匹配 "+correct+" / "+cards.length+" 题。其他译法可以自己对照，不自动改动掌握状态。"));
   else body.append(text("translation-intro","这个词库暂无带明确释义的词，可以换方向或试试句子翻译。"));
   if(mistakes.length)foot.append(button("重练未匹配的题","sprint-action",()=>start(direction,mistakes.slice())));
   if(!session&&mode!=="guide")foot.append(button("换个翻译方向","sprint-secondary",menu));
   else if(!session)foot.append(button("再练这一组","sprint-action",()=>start(direction)));
   if(session?.restore)foot.append(button("回到词汇翻译","sprint-secondary",session.restore));
   foot.append(button("返回学习","sprint-secondary",close));focus(h);
  }
  function render() {
   if(index>=cards.length){showSummary();return}
   const card=cards[index], guided=!!card.parts?.length;
   reset(index,cards.length,(index+1)+" / "+cards.length);
   const h=heading(modeName[mode]);
   body.append(h,text("sprint-kicker",guided?"看提示 · 拼词块或输入":translations[direction]));
   const prompt=element("div","translation-prompt");
   const shown=text("translation-example",card.prompt);
   if(card.target==="zh")shown.lang="en";
   prompt.append(shown);
   const audioNotice=text("translation-note","");
   audioNotice.id="translationAudioNotice";audioNotice.setAttribute("role","status");
   const output=element("audio","translation-audio");
   output.preload="none";output.setAttribute("playsinline","");output.hidden=true;
   output.setAttribute("aria-label","备用发音播放器");
   function speaker() {
    const b=button(undefined,"sprint-speaker translation-speaker",()=>{
     audioNotice.textContent="";
     output.controls=false; output.hidden=true;
     audioBackup.hidden=!(audioSources?.(card.english)||[]).length;
     speak(card.english,false,{media:output,onStatus:status=>{b.dataset.playback=status}});
    });
    b.innerHTML=speakerIcon;b.setAttribute("aria-label","听发音："+card.english);return b;
   }
   if(card.target==="zh")prompt.append(speaker());
   body.append(prompt);
   const audioBackup=button("备用播放器","translation-audio-backup",()=>{
    const urls=audioSources?.(card.english)||[]; if(!urls.length)return;
    stop?.(); output.src=urls.find(v=>/^https?:/i.test(v))||urls[0];
    output.controls=true;output.hidden=false; audioBackup.hidden=true;
    audioNotice.textContent="请点播放器里的三角按钮。";
   });
   audioBackup.hidden=true;body.append(audioNotice,audioBackup,output);
   if(guided) {
    const hint=element("details","translation-guide");
    hint.open=true;hint.append(element("summary",null,"第 1 步：看提示"),text("translation-note",card.hint));body.append(hint);
   }
   const field=element("form","translation-form");
   const label=element("label",null,guided?"第 2 步：拼出来或自己输入":card.target==="en"?"你的英文翻译":"你的中文翻译");
   label.htmlFor="translationInput";
   const input=element("textarea","translation-input");
   input.id="translationInput";input.rows=mode==="word"?1:2;
   input.maxLength=380;input.lang=card.target;
   input.placeholder=card.target==="en"?"在这里输入英文":"在这里输入中文";
   if(card.target==="en"){input.spellcheck=false;input.autocomplete="off";input.setAttribute("autocorrect","off");input.setAttribute("autocapitalize","off")}
   field.append(label,input);
   let picked=[], bankBtns=[];
   if(guided){
    const bank=element("div","translation-bank"), selected=element("div","translation-picked");
    selected.setAttribute("role","group"); selected.setAttribute("aria-label","已拼好的词块");
    bank.setAttribute("role","group");bank.setAttribute("aria-label","可用词块");
    function rerenderPicked(){
     input.value=picked.map(i=>bankBtns[i].textContent).join(" ");
     selected.replaceChildren(...picked.map(i=>button(bankBtns[i].textContent,"translation-token",()=>{
      picked=picked.filter(x=>x!==i);bankBtns[i].disabled=false;rerenderPicked();
     })));
     selected.hidden=!picked.length;
    }
    shuffle(card.parts).forEach((word,i)=>{
     const b=button(word,"translation-token",()=>{picked.push(i);b.disabled=true;rerenderPicked()});
     b.lang="en";bankBtns.push(b);bank.append(b);
    });
    input.addEventListener("input",()=>{if(picked.length){picked=[];selected.replaceChildren();selected.hidden=true;bankBtns.forEach(b=>b.disabled=false)}});
    selected.hidden=true;field.append(selected,bank);
   }
   body.append(field);
   const feedback=element("section","translation-feedback");feedback.hidden=true;
   const status=text("translation-note","");status.role="status";status.id="translationResult";
   feedback.append(status);body.append(feedback);
   const checkButton=button("检查答案","sprint-action",()=>submit(false));
   const reveal=button("看参考答案","sprint-secondary",()=>submit(true));
   const next=button(index+1===cards.length?"查看结果":"下一题","sprint-action",()=>{
    output.pause(); ++index;render();
   });
   next.hidden=true;
   const actions=element("div","translation-actions");
   actions.append(checkButton,reveal,next);foot.append(actions);
   let answered=false;
   function submit(show){
    if(answered)return;
    const result=show?"reveal":check(input.value,card);
    if(result==="empty"){
     status.textContent="先输入你的翻译，或点「看参考答案」。";feedback.hidden=false;focus(input);return;
    }
    if(result==="retry"){
     status.textContent="和本题参考答案不一样。可以再试一次，也可以看参考答案对照。";
     feedback.hidden=false;feedback.dataset.result=result;return;
    }
    answered=true;input.readOnly=true; field.querySelectorAll("button").forEach(b=>b.disabled=true);
    feedback.hidden=false;feedback.dataset.result=result;
    if(result==="match"){++correct;status.textContent="答对了！"}
    else if(result==="review"){status.textContent="你的译法不在参考答案里，不一定错。请对照意思。"}
    else{mistakes.push(card);status.textContent="参考答案";}
    progress.value=index+1;
    const answer=element("div","translation-answer");
    const reference=element("b",null,card.answers[0]);reference.lang=card.target;
    answer.append(reference);
    if(card.target==="en")answer.append(speaker());
    feedback.append(answer);
    if(card.why)feedback.append(text("translation-note",(guided?"第 3 步：为什么这样说？ ":"")+card.why));
    if(card.entry){
     const mastery=element("div","sprint-mastery");mastery.innerHTML=masteryButtons(card.entry);
     bindMastery(mastery,card.entry);feedback.append(mastery);
     const practice=exampleGuide(card);
     if(practice)feedback.append(button("用这个词造句","sprint-secondary",()=>{
      output.pause();
      const prior={mode,direction,cards,index,mistakes,correct};
      session={restore:()=>{
       const {mode:m,direction:d,cards:c,index:i,mistakes:k,correct:a}=prior;
       session=null;mode=m;direction=d;cards=c;index=i+1;mistakes=k;correct=a;render();
      }};
      mode="guide";start("zh-en",[practice]);
     }));
     else feedback.append(text("translation-note","这个词还没有可用的双语整句，先去「引导造句」练基础句型。"));
    }
    if(guided){
     const free=element("details","translation-freeform");
     free.append(element("summary",null,"挑战：换一个词，自己再造一句"));
     const freeInput=element("textarea","translation-input");
     freeInput.rows=1;freeInput.lang="en";freeInput.placeholder="写一句自己的英文";
     freeInput.setAttribute("aria-label","自己再造一句英文");
     free.append(text("translation-note","试着换掉人、动作或对象；这一题自己对照，不自动判分。"),freeInput);
     feedback.append(free);
    }
    checkButton.hidden=true;reveal.hidden=true;next.hidden=false;
    status.tabIndex=-1;feedback.scrollIntoView({block:"nearest"});focus(status);
    // On short screens, Next stays pinned and the explanation scrolls independently.
   }
   field.addEventListener("submit",e=>{e.preventDefault();submit(false)});
   input.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();submit(false)}
   });
   focus(h);
  }
  const viewport=global.visualViewport;
  function syncViewport(){
   if(!root.open||!viewport||!global.matchMedia("(max-width: 640px)").matches){
    root.style.removeProperty("--translation-visible-height");
    root.style.removeProperty("--translation-viewport-top");return;
   }
   root.style.setProperty("--translation-visible-height",viewport.height+"px");
   root.style.setProperty("--translation-viewport-top",viewport.offsetTop+"px");
  }
  viewport?.addEventListener("resize",syncViewport);
  viewport?.addEventListener("scroll",syncViewport);
  at("translationClose").addEventListener("click",close);
  root.addEventListener("close",()=>{
   body.querySelector("audio")?.pause();stop?.();
   doc.documentElement.classList.remove("sprint-modal-open");syncViewport();
   focus(trigger); trigger=null;session=null;
  });
  for(const [type,buttons] of Object.entries(launchers)) for(const b of buttons)b.addEventListener("click",()=>launch(type,b));
 }
 const api=Object.freeze({normalize,check,makeWords,makeSentences,makeGuide,mount});
 if(typeof module==="object"&&module.exports)module.exports=api;
 else global.BECTranslation=api;
})(typeof window!=="undefined"?window:globalThis);
