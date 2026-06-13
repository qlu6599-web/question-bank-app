import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXTRACTED = ROOT / "extracted"
OUTPUT = ROOT / "src" / "data" / "questions.js"
SUPPLEMENTAL_ANSWERS = ROOT / "scripts" / "supplemental_answers.json"

SUBJECT_META = {
    "操作系统": {
        "accent": "#2563eb",
        "description": "进程、内存、调度、文件与设备管理",
        "file_key": "操作系统",
        "prefix": "os",
    },
    "数据库": {
        "accent": "#14b8a6",
        "description": "数据库系统、SQL、事务、规范化与设计",
        "file_key": "数据库",
        "prefix": "db",
    },
    "软件工程": {
        "accent": "#f97316",
        "description": "流程、需求、设计、测试、维护与项目管理",
        "file_key": "软件工程",
        "prefix": "se",
    },
    "数据科学": {
        "accent": "#7c3aed",
        "description": "数据、统计、可视化、大数据与机器学习",
        "file_key": "数据科学",
        "prefix": "ds",
    },
    "人工智能": {
        "accent": "#e11d48",
        "description": "知识表示、搜索、机器学习、深度学习与智能体",
        "file_key": "人工智能",
        "prefix": "ai",
    },
}


def clean(text):
    text = re.sub(r"\\n", "\n", text)
    text = re.sub(r"[ \t\u3000]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip(" \n\r\t：:")


def answer_to_option(answer):
    normalized = answer.strip().upper()
    if normalized in {"T", "TRUE", "正确", "对"}:
        return "A"
    if normalized in {"F", "FALSE", "错误", "错"}:
        return "B"
    return normalized.replace(" ", "")


def make_tf_question(prefix, idx, subject, statement, raw_answer, analysis=""):
    answer = answer_to_option(raw_answer)
    return {
        "id": f"{prefix}-{idx}",
        "type": "judge",
        "question": clean(statement),
        "options": ["正确", "错误"],
        "answer": answer,
        "analysis": clean(analysis) or f"本题判断为：{'正确' if answer == 'A' else '错误'}。",
        "source": subject,
    }


def parse_pdf_questions(text, subject, prefix, start_idx=1):
    questions = []
    pattern = re.compile(r"题目\s*([0-9０-９]+)\s*[：:]\s*", re.M)
    matches = list(pattern.finditer(text))
    for pos, match in enumerate(matches):
        block = text[match.end(): matches[pos + 1].start() if pos + 1 < len(matches) else len(text)]
        raw_question = re.split(r"\n\s*选项\s*[：:]", block, maxsplit=1)[0]
        raw_question = re.split(r"\n\s*[A-F]\.\s*", raw_question, maxsplit=1)[0]
        answer_match = re.search(r"正确答案\s*[：:]\s*([A-Fa-f]+|正确|错误|T|F)", block)
        if not answer_match:
            continue
        answer = answer_to_option(answer_match.group(1))
        analysis_match = re.search(r"答案解析\s*[：:]\s*(.*?)(?:\n\s*章节\s*[：:]|$)", block, re.S)
        analysis = clean(analysis_match.group(1)) if analysis_match else ""
        analysis = clean(re.split(r"\n\s*章节\s*[：:]|章节\s*[：:]|---", analysis, maxsplit=1)[0])
        option_area = block
        if "正确答案" in option_area:
            option_area = option_area.split("正确答案", 1)[0]
        option_matches = list(re.finditer(r"^\s*([A-F])\.\s*(.*?)(?=^\s*[A-F]\.\s*|\Z)", option_area, re.M | re.S))
        options = []
        for option_match in option_matches:
            value = clean(option_match.group(2))
            value = re.sub(r"\n\s*", " ", value)
            value = clean(value)
            if value and not value.startswith("正确答案"):
                options.append(value)
        if not options and answer in {"A", "B"} and re.fullmatch(r"正确|错误|T|F", answer_match.group(1), re.I):
            questions.append(make_tf_question(prefix, start_idx + len(questions), subject, raw_question, answer, analysis))
            continue
        if len(options) >= 2 and set(answer).issubset(set("ABCDEFGHIJKLMNOPQRSTUVWXYZ"[: len(options)])):
            questions.append({
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "multiple" if len(answer) > 1 else "single",
                "question": clean(raw_question),
                "options": options,
                "answer": answer,
                "analysis": analysis or "参考资料未提供详细解析。",
                "source": subject,
            })
    return questions


def split_labelled_options(text):
    option_matches = list(re.finditer(r"([A-D])[.．、]\s*(.*?)(?=(?:\s+[A-D][.．、]\s*)|$)", text, re.S))
    if len(option_matches) >= 2:
        return [clean(m.group(2)) for m in option_matches]
    return []


def parse_database_doc(text, prefix):
    questions = []
    mc_section = text.split("二、判断题", 1)[0]
    lines = [line.strip() for line in mc_section.splitlines() if line.strip()]
    starts = []
    for i, line in enumerate(lines):
        if re.match(r"^[A-D][.．、]", line):
            continue
        if re.search(r"[（(]\s*[A-D]\s*[）)]", line):
            starts.append(i)
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[start:end]
        answer_match = re.search(r"[（(]\s*([A-D])\s*[）)]", block[0])
        if not answer_match:
            continue
        answer = answer_match.group(1)
        question = clean(re.sub(r"[（(]\s*[A-D]\s*[）)]", "____", block[0], count=1))
        option_text = "\n".join(block[1:])
        options = []
        labelled = re.findall(r"([A-D])[.．、]\s*([^A-D\n]+?)(?=\s+[A-D][.．、]|\n|$)", option_text)
        if len(labelled) >= 4:
            options = [clean(value) for _, value in labelled[:4]]
        else:
            for line in block[1:]:
                found = split_labelled_options(line)
                if found:
                    options.extend(found)
                elif line and not re.search(r"[（(]\s*[A-D]\s*[）)]", line):
                    options.append(clean(re.sub(r"^[A-D][.．、]\s*", "", line)))
        options = [option for option in options if option][:4]
        if len(options) == 4:
            questions.append({
                "id": f"{prefix}-{len(questions) + 1}",
                "type": "single",
                "question": question,
                "options": options,
                "answer": answer,
                "analysis": f"原复习资料标注正确答案为 {answer}。",
                "source": "数据库",
            })
    tf_part = text.split("二、判断题", 1)[1] if "二、判断题" in text else ""
    for statement, ans in re.findall(r"(.+?)[（(]\s*([TF])\s*[）)]", tf_part):
        questions.append(make_tf_question(prefix, len(questions) + 1, "数据库", statement, ans))
    return questions


def parse_tf_parentheses(text, subject, prefix, start_idx=1):
    questions = []
    for statement, ans in re.findall(r"([^\n。！？]+(?:[。！？]|｡)?)[（(]\s*([TF])\s*[）)]", text):
        statement = clean(statement)
        if len(statement) >= 8:
            questions.append(make_tf_question(prefix, start_idx + len(questions), subject, statement, ans))
    return questions


def parse_software_tf(text, prefix):
    questions = []
    section = re.split(r"\n\s*单选题\s*\n", text, maxsplit=1)[0]
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    current = None
    for line in lines:
        if line in {"T", "F"} and current:
            questions.append(make_tf_question(prefix, len(questions) + 1, "软件工程", current, line))
            current = None
        elif not line.endswith("：") and "题" not in line:
            current = line
    return questions


def parse_fill_questions(text, subject, prefix, start_idx=1):
    questions = []
    if subject == "软件工程" and re.search(r"\n\s*填空题\s*\n", text):
        section = re.split(r"\n\s*填空题\s*\n", text, maxsplit=1)[1].split("综合题", 1)[0]
    elif subject == "操作系统" and "第二部分，填空题" in text:
        section = text.split("第二部分，填空题", 1)[1].split("三、判断题", 1)[0]
    else:
        return []
    lines = [line.strip() for line in section.splitlines() if re.match(r"^\d+[、.．]", line.strip())]
    raw_items = []
    for line in lines:
        body = re.sub(r"^\d+[、.．]\s*", "", line)
        answer = ""
        question = ""
        embedded = re.search(r"_+([^_]{1,60}?)_+", body)
        if embedded:
            answer = clean(embedded.group(1))
            question = clean(body[: embedded.start()] + "____" + body[embedded.end():])
        elif "____" in body or "_____" in body or "____________" in body:
            left, _, tail = body.partition("。")
            answer = clean(tail)
            question = clean(left + "。")
            if not answer:
                continue
        else:
            match = re.search(r"(.+?)\s+([^，。,.]{1,40})\s{2,}([。,.]|$)", body)
            if match:
                answer = clean(match.group(2))
                question = clean(match.group(1) + " ____" + match.group(3))
            else:
                continue
        answer = clean(answer.strip("_。,.， "))
        question = clean(question.replace(answer, "____", 1) if answer and answer in question and "____" not in question else question)
        if answer and 1 <= len(answer) <= 50 and "图" not in question:
            raw_items.append((question, answer))
    all_answers = []
    for _, answer in raw_items:
        if answer not in all_answers:
            all_answers.append(answer)
    for question, answer in raw_items:
        questions.append({
            "id": f"{prefix}-{start_idx + len(questions)}",
            "type": "cloze",
            "question": clean(question),
            "options": [],
            "answer": answer,
            "answerText": answer,
            "analysis": f"本题填空答案为：{answer}。",
            "source": subject,
        })
    return questions


def parse_reference_blocks(section, subject, qtype, prefix, start_idx=1):
    questions = []
    starts = list(re.finditer(r"(?m)^(\d+)[、.．，,]\s*", section))
    for pos, match in enumerate(starts):
        block = section[match.end(): starts[pos + 1].start() if pos + 1 < len(starts) else len(section)]
        if not block.strip():
            continue
        if "参考答案：" in block:
            prompt, reference = block.split("参考答案：", 1)
        elif "\n答：" in block:
            prompt, reference = block.split("\n答：", 1)
        else:
            prompt, reference = block, "原复习资料未提供参考答案，请按课堂要求或教材内容作答。"
        prompt = clean(prompt)
        reference = clean(reference)
        if len(prompt) < 8:
            continue
        questions.append({
            "id": f"{prefix}-{start_idx + len(questions)}",
            "type": qtype,
            "question": prompt,
            "options": [],
            "answer": "",
            "referenceAnswer": reference,
            "analysis": reference,
            "source": subject,
        })
    return questions


def parse_qa_blocks(section, subject, prefix, start_idx=1):
    questions = []
    starts = list(re.finditer(r"(?m)^(\d+)[、.．，,]\s*", section))
    for pos, match in enumerate(starts):
        block = clean(section[match.end(): starts[pos + 1].start() if pos + 1 < len(starts) else len(section)])
        if not block:
            continue
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            continue
        prompt = clean(lines[0])
        reference = clean("\n".join(lines[1:]))
        questions.append({
            "id": f"{prefix}-{start_idx + len(questions)}",
            "type": "qa",
            "question": prompt,
            "options": [],
            "answer": "",
            "referenceAnswer": reference,
            "analysis": reference,
            "source": subject,
        })
    return questions


def parse_database_application(text, prefix, start_idx=1):
    if "四、综合应用题" not in text:
        return []
    section = text.split("四、综合应用题", 1)[1]
    scenario_starts = list(re.finditer(r"(?m)^(\d+)[、.．]\s*已知", section))
    questions = []
    question_markers = (
        "写出SQL语句",
        "写出 SQL 语句",
        "写出创建",
        "利用SQL",
        "利用关系代数",
        "查询",
        "删除",
        "将",
        "向",
        "创建存储过程",
    )
    for pos, start in enumerate(scenario_starts):
        block = section[start.start(): scenario_starts[pos + 1].start() if pos + 1 < len(scenario_starts) else len(section)]
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        context = lines[0]
        current_question = None
        current_answer = []
        for line in lines[1:]:
            is_prompt = any(marker in line for marker in question_markers) and not re.match(r"^(select|from|where|create|insert|delete|update|set|order|group|delimiter|primary|foreign|end|\()", line, re.I)
            if is_prompt:
                if current_question:
                    reference = clean("\n".join(current_answer)) or "原复习资料未提供参考答案。"
                    questions.append({
                        "id": f"{prefix}-{start_idx + len(questions)}",
                        "type": "application",
                        "question": clean(context + "\n" + current_question),
                        "options": [],
                        "answer": "",
                        "referenceAnswer": reference,
                        "analysis": reference,
                        "source": "数据库",
                    })
                current_question = line
                current_answer = []
            elif current_question:
                current_answer.append(line)
        if current_question:
            reference = clean("\n".join(current_answer)) or "原复习资料未提供参考答案。"
            questions.append({
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "application",
                "question": clean(context + "\n" + current_question),
                "options": [],
                "answer": "",
                "referenceAnswer": reference,
                "analysis": reference,
                "source": "数据库",
            })
    return questions


def parse_software_subjective(text, prefix, start_idx=1):
    questions = []
    comprehensive_match = re.search(r"\n\s*综合题\s*\n", text)
    qa_match = re.search(r"\n\s*问答题\s*\n", text)
    if comprehensive_match:
        section_start = comprehensive_match.end()
        section_end = qa_match.start() if qa_match else len(text)
        section = text[section_start:section_end]
        questions.extend(parse_reference_blocks(section, "软件工程", "comprehensive", prefix, start_idx))
    if qa_match:
        section = text[qa_match.end():]
        questions.extend(parse_qa_blocks(section, "软件工程", prefix, start_idx + len(questions)))
    return questions


def find_text_file(key):
    return next(path for path in EXTRACTED.glob("*.txt") if key in path.name)


def build():
    supplemental = json.loads(SUPPLEMENTAL_ANSWERS.read_text(encoding="utf-8")) if SUPPLEMENTAL_ANSWERS.exists() else {}
    bank = []
    counts = {}
    for subject, meta in SUBJECT_META.items():
        text = find_text_file(meta["file_key"]).read_text(encoding="utf-8")
        questions = []
        if subject in {"人工智能", "数据科学"}:
            questions = parse_pdf_questions(text, subject, meta["prefix"])
        elif subject == "数据库":
            questions = parse_database_doc(text, meta["prefix"])
            if "三、数据库设计题" in text:
                design_section = text.split("三、数据库设计题", 1)[1].split("四、综合应用题", 1)[0]
                questions.extend(parse_reference_blocks(design_section, subject, "design", meta["prefix"], len(questions) + 1))
            questions.extend(parse_database_application(text, meta["prefix"], len(questions) + 1))
        elif subject == "操作系统":
            questions = []
            questions.extend(parse_fill_questions(text, subject, meta["prefix"], 1))
            questions.extend(parse_tf_parentheses(text.split("三、判断题", 1)[1] if "三、判断题" in text else text, subject, meta["prefix"], len(questions) + 1))
        elif subject == "软件工程":
            questions = []
            questions.extend(parse_software_tf(text, meta["prefix"]))
            questions.extend(parse_fill_questions(text, subject, meta["prefix"], len(questions) + 1))
            questions.extend(parse_software_subjective(text, meta["prefix"], len(questions) + 1))
        for index, question in enumerate(questions, 1):
            question["id"] = f"{meta['prefix']}-{index}"
            if question["id"] in supplemental:
                question.update(supplemental[question["id"]])
                if "referenceAnswer" in supplemental[question["id"]]:
                    question["analysis"] = supplemental[question["id"]]["referenceAnswer"]
        bank.append({
            "subject": subject,
            "accent": meta["accent"],
            "description": meta["description"],
            "questions": questions,
        })
        counts[subject] = len(questions)
    js = "window.QuestionData = (() => {\n"
    js += "const questionBank = "
    js += json.dumps(bank, ensure_ascii=False, indent=2)
    js += ";\n\n"
    js += """const flatQuestions = questionBank.flatMap((subject) =>
  subject.questions.map((question) => ({
    ...question,
    subject: subject.subject,
    accent: subject.accent
  }))
);

return { questionBank, flatQuestions };
})();\n"""
    OUTPUT.write_text(js, encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print("total", sum(counts.values()))


if __name__ == "__main__":
    build()
