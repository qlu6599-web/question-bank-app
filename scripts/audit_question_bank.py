import difflib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import fitz
import pdfplumber
from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path.home() / "Desktop" / "t题库"
AUDIT_DIR = ROOT / "audit"
SOURCE_TEXT_DIR = AUDIT_DIR / "source_text_fresh"
REPORT_JSON = AUDIT_DIR / "audit_report.json"
REPORT_MD = AUDIT_DIR / "missing_fix_report.md"
STATS_JSON = AUDIT_DIR / "question_type_statistics.json"
MERGED_JSON = AUDIT_DIR / "question_bank_full_merged.json"
RAW_MERGED_JSON = AUDIT_DIR / "question_bank_raw_before_dedupe.json"
STANDARD_JSON = ROOT / "app" / "data" / "question_bank_standard.json"
APP_JSON = ROOT / "app" / "data" / "question_bank.json"
SRC_COMPAT_JS = ROOT / "src" / "data" / "questions.js"
SUPPLEMENTAL_ANSWERS = ROOT / "scripts" / "supplemental_answers.json"
ASSET_QUESTION_DIR = ROOT / "assets" / "questions"
STANDARD_VERSION = "20260614-v12"


SOURCE_FILES = {
    "操作系统": "操作系统-期末复习资料.docx",
    "数据库": "数据库原理及应用 复习资料.docx",
    "软件工程": "软件工程  复习资料.docx",
    "数据科学": "数据科学  复习资料.pdf",
    "人工智能": "人工智能导论 复习资料.pdf",
}

TYPE_LABELS = {
    "single": "单选题",
    "multiple": "多选题",
    "judge": "判断题",
    "fill": "填空题",
    "comprehensive": "综合题",
    "essay": "问答题",
}

TYPE_ORDER = ["single", "multiple", "judge", "fill", "comprehensive", "essay"]


def load_builder():
    spec = importlib.util.spec_from_file_location("build_question_bank", ROOT / "scripts" / "build_question_bank.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def iter_docx_blocks(parent):
    parent_elm = parent.element.body if isinstance(parent, DocxDocument) else parent._tc
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def extract_docx_text(path):
    doc = Document(path)
    lines = []
    for block in iter_docx_blocks(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                lines.append(text)
        elif isinstance(block, Table):
            for row in block.rows:
                cells = [cell.text.strip().replace("\n", " | ") for cell in row.cells if cell.text.strip()]
                if cells:
                    lines.append(" \t ".join(cells))
    return "\n".join(lines)


def extract_pdf_texts(path):
    texts = {}
    with pdfplumber.open(path) as pdf:
        texts["pdfplumber"] = "\n".join((page.extract_text() or "") for page in pdf.pages)
    with fitz.open(path) as doc:
        texts["fitz"] = "\n".join(page.get_text("text") for page in doc)
    reader = PdfReader(str(path))
    texts["pypdf"] = "\n".join((page.extract_text() or "") for page in reader.pages)
    return texts


def parse_subject(builder, subject, text):
    meta = builder.SUBJECT_META[subject]
    prefix = meta["prefix"]
    questions = []
    if prefix in {"ai", "ds"}:
        questions = builder.parse_pdf_questions(text, subject, prefix)
    elif prefix == "db":
        questions = builder.parse_database_doc(text, prefix)
        if "三、数据库设计题" in text:
            design_section = text.split("三、数据库设计题", 1)[1].split("四、综合应用题", 1)[0]
            questions.extend(builder.parse_reference_blocks(design_section, subject, "design", prefix, len(questions) + 1))
        questions.extend(builder.parse_database_application(text, prefix, len(questions) + 1))
    elif prefix == "os":
        questions.extend(builder.parse_os_single_choice(text, prefix, 1))
        questions.extend(builder.parse_fill_questions(text, subject, prefix, len(questions) + 1))
        tf_text = text.split("三、判断题", 1)[1] if "三、判断题" in text else text
        questions.extend(builder.parse_tf_parentheses(tf_text, subject, prefix, len(questions) + 1))
    elif prefix == "se":
        questions.extend(builder.parse_software_tf(text, prefix))
        questions.extend(builder.parse_software_single_choice(text, prefix, len(questions) + 1))
        questions.extend(builder.parse_software_multiple_choice(text, prefix, len(questions) + 1))
        questions.extend(builder.parse_fill_questions(text, subject, prefix, len(questions) + 1))
        questions.extend(builder.parse_software_subjective(text, prefix, len(questions) + 1))
    for index, question in enumerate(questions, 1):
        question["id"] = f"{prefix}-{index}"
    return questions


def choose_pdf_text(builder, subject, path):
    candidates = []
    for extractor, text in extract_pdf_texts(path).items():
        questions = parse_subject(builder, subject, text)
        markers = len(re.findall(r"题目\s*([0-9０-９]+)\s*[：:]", text))
        candidates.append({
            "extractor": extractor,
            "text": text,
            "questionCount": len(questions),
            "markerCount": markers,
            "typeCounts": type_counts(questions),
            "charCount": len(text),
        })
    candidates.sort(key=lambda item: (item["questionCount"], item["markerCount"], item["charCount"]), reverse=True)
    return candidates[0], candidates


def apply_supplemental(questions):
    if not SUPPLEMENTAL_ANSWERS.exists():
        return
    supplemental = json.loads(SUPPLEMENTAL_ANSWERS.read_text(encoding="utf-8"))
    for question in questions:
        patch = supplemental.get(question["id"])
        if not patch:
            continue
        question.update(patch)
        if "referenceAnswer" in patch:
            question["analysis"] = patch["referenceAnswer"]


def build_json_question(builder, question, subject):
    meta = builder.SUBJECT_META[subject]
    return builder.build_json_question(question, subject, meta)


def build_bank(builder, fresh_questions_by_subject):
    subjects = []
    questions = []
    for subject, meta in builder.SUBJECT_META.items():
        subject_questions = [build_json_question(builder, question, subject) for question in fresh_questions_by_subject[subject]]
        counts = Counter(question["type"] for question in subject_questions)
        subjects.append({
            "name": subject,
            "accent": meta["accent"],
            "description": meta["description"],
            "types": [
                {"type": question_type, "label": TYPE_LABELS[question_type], "count": counts[question_type]}
                for question_type in TYPE_ORDER
                if counts[question_type]
            ],
            "total": len(subject_questions),
        })
        questions.extend(subject_questions)
    return {
        "version": STANDARD_VERSION,
        "schema": "question-bank-json-v1",
        "subjects": subjects,
        "questions": questions,
    }


def attach_formula_option_images(bank, ai_pdf_path):
    target_questions = [q for q in bank["questions"] if q.get("subject") == "人工智能" and q.get("needsImageOptions")]
    if not target_questions:
        return []
    output_dir = ASSET_QUESTION_DIR / "ai"
    output_dir.mkdir(parents=True, exist_ok=True)
    generated = []
    with fitz.open(ai_pdf_path) as doc:
        for question in target_questions:
            number = int(question["id"].split("-", 1)[1])
            image_path = output_dir / f"{question['id']}.png"
            if render_question_crop(doc, number, image_path):
                rel = "./" + image_path.relative_to(ROOT).as_posix()
                question["questionImages"] = [rel]
                question["analysis"] = f"{question.get('analysis', '')} 选项为公式内容，已保留原 PDF 题目截图。".strip()
                generated.append({"questionId": question["id"], "image": rel})
            else:
                question["unscored"] = True
                question["analysis"] = f"{question.get('analysis', '')} 公式选项截图生成失败，需人工核对。".strip()
    return generated


def render_question_crop(doc, number, output_path):
    current_labels = [f"题目{number:03d}", f"题目{number}"]
    next_labels = [f"题目{number + 1:03d}", f"题目{number + 1}"]
    for page in doc:
        current_rects = []
        for label in current_labels:
            current_rects.extend(page.search_for(label))
        if not current_rects:
            continue
        start_y = max(0, min(rect.y0 for rect in current_rects) - 16)
        next_rects = []
        for label in next_labels:
            next_rects.extend(page.search_for(label))
        next_after = [rect for rect in next_rects if rect.y0 > start_y + 20]
        end_y = min(rect.y0 for rect in next_after) - 8 if next_after else min(page.rect.height, start_y + 210)
        if end_y <= start_y + 40:
            end_y = min(page.rect.height, start_y + 210)
        clip = fitz.Rect(0, start_y, page.rect.width, min(page.rect.height, end_y))
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False)
        pix.save(output_path)
        return True
    return False


def merge_with_existing(fresh_bank):
    if not APP_JSON.exists():
        return fresh_bank, []
    old_bank = json.loads(APP_JSON.read_text(encoding="utf-8"))
    fresh_by_id = {question["id"]: question for question in fresh_bank["questions"]}
    merged = []
    merge_notes = []
    for old in old_bank.get("questions", []):
        fresh = fresh_by_id.pop(old.get("id"), None)
        if not fresh:
            merged.append(old)
            merge_notes.append({"id": old.get("id"), "action": "kept_old_only", "reason": "fresh parser did not emit this id"})
            continue
        merged_question = {**old, **fresh}
        if is_better_question(fresh, old):
            merge_notes.append({"id": old.get("id"), "action": "replaced_with_fresh", "reason": "fresh parse is more complete"})
        merged.append(merged_question)
    for fresh in fresh_by_id.values():
        merged.append(fresh)
        merge_notes.append({"id": fresh.get("id"), "action": "added_from_fresh", "reason": "new question emitted by fresh parser"})
    fresh_bank["questions"] = merged
    fresh_bank["subjects"] = rebuild_subjects(fresh_bank)
    return fresh_bank, merge_notes


def is_better_question(fresh, old):
    fresh_score = len(fresh.get("question", "")) + sum(len(str(item)) for item in fresh.get("options", []))
    old_score = len(old.get("question", "")) + sum(len(str(item)) for item in old.get("options", []))
    if fresh.get("questionImages") and not old.get("questionImages"):
        fresh_score += 200
    if fresh.get("needsImageOptions") and malformed_choice_options(old):
        fresh_score += 200
    return fresh_score > old_score


def rebuild_subjects(bank):
    by_subject = defaultdict(list)
    meta_by_subject = {subject["name"]: subject for subject in bank.get("subjects", [])}
    for question in bank["questions"]:
        by_subject[question["subject"]].append(question)
    subjects = []
    for subject, questions in by_subject.items():
        counts = Counter(question["type"] for question in questions)
        meta = meta_by_subject.get(subject, {})
        subjects.append({
            "name": subject,
            "accent": meta.get("accent", "#2563eb"),
            "description": meta.get("description", ""),
            "types": [
                {"type": question_type, "label": TYPE_LABELS[question_type], "count": counts[question_type]}
                for question_type in TYPE_ORDER
                if counts[question_type]
            ],
            "total": len(questions),
        })
    return subjects


def dedupe_bank(bank):
    kept = []
    duplicates = []
    candidates = []
    by_group = defaultdict(list)
    for question in bank["questions"]:
        by_group[(question["subject"], question["type"])].append(question)
    for group_questions in by_group.values():
        group_kept = []
        for question in group_questions:
            exact_match = find_exact_duplicate(question, group_kept)
            if exact_match:
                preferred = prefer_complete(question, exact_match)
                removed = exact_match if preferred is question else question
                if preferred is question:
                    group_kept[group_kept.index(exact_match)] = question
                duplicates.append({
                    "keptId": preferred["id"],
                    "removedId": removed["id"],
                    "subject": preferred["subject"],
                    "type": preferred["type"],
                    "similarity": 1.0,
                    "reason": "full_signature_duplicate",
                })
                continue
            similar_match = find_similar_question(question, group_kept)
            if similar_match:
                candidates.append({
                    "leftId": question["id"],
                    "rightId": similar_match["id"],
                    "subject": question["subject"],
                    "type": question["type"],
                    "similarity": similarity(question["question"], similar_match["question"]),
                    "reason": "similar_question_not_removed",
                })
                group_kept.append(question)
            else:
                group_kept.append(question)
        kept.extend(group_kept)
    bank["questions"] = sorted(kept, key=lambda item: id_sort_key(item["id"]))
    bank["subjects"] = rebuild_subjects(bank)
    return duplicates, candidates


def find_exact_duplicate(question, candidates):
    signature = full_signature(question)
    for candidate in candidates:
        if signature == full_signature(candidate):
            return candidate
    return None


def find_similar_question(question, candidates):
    normalized = normalize_question(question["question"])
    if len(normalized) < 10:
        return None
    for candidate in candidates:
        if similarity(question["question"], candidate["question"]) >= 0.96:
            return candidate
    return None


def full_signature(question):
    return json.dumps({
        "subject": question.get("subject"),
        "type": question.get("type"),
        "question": normalize_question(question.get("question", "")),
        "options": [normalize_question(option) for option in question.get("options", [])],
        "answer": normalize_question(question.get("answer", "")),
        "analysis": normalize_question(question.get("analysis", "")),
        "questionImages": question.get("questionImages", []),
        "referenceImages": question.get("referenceImages", []),
    }, ensure_ascii=False, sort_keys=True)


def prefer_complete(left, right):
    left_score = len(left.get("question", "")) + len(json.dumps(left.get("options", []), ensure_ascii=False))
    right_score = len(right.get("question", "")) + len(json.dumps(right.get("options", []), ensure_ascii=False))
    if left.get("questionImages"):
        left_score += 200
    if right.get("questionImages"):
        right_score += 200
    return left if left_score >= right_score else right


def normalize_question(text):
    return re.sub(r"[\s，。,.、；;：:（）()《》<>【】\[\]{}“”\"'!?！？_-]+", "", str(text or "")).lower()


def similarity(left, right):
    return difflib.SequenceMatcher(None, normalize_question(left), normalize_question(right)).ratio()


def id_sort_key(question_id):
    prefix, _, raw_number = str(question_id).partition("-")
    return prefix, int(raw_number) if raw_number.isdigit() else raw_number


def malformed_choice_options(question):
    if question.get("type") not in {"single", "multiple"}:
        return False
    options = question.get("options") or []
    if len(options) < 4:
        return True
    return any(re.fullmatch(r"[A-F][.．]?", str(option).strip()) or not str(option).strip() for option in options)


def type_counts(questions):
    return dict(Counter(question["type"] for question in questions))


def normalized_type_counts(questions, builder):
    return dict(Counter(builder.normalize_question_type(question["type"]) for question in questions))


def find_subject_file(subject):
    filename = SOURCE_FILES[subject]
    path = SOURCE_DIR / filename
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def write_compat_js(bank):
    by_subject = {subject["name"]: {**subject, "questions": []} for subject in bank["subjects"]}
    for question in bank["questions"]:
        by_subject[question["subject"]]["questions"].append(question)
    question_bank = []
    for subject in bank["subjects"]:
        block = by_subject[subject["name"]]
        question_bank.append({
            "subject": block["name"],
            "accent": block["accent"],
            "description": block["description"],
            "questions": block["questions"],
        })
    js = "window.QuestionData = (() => {\n"
    js += "const questionBank = "
    js += json.dumps(question_bank, ensure_ascii=False, indent=2)
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
    SRC_COMPAT_JS.parent.mkdir(parents=True, exist_ok=True)
    SRC_COMPAT_JS.write_text(js, encoding="utf-8")


def make_report(builder, extraction_report, raw_counts, system_counts, malformed_before, malformed_after, duplicates, duplicate_candidates, merge_notes, generated_images):
    duplicate_count_by_subject_type = Counter((item["subject"], item["type"]) for item in duplicates)
    subjects = []
    for subject in builder.SUBJECT_META:
        raw = raw_counts[subject]
        system = system_counts[subject]
        rows = []
        for question_type in TYPE_ORDER:
            raw_count = raw.get(question_type, 0)
            system_count = system.get(question_type, 0)
            duplicate_count = duplicate_count_by_subject_type[(subject, question_type)]
            difference = system_count - raw_count
            if difference == 0:
                reason = "一致"
            elif difference < 0 and abs(difference) == duplicate_count:
                reason = f"原文存在 {duplicate_count} 道完全重复题，已按规则去重"
            else:
                reason = "需查看解析规则或源文件公式/图片内容"
            rows.append({
                "type": question_type,
                "label": TYPE_LABELS[question_type],
                "rawCount": raw_count,
                "systemCount": system_count,
                "difference": difference,
                "reason": reason,
            })
        subjects.append({
            "subject": subject,
            "rows": rows,
            "rawTotal": sum(raw.values()),
            "systemTotal": sum(system.values()),
        })
    report = {
        "version": STANDARD_VERSION,
        "sourceDirectory": str(SOURCE_DIR),
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "extraction": extraction_report,
        "subjects": subjects,
        "malformedChoiceOptionsBefore": malformed_before,
        "malformedChoiceOptionsAfter": malformed_after,
        "duplicatesRemoved": duplicates,
        "duplicateCandidates": duplicate_candidates,
        "mergeNotes": merge_notes,
        "generatedImages": generated_images,
        "formulaOptionFixes": len(generated_images),
    }
    return report


def write_markdown_report(report):
    lines = [
        "# 题库全量数据审计与补全报告",
        "",
        f"- 版本：{report['version']}",
        f"- 源目录：`{report['sourceDirectory']}`",
        f"- 生成时间：{report['generatedAt']}",
        "",
        "## 结论",
        "",
        f"- 残缺选择题修复前：{len(report['malformedChoiceOptionsBefore'])} 道",
        f"- 残缺选择题修复后：{len(report['malformedChoiceOptionsAfter'])} 道",
        f"- 去重移除：{len(report['duplicatesRemoved'])} 道",
        f"- 疑似相似题保留并列入报告：{len(report['duplicateCandidates'])} 组",
        f"- 公式选项题修复：{report['formulaOptionFixes']} 道",
        f"- 公式选项截图生成：{len(report['generatedImages'])} 张",
        "",
        "## 分科目完整性校验",
        "",
    ]
    for subject in report["subjects"]:
        lines.extend([
            f"### {subject['subject']}",
            "",
            "| 题型 | 原始数量 | 系统识别数量 | 差异 | 原因分析 |",
            "| --- | ---: | ---: | ---: | --- |",
        ])
        for row in subject["rows"]:
            lines.append(f"| {row['label']} | {row['rawCount']} | {row['systemCount']} | {row['difference']} | {row['reason']} |")
        lines.extend(["", f"- 原始合计：{subject['rawTotal']}", f"- 系统合计：{subject['systemTotal']}", ""])
    lines.extend([
        "## 抽取器选择",
        "",
    ])
    for item in report["extraction"]:
        lines.append(f"- {item['subject']}：`{item['sourceFile']}`，使用 `{item['chosenExtractor']}`，识别 {item['chosenQuestionCount']} 道。")
    if report["malformedChoiceOptionsBefore"]:
        lines.extend(["", "## 已修复残缺选择题", ""])
        for item in report["malformedChoiceOptionsBefore"]:
            lines.append(f"- {item['id']} {item['subject']}：{item['question']}")
    if report["duplicatesRemoved"]:
        lines.extend(["", "## 重复题处理", ""])
        for item in report["duplicatesRemoved"]:
            lines.append(f"- 保留 {item['keptId']}，移除 {item['removedId']}，相似度 {item['similarity']:.3f}")
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")


def main():
    builder = load_builder()
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_TEXT_DIR.mkdir(parents=True, exist_ok=True)

    fresh_questions_by_subject = {}
    extraction_report = []
    raw_counts = {}
    ai_pdf_path = None

    for subject in builder.SUBJECT_META:
        path = find_subject_file(subject)
        if path.suffix.lower() == ".pdf":
            chosen, candidates = choose_pdf_text(builder, subject, path)
            text = chosen["text"]
            chosen_extractor = chosen["extractor"]
            if builder.SUBJECT_META[subject]["prefix"] == "ai":
                ai_pdf_path = path
        else:
            text = extract_docx_text(path)
            chosen_extractor = "python-docx"
            candidates = [{
                "extractor": chosen_extractor,
                "questionCount": len(parse_subject(builder, subject, text)),
                "markerCount": 0,
                "typeCounts": {},
                "charCount": len(text),
            }]
        SOURCE_TEXT_DIR.joinpath(f"{subject}.txt").write_text(text, encoding="utf-8")
        questions = parse_subject(builder, subject, text)
        apply_supplemental(questions)
        fresh_questions_by_subject[subject] = questions
        raw_counts[subject] = normalized_type_counts(questions, builder)
        extraction_report.append({
            "subject": subject,
            "sourceFile": str(path),
            "chosenExtractor": chosen_extractor,
            "chosenQuestionCount": len(questions),
            "candidateDiagnostics": [
                {key: value for key, value in candidate.items() if key != "text"}
                for candidate in candidates
            ],
            "freshTextFile": str(SOURCE_TEXT_DIR.joinpath(f"{subject}.txt")),
        })

    fresh_bank = build_bank(builder, fresh_questions_by_subject)
    malformed_before = [
        {
            "id": question["id"],
            "subject": question["subject"],
            "type": question["type"],
            "question": question["question"],
            "options": question.get("options", []),
        }
        for question in json.loads(APP_JSON.read_text(encoding="utf-8")).get("questions", [])
        if malformed_choice_options(question)
    ] if APP_JSON.exists() else []

    if ai_pdf_path:
        generated_images = attach_formula_option_images(fresh_bank, ai_pdf_path)
    else:
        generated_images = []

    merged_bank, merge_notes = merge_with_existing(fresh_bank)
    RAW_MERGED_JSON.write_text(json.dumps(merged_bank, ensure_ascii=False, indent=2), encoding="utf-8")
    duplicates, duplicate_candidates = dedupe_bank(merged_bank)
    merged_bank["version"] = STANDARD_VERSION
    system_counts = {
        subject["name"]: {
            item["type"]: item["count"]
            for item in subject["types"]
        }
        for subject in merged_bank["subjects"]
    }
    malformed_after = [
        {
            "id": question["id"],
            "subject": question["subject"],
            "type": question["type"],
            "question": question["question"],
            "options": question.get("options", []),
        }
        for question in merged_bank["questions"]
        if malformed_choice_options(question)
    ]

    report = make_report(
        builder,
        extraction_report,
        raw_counts,
        system_counts,
        malformed_before,
        malformed_after,
        duplicates,
        duplicate_candidates,
        merge_notes,
        generated_images,
    )

    STATS_JSON.write_text(json.dumps(system_counts, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown_report(report)
    MERGED_JSON.write_text(json.dumps(merged_bank, ensure_ascii=False, indent=2), encoding="utf-8")
    STANDARD_JSON.write_text(json.dumps(merged_bank, ensure_ascii=False, indent=2), encoding="utf-8")
    APP_JSON.write_text(json.dumps(merged_bank, ensure_ascii=False, indent=2), encoding="utf-8")
    write_compat_js(merged_bank)

    print(json.dumps({
        "version": STANDARD_VERSION,
        "total": len(merged_bank["questions"]),
        "stats": system_counts,
        "malformedBefore": len(malformed_before),
        "malformedAfter": len(malformed_after),
        "duplicatesRemoved": len(duplicates),
        "duplicateCandidates": len(duplicate_candidates),
        "generatedImages": len(generated_images),
        "report": str(REPORT_MD),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
