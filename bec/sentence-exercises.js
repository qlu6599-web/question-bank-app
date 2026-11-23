(function (scope) {
  'use strict';

  const labels = Object.freeze({translate:'翻译这句话', fill:'选词填空'});
  const translation = (id, en, answer, distractors, why, alternatives = []) => ({
    id, mode:'translate', en, answer, distractors, alternatives, why,
    zh:answer.join('') + (/\?$/.test(en) ? '？' : '。')
  });
  const blanks = (id, parts, answer, distractors, zh, why) => ({
    id, mode:'fill', parts, answer, distractors, zh, why, alternatives:[],
    en:parts.reduce((out, part, i) => out + (i > 0 ? answer[i - 1] + part : part), '')
  });

  const pool = {
    translate: [
      translation('invoice', 'Please send me the invoice.',
        ['请','把','发票','发给','我'], ['合同','明天','你'],
        'invoice 是「发票」。send me the invoice 指「把发票发给我」。'),
      translation('contract', 'We need to sign the contract today.',
        ['我们','今天','需要','签署','合同'], ['订单','下周','已经'],
        'sign the contract 指「签署合同」。today 也可以放在「我们」前面。',
        [['今天','我们','需要','签署','合同'],['我们','需要','今天','签署','合同']]),
      translation('meeting', 'The meeting starts at nine.',
        ['会议','九点','开始'], ['十点','结束','付款'],
        '英语用 at 加具体时间。at nine 是「在九点」；翻成中文可以省略「在」。',
        [['九点','会议','开始']]),
      translation('quote', 'Could you send us the quotation?',
        ['能','把','报价单','发给','我们','吗'], ['发票','我','马上'],
        'Could you …? 常用来礼貌地提出请求。quotation 在这个场景里是「报价单」。'),
      translation('payment', 'We received your payment yesterday.',
        ['我们','昨天','收到了','你的','付款'], ['明天','报价','发出了'],
        'received 是 receive 的过去式。yesterday 表示昨天发生的事。',
        [['昨天','我们','收到了','你的','付款']]),
      translation('email', 'The customer replied to our email.',
        ['客户','回复了','我们的','邮件'], ['发送了','会议','明天'],
        'reply to an email 指「回复一封邮件」。注意 reply 后用 to。')
    ],
    fill: [
      blanks('invoice-a', ['Please send me ', ' invoice.'], ['an'], ['a','at','on'],
        '请发给我一张发票。', 'invoice 开头发元音 /ɪ/，所以前面用 an。'),
      blanks('meeting-at', ['The meeting ', ' ', ' 10 a.m.'], ['starts','at'], ['start','on','in'],
        '会议上午十点开始。', '主语 the meeting 是单数，用 starts；具体时间点前用 at。'),
      blanks('contract-sign', ['Both companies will ', ' the contract tomorrow.'], ['sign'], ['signs','signed','signing'],
        '两家公司明天将签署合同。', 'will 后接动词原形。sign the contract 是「签署合同」。'),
      blanks('quote-of', ['Please send a quotation ', ' two printers.'], ['for'], ['at','by','from'],
        '请发一份两台打印机的报价。', '这里用 a quotation for + 商品，说明是给什么商品报价。'),
      blanks('payment-received', ['We have ', ' your payment.'], ['received'], ['receive','receives','receiving'],
        '我们已收到你的付款。', '现在完成时用 have + 过去分词。receive 的过去分词是 received。'),
      blanks('order-if', ['If you confirm the order today, we ', ' ', ' the goods tomorrow.'], ['can','ship'], ['ships','shipping','are'],
        '如果你今天确认订单，我们明天就能发货。', 'can 表示能够，后面接动词原形 ship；ship the goods 是「把货物发出去」。')
    ]
  };

  function shuffled(items, random) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; --i) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function createSession(mode, random = Math.random) {
    if (!Object.prototype.hasOwnProperty.call(pool, mode)) throw new Error('未知的句子练习模式');
    return {mode, cursor:0, score:0, status:'answering',
      items:pool[mode].map(question => ({
        ...question,
        chips:shuffled([...question.answer, ...question.distractors], random)
          .map((text, id) => ({id, text}))
      })),
      chosen:[], attempts:[]};
  }
  const item = session => session.items[session.cursor];
  const same = (a, b) => a.length === b.length && a.every((token, i) => token === b[i]);
  function choose(session, id) {
    const question = item(session);
    if (session.status !== 'answering' || !question.chips.some(c => c.id === id) ||
        session.chosen.includes(id) || session.chosen.length >= question.answer.length) return false;
    session.chosen.push(id);
    return true;
  }
  function remove(session, id) {
    if (session.status !== 'answering' || !session.chosen.includes(id)) return false;
    session.chosen = session.chosen.filter(chosen => chosen !== id);
    return true;
  }
  function check(session) {
    if (session.status !== 'answering' || session.chosen.length !== item(session).answer.length) return null;
    const question = item(session);
    const answer = session.chosen.map(id => question.chips.find(c => c.id === id).text);
    const right = [question.answer, ...question.alternatives].some(expected => same(answer, expected));
    session.status = right ? 'correct' : 'incorrect';
    if (session.attempts[session.cursor] === undefined) {
      session.attempts[session.cursor] = right;
      if (right) session.score++;
    }
    return right;
  }
  function retry(session) {
    if (session.status !== 'incorrect') return false;
    session.chosen = [];
    session.status = 'answering';
    return true;
  }
  function advance(session) {
    if (session.status !== 'correct' && session.status !== 'incorrect') return false;
    if (session.cursor === session.items.length - 1) {
      session.status = 'done';
    } else {
      session.cursor++;
      session.status = 'answering';
      session.chosen = [];
    }
    return true;
  }

  const escaped = text => String(text).replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

  function mount({host, speak, onOpen, onClose}) {
    if (!host || typeof host.appendChild !== 'function') throw new Error('缺少句子练习容器');
    const root = (host.ownerDocument || document).createElement('section');
    root.className = 'bec-sentence';
    root.setAttribute('aria-label', 'BEC 句子练习');
    root.setAttribute('data-extra-practice', 'sentence');
    root.hidden = true;
    host.appendChild(root);
    let session = null;

    const speakerIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5 5 9H2v6h3l5 4V5Z"/><path d="M14 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
    function close({silent = false} = {}) {
      if (!session) return false;
      root.hidden = true;
      root.textContent = '';
      session = null;
      if (!silent && typeof onClose === 'function') onClose();
      return true;
    }
    function start(mode) {
      session = createSession(mode);
      root.hidden = false;
      if (typeof onOpen === 'function') onOpen(mode);
      render('.bec-sentence-title');
      return true;
    }
    function sound(slow, reveal = session.status !== 'answering') {
      if (typeof speak !== 'function') return;
      const q = item(session);
      const spoken = q.mode === 'fill' && !reveal ? q.parts.join(' blank ') : q.en;
      speak(spoken, slow);
    }
    function selectedChip(chip, disabled) {
      return '<button class="bes-chip bes-selected" type="button" data-remove="' + chip.id + '"' +
        ' aria-label="' + escaped('移除' + chip.text) + '"' + (disabled ? ' disabled' : '') + '>' +
        escaped(chip.text) + '</button>';
    }
    function render(focusSelector) {
      if (!session) return;
      const q = item(session), completed = session.status === 'done';
      const locked = session.status !== 'answering';
      const step = completed ? session.items.length : session.cursor + 1;
      const stepText = '第 ' + step + ' / ' + session.items.length + ' 题';
      let html = '<header class="bes-header">' +
        '<button type="button" class="bes-close" data-action="close" aria-label="退出句子练习">×</button>' +
        '<div class="bes-progress"><progress aria-label="句子练习进度" max="' + session.items.length +
        '" value="' + step + '"></progress><span>' + (completed ? '本组已完成' : stepText) + '</span></div></header>';
      if (completed) {
        html += '<div class="bes-done"><h2 class="bec-sentence-title" tabindex="-1">这组练完了</h2>' +
          '<p>首次答对 <strong>' + session.score + '</strong> / ' + session.items.length + ' 题</p>' +
          '<p>可以重练这一组，词块顺序会重新打乱。</p></div>' +
          '<footer class="bes-footer"><button class="bes-primary" type="button" data-action="restart">再练一遍</button>' +
          '<button class="bes-back" type="button" data-action="close">返回学习</button></footer>';
      } else {
        const chips = session.chosen.map(id => q.chips.find(chip => chip.id === id));
        html += '<h2 class="bec-sentence-title" tabindex="-1">' + labels[q.mode] + '</h2>' +
          '<p class="bes-instruction">' + (q.mode === 'translate' ? '听或读英文，点选词块组成中文。' : '根据中文提示，按顺序点选英文填入空格。') + '</p>' +
          '<div class="bes-prompt"><button type="button" class="bes-speaker" data-action="sound" aria-label="' +
          (q.mode === 'fill' && !locked ? '朗读带空格的英文句子' : '朗读英文句子') + '">' + speakerIcon + '</button>';
        if (q.mode === 'translate') {
          html += '<p lang="en" class="bes-en">' + escaped(q.en) + '</p></div>' +
            '<div class="bes-answer" aria-label="你的中文答案">' +
            (chips.map(chip => selectedChip(chip, locked)).join('') || '<span class="bes-placeholder">点选下方词块</span>') +
            '</div>';
        } else {
          html += '<p lang="en" class="bes-en bes-fill" aria-label="英文填空句子">' +
            q.parts.map((part, i) => {
              return i === 0 ? escaped(part) : (chips[i - 1] ? selectedChip(chips[i - 1], locked) :
                '<span class="bes-slot" aria-label="空格 ' + i + '">____</span>') + escaped(part);
            }).join('') + '</p></div><p class="bes-hint">中文：' + escaped(q.zh) + '</p>';
        }
        html += '<div class="bes-bank" aria-label="备选词块">' +
          q.chips.map(chip => '<button type="button" class="bes-chip' + (session.chosen.includes(chip.id) ? ' bes-used' : '') +
            '" data-choice="' + chip.id + '"' + (locked || session.chosen.includes(chip.id) ? ' disabled' : '') + '>' +
            escaped(chip.text) + '</button>').join('') + '</div>';
        if (locked) {
          html += '<div class="bes-result ' + (session.status === 'correct' ? 'bes-good' : 'bes-bad') + '" role="status">' +
            '<strong>' + (session.status === 'correct' ? '答对了！' : '这题再看一下') + '</strong>' +
            '<span class="bes-result-example" lang="en">' + escaped(q.en) + '</span>' +
            '<span>' + escaped(q.zh) + '</span><small>' + escaped(q.why) + '</small></div>';
        }
        html += '<footer class="bes-footer' + (session.status === 'incorrect' ? ' bes-retry-row' : '') + '">' +
          (session.status === 'incorrect' ? '<button type="button" class="bes-back" data-action="retry">重做本题</button>' : '') +
          '<button class="bes-primary" type="button" data-action="' +
          (locked ? 'advance">继续' : 'check"' + (session.chosen.length === q.answer.length ? '' : ' disabled') + '>检查') +
          '</button></footer>';
      }
      root.innerHTML = html;
      const nextFocus = focusSelector && root.querySelector(focusSelector);
      if (nextFocus && typeof nextFocus.focus === 'function') nextFocus.focus({preventScroll:true});
    }

    root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !session || button.disabled || !root.contains(button)) return;
      if (button.dataset.choice !== undefined) {
        const id = Number(button.dataset.choice);
        if (choose(session, id)) render(event.detail === 0 ? '[data-remove="' + id + '"]' : null);
        return;
      }
      if (button.dataset.remove !== undefined) {
        const id = Number(button.dataset.remove);
        if (remove(session, id)) render(event.detail === 0 ? '[data-choice="' + id + '"]' : null);
        return;
      }
      switch (button.dataset.action) {
        case 'close': close(); break;
        case 'restart': start(session.mode); break;
        case 'sound': sound(false); break;
        case 'check': if (check(session) !== null) render('[data-action="advance"]'); break;
        case 'retry':
          if (retry(session)) render('.bec-sentence-title');
          break;
        case 'advance':
          if (advance(session)) render('.bec-sentence-title');
          break;
      }
    });
    return { start, close, isActive:() => !!session, element:root };
  }

  const api = Object.freeze({ mount, createSession, choose, remove, check, retry, advance });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope) scope.BECSentenceExercises = api;
})(typeof window === 'object' ? window : null);
