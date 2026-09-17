#!/usr/bin/env python3
"""
为新风格生成真实缩略图（gpt-image-2.5-flare，DMX 渠道）并更新风格库：
1. 对 12 个新风格逐个调用 DMX /v1/images/generations（密钥从本机设置读取，绝不打印）；
2. 图片落盘到仓库种子与用户目录两份风格库的 live-action/ 下；
3. 两份 index.json 更新 thumbnail 字段，并把 12 个新风格移到 styles 数组最前。

幂等：已存在非复用缩略图（thumbnail 以新文件名存在且文件在）的风格跳过生成。
"""
import base64
import json
import os
import sys
import time
import urllib.request

NEW_IDS = [
    'live-action-毕赣乡土诗意', 'live-action-李安克制戏剧', 'live-action-李沧东冷峻郊野',
    'live-action-武侠格栅窗光', 'live-action-秦汉军阵史诗', 'live-action-中世纪骑士群像',
    'live-action-军事科幻废土', 'live-action-哥特烛光教堂', 'live-action-雨夜泪光肖像',
    'live-action-水城 noir 剪影', 'live-action-古装烛光侧脸', 'live-action-山区上学路',
]

REPO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'aigc-memory', 'style-library')
USER = os.path.expanduser('~/.kunpeng/aigc-memory/style-library')

settings = json.load(open(os.path.expanduser('~/.kunpeng/settings.json')))
state = settings.get('state', settings)
slot = next((s for s in (state.get('imageApiSlots') or []) if s.get('provider') == 'dmxapi'), None)
if not slot or not slot.get('apiKey'):
    print('未找到 DMX 槽位或密钥', file=sys.stderr)
    sys.exit(1)
BASE = slot['baseUrl'].rstrip('/')
KEY = slot['apiKey']


def generate(prompt: str) -> bytes:
    body = json.dumps({
        'model': 'gpt-image-2.5-flare', 'prompt': prompt, 'n': 1,
        'size': '1536x1024', 'quality': 'high',
    }).encode()
    req = urllib.request.Request(f'{BASE}/v1/images/generations', data=body, method='POST', headers={
        'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.load(resp)
    item = (data.get('data') or [{}])[0]
    if item.get('b64_json'):
        return base64.b64decode(item['b64_json'])
    if item.get('url'):
        with urllib.request.urlopen(item['url'], timeout=120) as img:
            return img.read()
    raise RuntimeError(f'响应无图片: {json.dumps(data)[:200]}')


def main() -> int:
    idx = json.load(open(os.path.join(REPO, 'index.json')))
    styles = {s['id']: s for s in idx['styles']}
    failed = []
    for sid in NEW_IDS:
        style = styles.get(sid)
        if not style:
            print(f'[skip] {sid} 不在库中')
            continue
        name = style['name']
        target_rel = f'live-action/{name}.jpg'
        target_repo = os.path.join(REPO, target_rel)
        target_user = os.path.join(USER, target_rel)
        if style.get('thumbnail') == target_rel and os.path.exists(target_repo) and os.path.getsize(target_repo) > 30000:
            print(f'[skip] {name} 已有真实缩略图')
            continue
        print(f'[gen] {name} ...', flush=True)
        try:
            img = generate(style['promptTemplate'])
        except Exception as e:
            time.sleep(5)
            try:
                img = generate(style['promptTemplate'])
            except Exception as e2:
                print(f'[fail] {name}: {e2}')
                failed.append(name)
                continue
        for target in (target_repo, target_user):
            with open(target, 'wb') as f:
                f.write(img)
        style['thumbnail'] = target_rel
        print(f'[ok] {name} ({len(img) // 1024}KB)')
        time.sleep(2)
    # 两份 index.json：更新 thumbnail + 新风格置顶
    for base in (REPO, USER):
        path = os.path.join(base, 'index.json')
        data = json.load(open(path))
        for s in data['styles']:
            if s['id'] in NEW_IDS:
                s['thumbnail'] = styles[s['id']]['thumbnail']
        new = [s for s in data['styles'] if s['id'] in NEW_IDS]
        rest = [s for s in data['styles'] if s['id'] not in NEW_IDS]
        data['styles'] = new + rest
        json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(f'完成。失败 {len(failed)}: {failed}' if failed else '完成，全部成功。新风格已置顶。')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
