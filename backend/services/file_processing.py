import re
import math
import sys
import traceback

CHAPTER_TITLE_MAX_LENGTH = 30
MIN_CHAPTER_LENGTH = 3000
MAX_CHAPTER_LENGTH = 10000

def _is_native_title(line):
    line = line.strip()
    if not line.startswith('第'):
        return False
    
    match_char = re.search(r'[章回幕节]', line)
    if not match_char:
        return False
        
    start_index = line.find('第')
    end_index = match_char.start()

    substring = line[start_index:end_index]
    
    exclusion_chars = ['天', '日', '篇', '场', '局']
    if any(char in substring for char in exclusion_chars):
        return False
        
    return True

def process_novel_content(content):
    try:
        if not isinstance(content, str):
            raise TypeError("Input must be a string.")

        normalized_content = content.replace('\r\n', '\n').replace('\r', '\n').strip()
        lines = normalized_content.split('\n')

        raw_chapters = []
        current_chapter_lines = []
        current_title = "前言"

        if lines:
            first_line_is_title = _is_native_title(lines[0])
            if not first_line_is_title:
                pass
            else:
                current_title = lines[0].strip()
                lines = lines[1:]

            for line in lines:
                if _is_native_title(line):
                    if current_chapter_lines:
                        raw_chapters.append({
                            'title': current_title,
                            'content': '\n'.join(current_chapter_lines).strip()
                        })
                    current_title = line.strip()
                    current_chapter_lines = []
                else:
                    current_chapter_lines.append(line)
            
            if current_chapter_lines or not raw_chapters:
                 raw_chapters.append({
                    'title': current_title,
                    'content': '\n'.join(current_chapter_lines).strip()
                })

        merged_chapters = []
        if not raw_chapters:
            return []

        buffer = {'title': '', 'content': ''}
        
        for i, chapter in enumerate(raw_chapters):
            if not buffer['title']:
                buffer['title'] = chapter['title']
                buffer['content'] = chapter['content']
            elif len(buffer['content']) < MIN_CHAPTER_LENGTH and (len(buffer['content']) + len(chapter['content'])) <= MAX_CHAPTER_LENGTH:
                buffer['content'] += f"\n\n(原：{chapter['title']})\n\n{chapter['content']}"
            else:
                merged_chapters.append(buffer)
                buffer = {'title': chapter['title'], 'content': chapter['content']}

        if buffer['content']:
            merged_chapters.append(buffer)
        
        final_toc_entries = []
        for chapter in merged_chapters:
            content = chapter['content']
            if len(content) <= MAX_CHAPTER_LENGTH:
                final_toc_entries.append(chapter)
            else:
                num_sub_chapters = math.ceil(len(content) / MAX_CHAPTER_LENGTH)
                
                split_points = []
                last_split = 0
                for i in range(1, num_sub_chapters):
                    target_split = int(len(content) * (i / num_sub_chapters))
                    
                    split_pos = content.rfind('\n', last_split, target_split)
                    if split_pos == -1 or split_pos <= last_split:
                        split_pos = content.find('\n', target_split)

                    if split_pos != -1:
                        split_points.append(split_pos)
                        last_split = split_pos
                    else:
                        split_points.append(target_split)
                        last_split = target_split
                
                start = 0
                for i, end in enumerate(split_points + [len(content)]):
                    sub_content = content[start:end].strip()
                    if sub_content:
                        final_toc_entries.append({
                            'title': f"({i + 1}) {chapter['title']}",
                            'content': sub_content
                        })
                    start = end

        return final_toc_entries
        
    except Exception as e:
        print(f"Error in process_novel_content (service): {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise


def filter_chapters_by_keywords(chapters, keywords):
    if not keywords:
        return chapters

    matched_indices = set()
    for i, chapter in enumerate(chapters):
        title = chapter.get('title', '')
        content = chapter.get('content', '')
        for keyword in keywords:
            if keyword in title or keyword in content:
                matched_indices.add(i)
                break

    if not matched_indices:
        return []

    sorted_indices = sorted(list(matched_indices))
    
    return [chapters[i] for i in sorted_indices]