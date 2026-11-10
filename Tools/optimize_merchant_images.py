#!/usr/bin/env python3
"""Opt-in packaging optimization. Originals, dimensions, alpha and native icons stay intact.
WebView sniffs WebP bytes at the original asset URL (including .png suffix), so
saved inventory URLs and dynamically constructed paths need no fragile rewriting.
Only portrait/product PNGs under assets/merchants are eligible.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

POLICY = {'qualities': [92, 95, 98], 'minPSNR': 40.0, 'minBlockSSIM': 0.99,
          'resize': False, 'version': 1}


def metrics(original, decoded):
    a = np.asarray(original.convert('RGB'), dtype=np.float32)
    b = np.asarray(decoded.convert('RGB'), dtype=np.float32)
    mse = float(np.mean((a-b)**2))
    psnr = 99.0 if mse == 0 else 10*math.log10(255**2/mse)
    # Structural similarity averaged over non-overlapping 8x8 blocks/channels.
    h, w = a.shape[:2]
    def blocks(x):
        return x[:h//8*8, :w//8*8].reshape(h//8,8,w//8,8,3).transpose(0,2,4,1,3).reshape(-1,64)
    if h < 8 or w < 8:
        return psnr, 1.0 if mse == 0 else 0.0
    x,y=blocks(a),blocks(b)
    mx,my=x.mean(1),y.mean(1)
    vx,vy=x.var(1),y.var(1)
    cov=((x-mx[:,None])*(y-my[:,None])).mean(1)
    ssim=((2*mx*my+6.5025)*(2*cov+58.5225))/((mx**2+my**2+6.5025)*(vx+vy+58.5225))
    return psnr, float(ssim.mean())


def optimize_image(path, cache):
    source = path.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    key = hashlib.sha256((digest+json.dumps(POLICY,sort_keys=True)).encode()).hexdigest()
    cache.mkdir(parents=True, exist_ok=True)
    metadata, encoded = cache/(key+'.json'), cache/(key+'.webp')
    if metadata.exists() and encoded.exists():
        report=json.loads(metadata.read_text());data=encoded.read_bytes()
        if hashlib.sha256(data).hexdigest()==report['outputSha256']:
            return data, report
    with Image.open(io.BytesIO(source)) as image:
        image.load()
        # Profiles/animation require separate color-management handling: leave untouched.
        if image.info.get('icc_profile') or getattr(image,'n_frames',1)>1:
            return source, {'sourceSha256':digest,'sourceBytes':len(source),'outputBytes':len(source),'format':'original','reason':'profile/animation preserved'}
        original=image.convert('RGBA' if 'A' in image.getbands() or 'transparency' in image.info else 'RGB')
    selected=source;quality='original';score=(99.0,1.0)
    for q in [*POLICY['qualities'], 'lossless']:
        buffer=io.BytesIO()
        original.save(buffer,format='WEBP',quality=100 if q=='lossless' else q,lossless=q=='lossless',method=6,exact=True)
        data=buffer.getvalue()
        with Image.open(io.BytesIO(data)) as candidate:
            candidate.load()
            assert candidate.size==original.size
            if original.mode=='RGBA' and not np.array_equal(np.asarray(original.getchannel('A')),np.asarray(candidate.convert('RGBA').getchannel('A'))):
                continue
            measured=metrics(original,candidate)
        if measured[0]>=POLICY['minPSNR'] and measured[1]>=POLICY['minBlockSSIM']:
            if len(data)<len(source): selected,quality,score=data,q,measured
            break
    report={'sourceSha256':digest,'outputSha256':hashlib.sha256(selected).hexdigest(),
            'sourceBytes':len(source),'outputBytes':len(selected),'width':original.width,'height':original.height,
            'format':'original' if quality=='original' else 'WebP','quality':quality,
            'PSNR':round(score[0],4),'blockSSIM':round(score[1],6),'dimensionsUnchanged':True,'alphaUnchanged':True}
    encoded.write_bytes(selected);metadata.write_text(json.dumps(report,indent=2)+'\n')
    return selected,report


def optimize_assets(preview, cache):
    results={}
    for path in sorted((preview/'assets/merchants').rglob('*.png')):
        data,report=optimize_image(path,cache)
        results[path.relative_to(preview).as_posix()] = (data,report)
    return results


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview',type=Path,default=Path(__file__).resolve().parents[1]/'unity_preview')
    parser.add_argument('--cache',type=Path,default=Path('build/optimized-images'))
    parser.add_argument('--report',type=Path,default=Path('artifacts/quality/merchant-image-optimization.json'))
    args=parser.parse_args()
    results=optimize_assets(args.preview,args.cache)
    before=sum(r['sourceBytes'] for _,r in results.values());after=sum(r['outputBytes'] for _,r in results.values())
    report={'policy':POLICY,'images':{k:r for k,(_,r) in results.items()},'sourceBytes':before,'optimizedBytes':after,'savedPercent':round(100*(1-after/before),2)}
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='images'},indent=2))

if __name__=='__main__':main()
