/* Original beginner exercises. Arrays begin with the canonical teaching answer. */
window.BEC_TRANSLATION_DATA = {
  sentences: [
    {
      en: ["I am working.", "I'm working."],
      zh: ["我正在工作。", "我在工作。"],
      why: "说「正在做」，用主语 + am/is/are + 动词-ing。主语是 I，所以说 I am working。"
    },
    {
      en: ["He is working.", "He's working."],
      zh: ["他正在工作。", "他在工作。"],
      why: "把 I 换成 he，am 也要换成 is；working 不变。"
    },
    {
      en: ["They are working.", "They're working."],
      zh: ["他们正在工作。", "他们在工作。", "她们正在工作。", "她们在工作。"],
      why: "主语是 they，用 are；are 后的 working 表示动作正在进行。"
    },
    {
      en: ["I work every day."],
      zh: ["我每天都工作。", "我每天工作。", "我天天工作。", "我每天都上班。", "我每天上班。"],
      why: "every day 表示日常习惯，用 I work。说「我正在工作」才用 I am working。"
    },
    {
      en: ["He works in Shanghai."],
      zh: ["他在上海工作。", "他在上海上班。"],
      why: "这是常态，不是说此刻正在做什么。一般现在时里，主语 he 后用 works；城市前用 in。"
    },
    {
      en: ["This is an invoice."],
      zh: ["这是一张发票。", "这是发票。", "这是一份发票。"],
      why: "陈述句先说 this，再说 is。invoice 开头的读音是元音，所以用 an，不用 a。"
    },
    {
      en: ["Is this an invoice?"],
      zh: ["这是一张发票吗？", "这是发票吗？", "这是一份发票吗？"],
      why: "把陈述句 This is an invoice 改成问句：is 移到 this 前面，其他词的顺序不变。"
    },
    {
      en: ["The contract is ready."],
      zh: ["合同准备好了。", "合同已经准备好了。", "合同已准备好。", "合同准备好啦。"],
      why: "ready 是「准备好的」。一个合同用 is：the contract + is + ready。"
    },
    {
      en: ["Are the documents ready?"],
      zh: ["文件准备好了吗？", "文件都准备好了吗？", "资料准备好了吗？", "资料都准备好了吗？"],
      why: "documents 是复数，用 are。问「准备好了吗」，把 are 放到主语前面。"
    },
    {
      en: ["We are checking the contract.", "We're checking the contract."],
      zh: ["我们正在核对合同。", "我们在核对合同。", "我们正在检查合同。", "我们在检查合同。"],
      why: "we 要配 are；checking 用来说明此刻正在做什么。the contract 指双方都知道的那份合同。"
    },
    {
      en: ["She is preparing the report.", "She's preparing the report."],
      zh: ["她正在准备报告。", "她在准备报告。", "她正在准备这份报告。", "她在准备这份报告。"],
      why: "she 要配 is。prepare 变成 -ing 形式时，先去掉最后的 e，再加 ing：preparing。"
    },
    {
      en: ["Please send me the invoice.", "Please send the invoice to me."],
      zh: ["请把发票发给我。", "请发给我发票。", "请给我发一下发票。", "麻烦把发票发给我。"],
      why: "礼貌请别人做事可用 Please + 动词原形。send me the invoice 和 send the invoice to me 都表示把发票发给我。"
    },
    {
      en: ["We have a meeting tomorrow."],
      zh: ["我们明天有个会。", "我们明天有一个会议。", "我们明天有一场会议。", "我们明天有会议。"],
      why: "have a meeting 是「开会／有个会」，tomorrow 放在句末交代时间。这里说已安排的事，不表示此刻正在开会。"
    },
    {
      en: ["The customer is waiting for a reply."],
      zh: ["客户正在等回复。", "客户在等回复。", "客户正在等待回复。", "客户在等答复。"],
      why: "一个客户用 is。waiting 表示「正在等」，wait for a reply 是「等回复」。"
    },
    {
      en: ["Our team checks invoices every morning."],
      zh: ["我们团队每天早上都核对发票。", "我们团队每天早上核对发票。", "我们团队每天早晨核对发票。", "我们小组每天早上核对发票。"],
      why: "every morning 表示习惯。这里把团队看成一个整体，用 checks，不用 is checking。"
    }
  ],
  guide: [
    {
      en: ["I am working.", "I'm working."],
      zh: ["我正在工作。", "我在工作。"],
      why: "I 和 am 搭配；am + working 表示「正在工作」。",
      hint: "① 找「我」：I。② 给 I 选 am。③ 找表示「正在工作」的 working，放在 am 后面。",
      parts: ["I", "am", "working"]
    },
    {
      en: ["He is working.", "He's working."],
      zh: ["他正在工作。", "他在工作。"],
      why: "he 和 is 搭配。主语变了，working 不变。",
      hint: "① 先说「他」：He。② he 配 is，不配 am。③ 放上 working。",
      parts: ["He", "is", "working"]
    },
    {
      en: ["They are working.", "They're working."],
      zh: ["他们正在工作。", "他们在工作。", "她们正在工作。", "她们在工作。"],
      why: "they 和 are 搭配；I am、he/she is、we/you/they are。",
      hint: "① 先说「他们」：They。② they 配 are。③ 把 working 放在 are 后面。",
      parts: ["They", "are", "working"]
    },
    {
      en: ["I work every day."],
      zh: ["我每天都工作。", "我每天工作。", "我天天工作。", "我每天都上班。", "我每天上班。"],
      why: "every day 表示习惯，所以用 I work，而不是 I am working。",
      hint: "① 找主语 I。② 「每天」是习惯，用 work，不加 am。③ 最后放表示时间的 every day。",
      parts: ["I", "work", "every", "day"]
    },
    {
      en: ["He works in Shanghai."],
      zh: ["他在上海工作。", "他在上海上班。"],
      why: "说一般情况时，he 配 works。in Shanghai 说明地点。",
      hint: "① 用 He 作主语。② 这句说工作地点，不说此刻正在做什么，选 works。③ 最后放 in Shanghai。",
      parts: ["He", "works", "in", "Shanghai"]
    },
    {
      en: ["This is an invoice."],
      zh: ["这是一张发票。", "这是发票。", "这是一份发票。"],
      why: "陈述句用 this + is；invoice 开头是元音读音，所以前面放 an。",
      hint: "① 这句是介绍，不是提问，先放 This。② 接 is。③ 把 an 放在 invoice 前。",
      parts: ["This", "is", "an", "invoice"]
    },
    {
      en: ["Is this an invoice?"],
      zh: ["这是一张发票吗？", "这是发票吗？", "这是一份发票吗？"],
      why: "陈述句是 This is an invoice。变问句时，把 is 先说，this 跟在后面。",
      hint: "① 看到「吗」，这是问句。② 把 is 提到 this 前面。③ an invoice 保持原顺序，句末用问号。",
      parts: ["Is", "this", "an", "invoice"]
    },
    {
      en: ["The contract is ready."],
      zh: ["合同准备好了。", "合同已经准备好了。", "合同已准备好。"],
      why: "合同是一份，用 is；ready 放在 is 后面说明状态。",
      hint: "① 先说「那份合同」：The contract。② 一个合同用 is。③ 接 ready，告诉对方它已准备好。",
      parts: ["The", "contract", "is", "ready"]
    },
    {
      en: ["Are the documents ready?"],
      zh: ["文件准备好了吗？", "文件都准备好了吗？", "资料准备好了吗？", "资料都准备好了吗？"],
      why: "documents 是复数，要用 are。问句中 are 放在 the documents 前面。",
      hint: "① 「文件」在本题是多份，用 documents。② 多份文件配 are。③ 这是提问，把 are 放第一，ready 放末尾。",
      parts: ["Are", "the", "documents", "ready"]
    },
    {
      en: ["We are checking the contract.", "We're checking the contract."],
      zh: ["我们正在核对合同。", "我们在核对合同。", "我们正在检查合同。", "我们在检查合同。"],
      why: "we 配 are，用 are checking 表达正在核对。",
      hint: "① 先说 We。② we 配 are。③ 加 checking 表示正在核对，最后接 the contract。",
      parts: ["We", "are", "checking", "the", "contract"]
    },
    {
      en: ["Please send me the invoice.", "Please send the invoice to me."],
      zh: ["请把发票发给我。", "请发给我发票。", "请给我发一下发票。", "麻烦把发票发给我。"],
      why: "请别人做事时，Please 后接动词原形。send me the invoice 中，先说收件人 me，再说要发的东西。",
      hint: "① 用 Please 礼貌开头。② 接动作 send。③ 用 me 说明发给谁，最后放 the invoice。",
      parts: ["Please", "send", "me", "the", "invoice"]
    }
  ]
};
