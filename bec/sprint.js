(function (global) {
 "use strict";
 const BATCH_SIZE = 8;
 function mount({root, launchButtons, makeQuiz, selection, allWords, meaning, speak, stop,
                 mastery, masteryButtons, bindMastery, speakerIcon, audioSources, toast, onClose}) {
  const doc = root.ownerDocument, by = id => root.querySelector("#" + id);
  const body = by("sprintContent"), foot = by("sprintFoot"), progress = by("sprintProgress");
  const count = by("sprintCount"), close = by("sprintClose");
  let session = null, trigger = null;

  function node(tag, cls, text) {
   const el = doc.createElement(tag);
   if (cls) el.className = cls;
   if (text !== undefined) el.textContent = text;
   return el;
  }
  function named(tag, id, cls, text) {
   const el = node(tag, cls, text); el.id = id; return el;
  }
  function button(label, cls, id, action) {
   const el = named("button", id, cls, label);
   el.type = "button"; el.addEventListener("click", action);
   return el;
  }
  function title(text, en) {
   const el = named("h2", "sprintTitle", "sprint-title", text);
   if (en) el.lang = "en";
   el.tabIndex = -1;
   return el;
  }
  function setProgress(value, total, label) {
   progress.max = Math.max(1, total); progress.value = value;
   count.textContent = label;
  }
  function build(words) { return makeQuiz({questions:words, allWords:allWords(), meaning}); }
  function beginBatch() {
   session.batch = [];
   while (session.remaining.length && !session.batch.length) {
    const batch = session.remaining.splice(0, BATCH_SIZE);
    session.batch = session.mode === "weak" ? batch.filter(w => mastery(w) === "unfamiliar") : batch;
    if (session.batch.length) {
     session.quiz = build(session.batch);
     if (!session.quiz.view().total) session.batch = [];
    }
   }
   session.retry = false;
   session.missed = new Set();
   session.original = session.quiz?.view().total ? session.quiz.view().total : 0;
   session.skipped = session.batch.length - session.original;
   return session.batch.length > 0;
  }
  function hasMore() {
   return session.mode !== "weak" ? session.remaining.length > 0 :
    session.remaining.some(w => mastery(w) === "unfamiliar");
  }
  function closeDialog() { if (root.open) root.close(); }
  function finish() {
   const {correct,total} = session.quiz.view();
   setProgress(total,total,total + " / " + total);
   body.append(node("p","sprint-kicker",session.retry ? "错词回练" : "本轮闯关"));
   const heading = title("这一轮完成了");
   body.append(heading, node("p","sprint-summary","答对 " + correct + " / " + total + " 题"));
   const mistakes = session.missed.size;
   body.append(node("p","sprint-muted",mistakes ?
    mistakes + " 个答错的词可以再练，其他词不用重来。" :
    "这一轮没有错题。会不会，还是由你自己标记。"));
   if (session.skipped > 0) body.append(node("p","sprint-muted",
    session.skipped + " 个词暂不适合出选择题，仍可用原来的听写练习。"));
   if (mistakes) foot.append(button("只练本轮错词","sprint-action","sprintRetry",()=>{
    const words = session.batch.filter(w=>session.missed.has(w.w));
    const retryQuiz = build(words);
    if (!retryQuiz.view().total) return;
    session.quiz = retryQuiz;
    session.retry = true; session.missed = new Set(); render();
   }));
   if (hasMore()) foot.append(button("练下一组",mistakes?"sprint-secondary":"sprint-action","sprintMore",()=>{
    const prior = {...session, remaining:session.remaining.slice()};
    if (beginBatch()) render();
    else {
     session = prior;
     session.remaining = [];
     // Keep the completed summary usable if the remaining terms have no printable options.
     by("sprintMore")?.remove();
     body.append(node("p","sprint-muted","剩余词暂无可用的选择题。"));
    }
   }));
   foot.append(button("返回学习","sprint-secondary","sprintDone",closeDialog));
   heading.focus({preventScroll:true});
  }
  function render() {
   body.replaceChildren(); foot.replaceChildren(); body.scrollTop=0; root.scrollTop=0;
   const {card,index,total,done} = session.quiz.view();
   if (done || !card) { finish(); return; }
   setProgress(index,total,(index+1) + " / " + total);
   const kicker = session.retry ? "错词回练 · 选中文意思" :
    session.mode === "weak" ? "未掌握词 · 选中文意思" : "今日闯关 · 选中文意思";
   body.append(node("p","sprint-kicker",kicker));
   const heading = title(card.term,true);
   const media = named("audio", "sprintAudio", "sprint-native-audio");
   media.preload = "none";
   media.setAttribute("playsinline", "");
   media.setAttribute("aria-label", "播放 " + card.term + " 的发音");
   media.hidden = true;
   const hear = button(undefined,"sprint-speaker","sprintSpeak",()=>{
    notice.textContent="";
    media.hidden = true;
    media.controls = false;
    const sources = audioSources?.(card.term) || [];
    backup.hidden = !sources.length;
    speak(card.term,false,{media,onStatus:status=>{
     hear.dataset.playback = status;
     if (status === "loading" || status === "playing") notice.textContent="";
     if (status === "retry") notice.textContent="再点一次喇叭，或用下方的备用播放器。";
    }});
   });
   hear.innerHTML = speakerIcon;
   hear.title = "听发音";
   hear.setAttribute("aria-label","听发音：" + card.term);
   const prompt = node("div","sprint-prompt");
   prompt.append(heading,hear);
   const notice = named("p","sprintAudioNotice","sprint-muted sprint-audio-notice");
   notice.setAttribute("role","status");
   const backup = button("备用播放器", "sprint-audio-backup", "sprintAudioBackup",()=>{
    const urls = audioSources?.(card.term) || [];
    if (!urls.length) return;
    stop?.();
    // Use the recorded file when available, independently of speech synthesis.
    // Native Play is a fresh tap initiated directly by the learner.
    const network = urls.find(src=>/^https?:/i.test(src));
    const playable = network || urls[0];
    if (media.src !== playable) media.src = playable;
    media.controls = true;
    media.hidden = false;
    notice.textContent = "请点播放器里的三角按钮。";
    backup.hidden = true;
    if (network) {
     const file = node("a","sprint-audio-link","单独打开音频");
     file.href = network;
     file.target = "_blank"; file.rel = "noopener noreferrer";
     notice.append(" ", file);
    }
   });
   backup.hidden = true;
   // Expose independent native-player status for troubleshooting without moving the question.
   media.addEventListener("playing",()=>{ if (media.controls) hear.dataset.playback="native-playing"; });
   media.addEventListener("error",()=>{
    if (!media.controls) return;
    notice.textContent="音频没载入，请返回点蓝色喇叭重试。";
    hear.dataset.playback="native-error";
   });
   const options = named("div","sprintOptions","sprint-options");
   if (card.options.some(opt => opt.label.length > 26)) options.dataset.layout="stack";
   options.setAttribute("role","group"); options.setAttribute("aria-label","中文选项");
   body.append(prompt,notice,backup,media,options);
   const feedback = named("p","sprintFeedback","sprint-feedback");
   feedback.setAttribute("role","status"); feedback.hidden = true;
   const masteryRow = node("div","sprint-mastery");
   masteryRow.hidden = true;
   const next = button("下一题","sprint-action","sprintNext",()=>{
    if (session.quiz.next()) { media.pause(); stop?.(); render(); }
   });
   next.disabled = true;
   next.setAttribute("aria-describedby","sprintFeedback");
   foot.append(feedback,masteryRow,next);
   for (const [i,opt] of card.options.entries()) {
    const option = button(opt.label,"sprint-option","sprintOption"+i,()=>{
     if (!session.quiz.choose(i)) return;
     const correct = session.quiz.view().answer.correct;
     if (!correct) session.missed.add(card.term);
     setProgress(index+1,total,(index+1) + " / " + total);
     Array.from(options.children).forEach((el,j)=>{
      el.setAttribute("aria-disabled","true");
      el.tabIndex=-1;
      el.classList.toggle("is-picked",i===j);
      el.classList.toggle("is-right",card.options[j].correct);
      el.classList.toggle("is-wrong",i===j&&!correct);
     });
     feedback.classList.add(correct ? "is-right" : "is-wrong");
     feedback.hidden = false;
     feedback.textContent = correct ? "答对了！" : "正确答案：" + card.label;
     const word = session.batch.find(w=>w.w===card.term);
     if (word) {
      masteryRow.innerHTML = masteryButtons(word);
      masteryRow.hidden = false;
      bindMastery(masteryRow,word);
     }
     next.disabled = false;
     if (index+1===total) next.textContent = "查看结果";
     next.focus({preventScroll:true});
    });
    options.append(option);
   }
   heading.focus({preventScroll:true});
  }

  function open(mode, launcher) {
   if (typeof root.showModal !== "function") { toast("请用新版 Safari 或 Chrome 打开闯关"); return; }
   const words = selection(mode);
   if (words === null) return;
   if (!words.length) {
    toast(mode==="weak" ? "还没有标记为「未掌握」的词" : "今天还没有可练的词");
    return;
   }
   session = {mode, remaining:words.slice(), quiz:null};
   if (!beginBatch()) { session=null; toast("这些词暂无适合的选择题，可以继续用听写练习"); return; }
   trigger = launcher;
   stop?.();
   render();
   root.showModal();
   doc.documentElement.classList.add("sprint-modal-open");
   by("sprintTitle").focus({preventScroll:true});
  }
  close.addEventListener("click",closeDialog);
  root.addEventListener("close",()=>{
   by("sprintAudio")?.pause();
   stop?.();
   doc.documentElement.classList.remove("sprint-modal-open");
   session = null; onClose?.();
   trigger?.focus({preventScroll:true}); trigger = null;
  });
  for (const [name,launcher] of Object.entries(launchButtons)) {
   launcher.addEventListener("click",()=>open(name==="weak"?"weak":"today",launcher));
  }
 }
 global.BECSprint = Object.freeze({mount});
})(window);
