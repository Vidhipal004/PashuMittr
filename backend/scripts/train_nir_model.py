"""Rebuild the JSON NIR screening model from the supplied XLSX dataset.

Usage:
  python scripts/train_nir_model.py \
    --xlsx ../../Dataset\ NIR\ Spectrum\ of\ Animal\ Feed.xlsx \
    --out data

Runtime does not require Python; the Node API loads data/nir_model.json.
"""
import argparse, json, os, zipfile, xml.etree.ElementTree as ET
import numpy as np
from sklearn.cross_decomposition import PLSRegression

NS = {"a":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def colnum(cell):
    s=''.join(ch for ch in cell if ch.isalpha())
    n=0
    for ch in s:
        n=n*26+ord(ch.upper())-64
    return n

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--xlsx',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--step',type=int,default=5)
    args=ap.parse_args()
    os.makedirs(args.out,exist_ok=True)
    with zipfile.ZipFile(args.xlsx) as z:
        root=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows=root.findall('.//a:sheetData/a:row',NS)
        rowmap={r.attrib['r']:r for r in rows}
        hdr=rowmap['4']
        spec=[]
        for c in hdr.findall('a:c',NS):
            r=c.attrib['r']; v=c.find('a:v',NS)
            if r!='A4' and v is not None and colnum(r)<colnum('BGY4'):
                spec.append((colnum(r), ''.join(ch for ch in r if ch.isalpha()), float(v.text)))
        spec=sorted(spec)
        X=[];Y=[];ids=[]
        for rn in map(str,range(5,30)):
            row=rowmap[rn]; d={}
            for c in row.findall('a:c',NS):
                v=c.find('a:v',NS)
                if v is not None:d[c.attrib['r']]=v.text
            ids.append(int(float(d[f'A{rn}'])))
            X.append([float(d[f'{col}{rn}']) for _,col,_ in spec])
            Y.append([float(d[f'{t}{rn}']) for t in ['BGY','BGZ','BHA','BHB']])
    X=np.array(X,float);Y=np.array(Y,float)
    idx=list(range(0,X.shape[1],args.step))
    Xr=X[:,idx]
    model=PLSRegression(n_components=2,scale=True,max_iter=2000).fit(Xr,Y)
    payload={
        'model_type':'PLSRegression','n_components':2,'scale':True,
        'training_samples':int(X.shape[0]),'original_wavelength_count':int(X.shape[1]),
        'model_wavelength_count':int(len(idx)),'downsample_step':args.step,
        'wavelengths_nm':[spec[i][2] for i in idx],
        'x_mean':np.asarray(model._x_mean).reshape(-1).tolist(),
        'targets':['IVOMD','IVDMD','NDF','ADF'],
        'target_units':{'IVOMD':'%','IVDMD':'%','NDF':'% DM','ADF':'% DM'},
        'note':'Research/demo screening model trained only on the supplied animal-feed NIR dataset. Not validated for laboratory deployment.',
        'coef_orientation':'targets_x_features', 'coef':model.coef_.tolist(), 'intercept':np.asarray(model.intercept_).reshape(-1).tolist(), 'x_mean_feature_count':int(len(model._x_mean))
    }
    with open(os.path.join(args.out,'nir_model.json'),'w') as f: json.dump(payload,f,separators=(',',':'))
    samples=[]
    for i,sid in enumerate(ids):
        samples.append({'sample':sid,'spectrum':X[i].tolist(),'ivomd':float(Y[i,0]),'ivdmd':float(Y[i,1]),'ndf':float(Y[i,2]),'adf':float(Y[i,3])})
    with open(os.path.join(args.out,'demo_nir_samples.json'),'w') as f: json.dump({'wavelengths':[s[2] for s in spec],'samples':samples},f,separators=(',',':'))
    print(f'Generated {len(samples)} samples and {len(idx)} model wavelengths.')

if __name__=='__main__':
    main()
