#!/usr/bin/env python3
import csv
import json
import os
import sys
from collections import defaultdict

import cv2
import numpy as np

def pct(vals, p):
    if not vals:
        return 0.0
    return float(np.percentile(np.array(vals, dtype=np.float64), p))

def mean(vals):
    return float(np.mean(np.array(vals, dtype=np.float64))) if vals else 0.0

def load_scenes(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    scenes = data.get('scenes', [])
    scenes.sort(key=lambda s: s.get('startFrame', 0))
    return scenes

def scene_for_frame(frame_idx, scenes, cursor):
    while cursor < len(scenes) and frame_idx >= scenes[cursor].get('endFrame', 0):
        cursor += 1
    if cursor >= len(scenes):
        return None, cursor
    s = scenes[cursor]
    if frame_idx < s.get('startFrame', 0):
        return None, cursor
    return s, cursor

def main():
    if len(sys.argv) < 4:
        print('Usage: audit_render_preview.py <video> <timeline> <outdir>')
        sys.exit(1)

    video = sys.argv[1]
    timeline = sys.argv[2]
    outdir = sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    os.makedirs(os.path.join(outdir, 'flagged-frames'), exist_ok=True)

    scenes = load_scenes(timeline)

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise RuntimeError('Cannot open video: ' + video)

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = frame_count / fps if fps > 0 else 0

    rows = []
    mvals = []
    lvals = []
    cvals = []
    yvals = []

    scene_stats = defaultdict(lambda: {'frames':0, 'motion':[], 'lap':[], 'contrast':[], 'cuts':0, 'dark':0})

    prev = None
    cursor = 0

    for i in range(frame_count):
        ok, frame = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        lum = float(np.mean(gray))
        con = float(np.std(gray))
        sat = float(np.mean(hsv[:, :, 1]))
        lap = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        edge = float(np.mean(cv2.Canny(gray, 100, 200) > 0))
        dark = float(np.mean(gray < 20))
        high = float(np.mean(gray > 240))
        mot = 0.0 if prev is None else float(np.mean(cv2.absdiff(gray, prev)))
        prev = gray

        scene, cursor = scene_for_frame(i, scenes, cursor)
        sid = scene.get('id') if scene else ''
        stype = scene.get('type') if scene else ''
        vsrc = scene.get('visualSource') if scene else ''
        skind = ((scene.get('sourceMetadata') or {}).get('sourceKind')) if scene else ''

        row = {
            'frame': i,
            'timeSec': round(i / fps, 3),
            'sceneId': sid,
            'sceneType': stype,
            'visualSource': vsrc,
            'sourceKind': skind,
            'lumaMean': round(lum, 4),
            'lumaStd': round(con, 4),
            'satMean': round(sat, 4),
            'lapVar': round(lap, 4),
            'edgeDensity': round(edge, 6),
            'motionDiff': round(mot, 4),
            'darkRatio': round(dark, 6),
            'highlightRatio': round(high, 6),
        }
        rows.append(row)

        mvals.append(mot)
        lvals.append(lap)
        cvals.append(con)
        yvals.append(lum)

        if sid:
            ss = scene_stats[sid]
            ss['frames'] += 1
            ss['motion'].append(mot)
            ss['lap'].append(lap)
            ss['contrast'].append(con)

    cap.release()

    cut_threshold = 18.0
    low_m = max(0.8, pct(mvals, 10) * 0.8)
    low_l = pct(lvals, 15)
    low_c = pct(cvals, 10)

    cuts = []
    low_sharp = []
    low_con = []
    dark_frames = []

    freeze_runs = []
    run_start = None
    run_len = 0

    for r in rows:
        f = int(r['frame'])
        mot = float(r['motionDiff'])
        lap = float(r['lapVar'])
        con = float(r['lumaStd'])
        lum = float(r['lumaMean'])
        sid = r['sceneId']

        if mot >= cut_threshold:
            cuts.append(f)
            if sid in scene_stats:
                scene_stats[sid]['cuts'] += 1
        if lap <= low_l:
            low_sharp.append(f)
        if con <= low_c:
            low_con.append(f)
        if lum < 35:
            dark_frames.append(f)
            if sid in scene_stats:
                scene_stats[sid]['dark'] += 1

        if mot <= low_m:
            if run_start is None:
                run_start = f
                run_len = 1
            else:
                run_len += 1
        else:
            if run_start is not None and run_len >= int(fps * 0.6):
                freeze_runs.append({'startFrame': run_start, 'endFrame': f - 1, 'lengthFrames': run_len})
            run_start = None
            run_len = 0

    if run_start is not None and run_len >= int(fps * 0.6):
        freeze_runs.append({'startFrame': run_start, 'endFrame': run_start + run_len - 1, 'lengthFrames': run_len})

    def cut_rate(a, b):
        sa = int(a * fps)
        sb = int(b * fps)
        n = sum(1 for f in cuts if sa <= f < sb)
        mins = max((b - a) / 60.0, 1e-9)
        return n / mins, n

    overall_rate = len(cuts) / max(duration_sec / 60.0, 1e-9)
    hook_rate, hook_c = cut_rate(0, min(15, duration_sec))
    expo_end = min(45, duration_sec)
    expo_rate, expo_c = cut_rate(15, expo_end) if expo_end > 15 else (0.0, 0)

    scene_lookup = {s.get('id'): s for s in scenes}
    scene_rows = []
    for sid, ss in scene_stats.items():
        fr = ss['frames'] if ss['frames'] else 1
        scene_rows.append({
            'sceneId': sid,
            'sceneType': scene_lookup.get(sid, {}).get('type', ''),
            'visualSource': scene_lookup.get(sid, {}).get('visualSource', ''),
            'sourceKind': (scene_lookup.get(sid, {}).get('sourceMetadata') or {}).get('sourceKind', ''),
            'frames': fr,
            'avgMotionDiff': round(mean(ss['motion']), 4),
            'avgLapVar': round(mean(ss['lap']), 4),
            'avgLumaStd': round(mean(ss['contrast']), 4),
            'cuts': ss['cuts'],
            'darkFrameRatio': round(ss['dark'] / fr, 4),
        })

    scene_rows.sort(key=lambda x: (x['avgMotionDiff'], x['avgLapVar']))

    frame_csv = os.path.join(outdir, 'frame_metrics.csv')
    with open(frame_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    scene_csv = os.path.join(outdir, 'scene_metrics.csv')
    with open(scene_csv, 'w', newline='', encoding='utf-8') as f:
        fields = list(scene_rows[0].keys()) if scene_rows else ['sceneId']
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        if scene_rows:
            w.writerows(scene_rows)

    # Thumbnails for flagged frames
    flagset = sorted(set(low_sharp[:12] + low_con[:12] + dark_frames[:12]))[:30]
    cap2 = cv2.VideoCapture(video)
    if cap2.isOpened():
        for ff in flagset:
            cap2.set(cv2.CAP_PROP_POS_FRAMES, ff)
            ok, fr = cap2.read()
            if not ok:
                continue
            thumb = cv2.resize(fr, (640, 360), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(outdir, 'flagged-frames', 'frame-%04d.jpg' % ff), thumb)
        cap2.release()

    issues = {
        'video': {'path': video, 'fps': round(fps,3), 'frameCount': frame_count, 'durationSec': round(duration_sec,3)},
        'cadence': {
            'cutThresholdMotionDiff': cut_threshold,
            'overallCutRatePerMin': round(overall_rate,2),
            'hookCutRatePerMin_0_15s': round(hook_rate,2),
            'hookCutCount': hook_c,
            'expositionCutRatePerMin_15_45s': round(expo_rate,2),
            'expositionCutCount': expo_c,
            'benchmarkTargets': {'hookCutsPerMin': '35-60', 'expositionCutsPerMin': '18-30'}
        },
        'distributions': {
            'motionDiff': {'mean': round(mean(mvals),4), 'p10': round(pct(mvals,10),4), 'p50': round(pct(mvals,50),4), 'p90': round(pct(mvals,90),4)},
            'lapVar': {'mean': round(mean(lvals),4), 'p15': round(pct(lvals,15),4), 'p50': round(pct(lvals,50),4)},
            'lumaStd': {'mean': round(mean(cvals),4), 'p10': round(pct(cvals,10),4), 'p50': round(pct(cvals,50),4)},
            'lumaMean': {'mean': round(mean(yvals),4), 'p10': round(pct(yvals,10),4), 'p90': round(pct(yvals,90),4)}
        },
        'flags': {
            'lowSharpnessFrameCount': len(low_sharp),
            'lowContrastFrameCount': len(low_con),
            'darkFrameCount': len(dark_frames),
            'freezeRunCount': len(freeze_runs),
            'freezeRuns': freeze_runs[:40]
        },
        'worstScenes': scene_rows[:10]
    }

    issues_json = os.path.join(outdir, 'issues_summary.json')
    with open(issues_json, 'w', encoding='utf-8') as f:
        json.dump(issues, f, indent=2)

    hook_state = 'PASS' if 35 <= hook_rate <= 60 else ('BELOW TARGET' if hook_rate < 35 else 'ABOVE TARGET')
    expo_state = 'PASS' if 18 <= expo_rate <= 30 else ('BELOW TARGET' if expo_rate < 18 else 'ABOVE TARGET')

    md = os.path.join(outdir, 'VIDEO_QUALITY_AUDIT.md')
    with open(md, 'w', encoding='utf-8') as f:
        f.write('# Video Quality Audit (Every Frame)\n\n')
        f.write('- Video: {}\n'.format(video))
        f.write('- Timeline: {}\n'.format(timeline))
        f.write('- FPS: {:.2f}\n'.format(fps))
        f.write('- Frames analyzed: {}\n'.format(frame_count))
        f.write('- Duration: {:.2f}s\n\n'.format(duration_sec))
        f.write('## Cadence vs benchmark\n')
        f.write('- Overall cut rate: {:.2f}/min\n'.format(overall_rate))
        f.write('- Hook 0-15s: {:.2f}/min -> {} (target 35-60)\n'.format(hook_rate, hook_state))
        f.write('- Exposition 15-45s: {:.2f}/min -> {} (target 18-30)\n\n'.format(expo_rate, expo_state))
        f.write('## Frame-level quality flags\n')
        f.write('- Low sharpness frames: {} ({:.1f}%)\n'.format(len(low_sharp), len(low_sharp)*100.0/max(frame_count,1)))
        f.write('- Low contrast frames: {} ({:.1f}%)\n'.format(len(low_con), len(low_con)*100.0/max(frame_count,1)))
        f.write('- Dark frames: {} ({:.1f}%)\n'.format(len(dark_frames), len(dark_frames)*100.0/max(frame_count,1)))
        f.write('- Freeze runs >=0.6s: {}\n\n'.format(len(freeze_runs)))
        f.write('## Lowest performing scenes\n')
        for s in scene_rows[:10]:
            f.write('- {} | {} | {} | motion {:.2f} | sharpness {:.1f} | contrast {:.1f} | cuts {}\n'.format(
                s['sceneId'], s['sceneType'], s['visualSource'], s['avgMotionDiff'], s['avgLapVar'], s['avgLumaStd'], s['cuts']
            ))
        f.write('\n## Artifacts\n')
        f.write('- frame_metrics.csv\n- scene_metrics.csv\n- issues_summary.json\n- flagged-frames/\n')

    print(json.dumps({
        'reportMd': md,
        'issuesJson': issues_json,
        'frameCsv': frame_csv,
        'sceneCsv': scene_csv,
        'flaggedFramesDir': os.path.join(outdir, 'flagged-frames'),
        'hookRate': round(hook_rate,2),
        'expoRate': round(expo_rate,2),
        'overallRate': round(overall_rate,2),
        'frameCount': frame_count
    }, indent=2))

if __name__ == '__main__':
    main()
