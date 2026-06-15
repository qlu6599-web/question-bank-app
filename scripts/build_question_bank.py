import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
EXTRACTED = ROOT / "extracted"
OUTPUT = ROOT / "src" / "data" / "questions.js"
JSON_OUTPUT = ROOT / "app" / "data" / "question_bank.json"
SUPPLEMENTAL_ANSWERS = ROOT / "scripts" / "supplemental_answers.json"
APP_DATA_VERSION = "20260615-v19"

SOURCE_DOC_DIRS = [
    ROOT / "audit" / "source_docs",
    Path.home() / "Desktop" / "t题库",
    Path.home() / "Desktop" / "t题库" / "1",
]

DOCX_FALLBACK_NAMES = {
    "操作系统": "os.docx",
    "软件工程": "software.docx",
}

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
RED_COLORS = {"FF0000", "RED", "C00000", "E60000"}

TYPE_MAP = {
    "cloze": "fill",
    "qa": "essay",
    "design": "comprehensive",
    "application": "comprehensive",
}

TYPE_ORDER = ["single", "multiple", "judge", "fill", "comprehensive", "essay"]

TYPE_LABELS = {
    "single": "单选题",
    "multiple": "多选题",
    "judge": "判断题",
    "fill": "填空题",
    "comprehensive": "综合题",
    "essay": "问答题",
}

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


def find_source_docx(file_key):
    fallback = DOCX_FALLBACK_NAMES.get(file_key)
    if fallback:
        fallback_path = ROOT / "audit" / "source_docs" / fallback
        if fallback_path.exists():
            return fallback_path
    for directory in SOURCE_DOC_DIRS:
        if not directory.exists():
            continue
        for path in directory.glob("*.docx"):
            if path.name.startswith("~$"):
                continue
            if file_key in path.name:
                return path
    return None


def docx_colored_paragraphs(file_key):
    path = find_source_docx(file_key)
    if not path:
        return []
    with zipfile.ZipFile(path) as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    paragraphs = []
    for paragraph in root.iter(f"{{{WORD_NS['w']}}}p"):
        text_parts = []
        red_flags = []
        for run in paragraph.findall("./w:r", WORD_NS):
            color = run.find("./w:rPr/w:color", WORD_NS)
            color_value = color.get(f"{{{WORD_NS['w']}}}val") if color is not None else ""
            is_red = color_value.upper() in RED_COLORS
            for child in list(run):
                if child.tag == f"{{{WORD_NS['w']}}}t":
                    value = child.text or ""
                elif child.tag == f"{{{WORD_NS['w']}}}tab":
                    value = " "
                elif child.tag == f"{{{WORD_NS['w']}}}br":
                    value = "\n"
                else:
                    continue
                text_parts.append(value)
                red_flags.extend([is_red] * len(value))
        text = "".join(text_parts)
        if text.strip():
            paragraphs.append((text, red_flags))
    return paragraphs


def heading_key(text):
    return re.sub(r"\s+", "", text).strip("：:。")


def colored_section(paragraphs, start_heading, end_heading):
    start_key = heading_key(start_heading)
    end_key = heading_key(end_heading) if end_heading else ""
    start = None
    for index, (text, _) in enumerate(paragraphs):
        if heading_key(text) == start_key:
            start = index + 1
            break
    if start is None:
        return []
    end = len(paragraphs)
    if end_key:
        for index in range(start, len(paragraphs)):
            if heading_key(paragraphs[index][0]) == end_key:
                end = index
                break
    return paragraphs[start:end]


def group_colored_numbered_items(paragraphs):
    groups = []
    current = None
    current_number = None
    for text, flags in paragraphs:
        match = re.match(r"^\s*(\d+)\s*[、.．]", text)
        if match:
            if current:
                groups.append((current_number, current))
            current_number = int(match.group(1))
            current = [(text, flags)]
        elif current:
            current.append((text, flags))
    if current:
        groups.append((current_number, current))
    return groups


def meaningful_red_chars(text, red_flags):
    return [
        char
        for char, is_red in zip(text, red_flags)
        if is_red and not char.isspace() and char not in ".．、:："
    ]


def red_answer_from_labelled_options(group):
    text_parts = []
    red_flags = []
    for index, (text, flags) in enumerate(group):
        if index:
            text_parts.append("\n")
            red_flags.append(False)
        text_parts.append(text)
        red_flags.extend(flags)
    text = "".join(text_parts)
    markers = list(re.finditer(r"(?<![A-Za-z0-9])([A-D])[.．]\s*", text))
    answers = []
    for index, marker in enumerate(markers):
        start = marker.start()
        end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        if meaningful_red_chars(text[start:end], red_flags[start:end]):
            answers.append(marker.group(1))
    return "".join(dict.fromkeys(answers))


def red_answer_from_unlabelled_options(group):
    answers = []
    for index, (text, flags) in enumerate(group[1:5]):
        if meaningful_red_chars(text, flags):
            answers.append("ABCD"[index])
    return "".join(answers)


def colored_choice_answer_map(file_key, start_heading, end_heading, labelled=True):
    paragraphs = docx_colored_paragraphs(file_key)
    if not paragraphs:
        return {}
    section = colored_section(paragraphs, start_heading, end_heading)
    if not labelled:
        groups = [(index // 5 + 1, section[index:index + 5]) for index in range(0, len(section), 5) if len(section[index:index + 5]) == 5]
    else:
        groups = group_colored_numbered_items(section)
    answer_map = {}
    for number, group in groups:
        answer = red_answer_from_labelled_options(group) if labelled else red_answer_from_unlabelled_options(group)
        if answer:
            answer_map[number] = answer
    return answer_map


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


def strip_solution_from_prompt(text):
    return clean(re.split(r"\n?\s*(?:\*\*)?答案\s*[：:]|\n?\s*正确答案\s*[：:]|\n?\s*答案解析\s*[：:]|\n?\s*章\s*\n?\s*节\s*[：:]|\n?\s*章节\s*[：:]|\n?\s*认知层次\s*[：:]|\n?\s*难度\s*[：:]|---", text, maxsplit=1)[0])


def strip_analysis_metadata(text):
    return clean(re.split(r"\n?\s*章\s*\n?\s*节\s*[：:]|\n?\s*章节\s*[：:]|\n?\s*认知层次\s*[：:]|\n?\s*难度\s*[：:]|---", text, maxsplit=1)[0])


def parse_pdf_questions(text, subject, prefix, start_idx=1):
    questions = []
    pattern = re.compile(r"题目\s*([0-9０-９]+)\s*[：:]\s*", re.M)
    matches = list(pattern.finditer(text))
    for pos, match in enumerate(matches):
        block = text[match.end(): matches[pos + 1].start() if pos + 1 < len(matches) else len(text)]
        raw_question = re.split(r"\n\s*选项\s*[：:]", block, maxsplit=1)[0]
        raw_question = re.split(r"\n\s*[A-F]\.\s*", raw_question, maxsplit=1)[0]
        raw_question = strip_solution_from_prompt(raw_question)
        analysis_match = re.search(r"答案解析\s*[：:]\s*(.*?)(?:\n\s*章节\s*[：:]|$)", block, re.S)
        analysis = clean(analysis_match.group(1)) if analysis_match else ""
        analysis = strip_analysis_metadata(analysis)
        answer_match = re.search(r"正确答案\s*[：:]\s*((?:[A-Fa-f]+)(?![A-Za-z])|正确|错误|T|F)", block)
        if not answer_match:
            generic_answer = re.search(r"正确答案\s*[：:]\s*(.*?)(?:\n\s*答案解析\s*[：:]|\n\s*章节\s*[：:]|答案解析\s*[：:]|章节\s*[：:]|---|$)", block, re.S)
            if generic_answer:
                answer_text = clean(generic_answer.group(1))
                prompt = clean(re.split(r"\n\s*正确答案\s*[：:]", block, maxsplit=1)[0])
                prompt = re.sub(r"[（(]\s*1\s*[）)]", "____", prompt)
                prompt = re.sub(r"_+", "____", prompt)
                if answer_text and "____" in prompt:
                    questions.append({
                        "id": f"{prefix}-{start_idx + len(questions)}",
                        "type": "cloze",
                        "question": prompt,
                        "options": [],
                        "answer": answer_text,
                        "answerText": answer_text,
                        "acceptedAnswers": answer_variants(answer_text),
                        "analysis": analysis or f"本题填空答案为：{answer_text}。",
                        "source": subject,
                    })
            continue
        answer = answer_to_option(answer_match.group(1))
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
            continue
        image_option_override = infer_pdf_image_option_override(subject, raw_question, option_area, answer)
        if image_option_override:
            questions.append({
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "multiple" if len(answer) > 1 else "single",
                "question": clean(raw_question),
                "options": image_option_override,
                "answer": answer,
                "analysis": analysis or "本题选项包含公式或图片内容，请结合题目截图核对。",
                "source": subject,
                "needsImageOptions": True,
            })
            continue
        override = infer_pdf_cloze_override(subject, raw_question, analysis)
        if override:
            question_text, answer_text, accepted = override
            questions.append({
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "cloze",
                "question": question_text,
                "options": [],
                "answer": answer_text,
                "answerText": answer_text,
                "acceptedAnswers": accepted,
                "analysis": analysis or f"本题填空答案为：{answer_text}。",
                "source": subject,
            })
    return questions


def infer_pdf_cloze_override(subject, raw_question, analysis):
    if subject != "人工智能":
        return None
    normalized = re.sub(r"\s+", "", raw_question)
    if "可信度因子" in normalized and "取值范围" in normalized:
        return (
            "在可信度方法中，可信度因子的取值范围是 ____。",
            "-1 到 1",
            ["-1 到 1", "-1到1", "[-1,1]", "[-1，1]", "-1～1", "-1~1"],
        )
    if "模糊集合" in normalized and "隶属函数" in normalized and "取值范围" in normalized:
        return (
            "模糊集合的隶属函数的取值范围是 ____。",
            "0 到 1",
            ["0 到 1", "0到1", "[0,1]", "[0，1]", "0～1", "0~1"],
        )
    return None


def infer_pdf_image_option_override(subject, raw_question, option_area, answer):
    if subject != "人工智能":
        return None
    normalized = re.sub(r"\s+", "", raw_question)
    formula_option_questions = [
        "谓词公式",
        "由多个子证据",
        "启发式搜索",
        "Sigmoid",
        "ReLU",
    ]
    has_blank_option_markers = all(re.search(rf"^\s*{letter}\.\s*$", option_area, re.M) for letter in "ABCD")
    if has_blank_option_markers and any(key in normalized for key in formula_option_questions):
        return [f"{letter}. 见题目截图中的公式选项" for letter in "ABCD"]
    return None


def split_labelled_options(text):
    option_matches = list(re.finditer(r"([A-D])[.．、]\s*(.*?)(?=(?:\s+[A-D][.．、]\s*)|$)", text, re.S))
    if len(option_matches) >= 2:
        return [clean(m.group(2)) for m in option_matches]
    return []


def group_numbered_items(section):
    items = []
    current = None
    for line in section.splitlines():
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^(\d+)\s*[、.．](.*)", line)
        if match:
            if current:
                items.append(current)
            body = match.group(2)
            if not re.match(r"^[ \t\u3000]{3,}", body):
                body = body.lstrip()
            current = [match.group(1), body]
        elif current:
            current[1] += " " + line
    if current:
        items.append(current)
    return items


def parse_os_single_choice(text, prefix, start_idx=1, answer_map=None):
    answer_map = answer_map or {}
    if "第一部分，单项选择题" not in text or "第二部分，填空题" not in text:
        return []
    section = text.split("第一部分，单项选择题", 1)[1].split("第二部分，填空题", 1)[0]
    questions = []
    for number, body in group_numbered_items(section):
        body = body.rstrip(" 。")
        markers = list(re.finditer(r"(?<![A-Za-z0-9])([A-D])[.．]\s*", body))
        if len(markers) < 4:
            continue
        raw_question = body[: markers[0].start()].rstrip()
        raw_question = re.sub(r"[（(]\s*[）)]", "____", raw_question)
        raw_question = re.sub(r"[ \t\u3000]{3,}", " ____ ", raw_question)
        raw_question = clean(raw_question)
        raw_question = re.sub(r"\s+____", " ____", raw_question)
        raw_question = re.sub(r"____\s+([。,.，、])", r"____\1", raw_question)
        if "____" not in raw_question:
            raw_question = raw_question.rstrip("。 ") + " ____。"
        options = []
        for index, marker in enumerate(markers[:4]):
            start = marker.end()
            end = markers[index + 1].start() if index + 1 < min(len(markers), 4) else len(body)
            options.append(clean(body[start:end]))
        if len(options) == 4 and all(options):
            answer = answer_map.get(int(number), "")
            item = {
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "single",
                "question": raw_question,
                "options": options,
                "answer": answer,
                "analysis": f"原 Word 红色标注正确答案为 {answer}。" if answer else "原操作系统复习资料未提供该单选题答案，请结合教材或课堂答案核对。",
                "source": "操作系统",
            }
            if not answer:
                item["unscored"] = True
            questions.append(item)
    return questions


OS_FILL_ANSWERS = {
    1: "分时操作系统",
    2: "阻塞状态",
    3: "就绪状态",
    4: "请求与保持",
    5: "(3T1+2T2+T3)/3",
    6: "重定位",
    7: "虚拟地址空间（虚拟存储器）",
    8: "绝对路径",
    9: "最短寻道时间优先",
    10: "操作系统",
    11: "批处理操作系统",
    12: "就绪状态",
    13: "加1",
    14: "循环等待",
    15: "合并空闲分区",
    16: "根目录",
    17: "文件系统",
    18: "实时操作系统",
    19: "就绪队列",
    20: "1",
    21: "最佳适应算法",
    22: "抖动",
    23: "目录",
    24: "就绪状态",
    25: "-1～3",
    26: "J1、J3、J2",
    27: "地址重定位",
    28: "局部性",
    29: "16MB（2²⁴ B）",
    30: "100",
    31: "虚拟设备",
    32: "2",
    33: "P",
    34: "4",
    35: "3",
    36: "防止系统进入不安全状态",
    37: "编译",
    38: "2",
    39: "文件控制块",
    40: "16",
    41: "490",
    42: "中断",
}


def answer_variants(answer):
    variants = [answer]
    compact = re.sub(r"\s+", "", answer)
    if compact not in variants:
        variants.append(compact)
    if "（" in answer:
        short = answer.split("（", 1)[0].strip()
        if short and short not in variants:
            variants.append(short)
    if "～" in answer:
        alt = answer.replace("～", "~")
        if alt not in variants:
            variants.append(alt)
    return variants


def cloze_question_from_answer(body, answer):
    body = re.sub(r"\s+", " ", body).strip()
    patterns = [re.escape(answer)]
    compact = re.sub(r"\s+", "", answer)
    if compact != answer:
        patterns.append(r"\s*".join(map(re.escape, compact)))
    if answer == "加1":
        patterns.append(r"加\s*1")
    best_match = None
    for pattern in patterns:
        matches = list(re.finditer(pattern, body))
        if matches:
            best_match = matches[-1]
            break
    if best_match:
        question = body[: best_match.start()] + "____" + body[best_match.end():]
    else:
        question = body.rstrip("。") + " ____。"
    question = re.sub(r"\s*[.．]\s*____", " ____", question)
    question = re.sub(r"\s+", " ", question)
    question = re.sub(r"\s+([。,.，、])", r"\1", question)
    question = re.sub(r"____\s+", "____", question)
    return clean(question)


def parse_os_fill_questions(text, prefix, start_idx=1):
    section = text.split("第二部分，填空题", 1)[1].split("三、判断题", 1)[0]
    questions = []
    for number, body in group_numbered_items(section):
        answer = OS_FILL_ANSWERS.get(int(number))
        if not answer:
            continue
        questions.append({
            "id": f"{prefix}-{start_idx + len(questions)}",
            "type": "cloze",
            "question": cloze_question_from_answer(body, answer),
            "options": [],
            "answer": answer,
            "answerText": answer,
            "acceptedAnswers": answer_variants(answer),
            "analysis": f"本题填空答案为：{answer}。",
            "source": "操作系统",
        })
    return questions


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


def parse_software_single_choice(text, prefix, start_idx=1, answer_map=None):
    answer_map = answer_map or {}
    if not re.search(r"\n\s*单选题\s*\n", text) or not re.search(r"\n\s*多选题\s*\n", text):
        return []
    section = re.split(r"\n\s*单选题\s*\n", text, maxsplit=1)[1]
    section = re.split(r"\n\s*多选题\s*\n", section, maxsplit=1)[0]
    questions = []
    for number, body in group_numbered_items(section):
        body = body.rstrip()
        markers = list(re.finditer(r"(?<![A-Za-z0-9])([A-D])[.．]\s*", body))
        if len(markers) < 4:
            continue
        question = clean(body[: markers[0].start()])
        options = []
        for index, marker in enumerate(markers[:4]):
            start = marker.end()
            end = markers[index + 1].start() if index + 1 < min(len(markers), 4) else len(body)
            options.append(clean(body[start:end]))
        if len(options) == 4 and all(options):
            answer = answer_map.get(int(number), "")
            item = {
                "id": f"{prefix}-{start_idx + len(questions)}",
                "type": "single",
                "question": question,
                "options": options,
                "answer": answer,
                "analysis": f"原 Word 红色标注正确答案为 {answer}。" if answer else "原软件工程复习资料未提供该单选题答案，请结合教材或课堂答案核对。",
                "source": "软件工程",
            }
            if not answer:
                item["unscored"] = True
            questions.append(item)
    return questions


def parse_software_multiple_choice(text, prefix, start_idx=1, answer_map=None):
    answer_map = answer_map or {}
    if not re.search(r"\n\s*多选题\s*\n", text) or not re.search(r"\n\s*填空题\s*\n", text):
        return []
    section = re.split(r"\n\s*多选题\s*\n", text, maxsplit=1)[1]
    section = re.split(r"\n\s*填空题\s*\n", section, maxsplit=1)[0]
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    questions = []
    for index in range(0, len(lines), 5):
        group = lines[index:index + 5]
        if len(group) < 5:
            continue
        question, *options = group
        number = len(questions) + 1
        answer = answer_map.get(number, "")
        item = {
            "id": f"{prefix}-{start_idx + len(questions)}",
            "type": "multiple",
            "question": clean(question),
            "options": [clean(option) for option in options],
            "answer": answer,
            "analysis": f"原 Word 红色标注正确答案为 {answer}。" if answer else "原软件工程复习资料未提供该多选题答案，请结合教材或课堂答案核对。",
            "source": "软件工程",
        }
        if not answer:
            item["unscored"] = True
        questions.append(item)
    return questions


def parse_fill_questions(text, subject, prefix, start_idx=1):
    questions = []
    if subject == "操作系统" and "第二部分，填空题" in text:
        return parse_os_fill_questions(text, prefix, start_idx)
    if subject == "软件工程" and re.search(r"\n\s*填空题\s*\n", text):
        section = re.split(r"\n\s*填空题\s*\n", text, maxsplit=1)[1].split("综合题", 1)[0]
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


def normalize_question_type(question_type):
    return TYPE_MAP.get(question_type, question_type)


def supplemental_matches_question(question, patch):
    has_images = "referenceImages" in patch or "questionImages" in patch
    if has_images and normalize_question_type(question.get("type", "")) != "comprehensive":
        return False
    return True


def build_json_question(question, subject, meta):
    normalized = dict(question)
    original_type = normalized.get("type", "")
    question_type = normalize_question_type(original_type)
    reference = normalized.get("referenceAnswer") or normalized.get("answerText") or normalized.get("answer") or ""

    normalized["subject"] = subject
    normalized["type"] = question_type
    normalized["question"] = normalized.get("question", "")
    normalized["options"] = normalized.get("options") if isinstance(normalized.get("options"), list) else []
    normalized["answer"] = normalized.get("answer") or reference
    normalized["analysis"] = normalized.get("analysis") or reference
    normalized["source"] = normalized.get("source") or subject
    normalized["sourceFile"] = normalized.get("sourceFile") or ""
    normalized["pageNumber"] = normalized.get("pageNumber") if "pageNumber" in normalized else None
    normalized["accent"] = meta["accent"]
    if original_type != question_type:
        normalized["originalType"] = original_type
    return normalized


def build_json_bank(bank):
    subjects = []
    questions = []
    for subject_block in bank:
        subject_name = subject_block["subject"]
        normalized_questions = [
            build_json_question(question, subject_name, subject_block)
            for question in subject_block["questions"]
        ]
        subjects.append({
            "name": subject_name,
            "accent": subject_block["accent"],
            "description": subject_block["description"],
        })
        questions.extend(normalized_questions)
    return {
        "version": APP_DATA_VERSION,
        "schema": "question-bank-json-v2-single-source",
        "singleSourceOfTruth": "ALL_QUESTIONS",
        "subjects": subjects,
        "ALL_QUESTIONS": questions,
    }


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
            os_single_answers = colored_choice_answer_map("操作系统", "第一部分，单项选择题", "第二部分，填空题", True)
            questions.extend(parse_os_single_choice(text, meta["prefix"], 1, os_single_answers))
            questions.extend(parse_fill_questions(text, subject, meta["prefix"], len(questions) + 1))
            questions.extend(parse_tf_parentheses(text.split("三、判断题", 1)[1] if "三、判断题" in text else text, subject, meta["prefix"], len(questions) + 1))
        elif subject == "软件工程":
            questions = []
            software_single_answers = colored_choice_answer_map("软件工程", "单选题", "多选题", True)
            software_multiple_answers = colored_choice_answer_map("软件工程", "多选题", "填空题", False)
            questions.extend(parse_software_tf(text, meta["prefix"]))
            questions.extend(parse_software_single_choice(text, meta["prefix"], len(questions) + 1, software_single_answers))
            questions.extend(parse_software_multiple_choice(text, meta["prefix"], len(questions) + 1, software_multiple_answers))
            questions.extend(parse_fill_questions(text, subject, meta["prefix"], len(questions) + 1))
            questions.extend(parse_software_subjective(text, meta["prefix"], len(questions) + 1))
        for index, question in enumerate(questions, 1):
            question["id"] = f"{meta['prefix']}-{index}"
            patch = supplemental.get(question["id"])
            if patch and supplemental_matches_question(question, patch):
                question.update(patch)
                if "referenceAnswer" in patch:
                    question["analysis"] = patch["referenceAnswer"]
        bank.append({
            "subject": subject,
            "accent": meta["accent"],
            "description": meta["description"],
            "questions": questions,
        })
        counts[subject] = len(questions)
    json_bank = build_json_bank(bank)
    js = "window.QuestionData = (() => {\n"
    js += "const ALL_QUESTIONS = "
    js += json.dumps(json_bank["ALL_QUESTIONS"], ensure_ascii=False, indent=2)
    js += ";\n\n"
    js += "const subjectMeta = "
    js += json.dumps(json_bank["subjects"], ensure_ascii=False, indent=2)
    js += ";\n\n"
    js += """const questionBank = subjectMeta.map((subject) => ({
  subject: subject.name,
  accent: subject.accent,
  description: subject.description,
  questions: ALL_QUESTIONS.filter((question) => question.subject === subject.name)
}));

const flatQuestions = ALL_QUESTIONS;

return { ALL_QUESTIONS, questionBank, flatQuestions };
})();\n"""
    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUTPUT.write_text(json.dumps(json_bank, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT.write_text(js, encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print("total", sum(counts.values()))


if __name__ == "__main__":
    build()
