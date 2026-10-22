import numpy as np
from PIL import Image
from scipy import ndimage as ndi
im = Image.open('/home/juan/Desktop/Me/ceti/assets/brand/bocetos/ceti-05-hoja-modelo.jpg').convert('RGB')
a = np.asarray(im).astype(float)
PAL = {'bg':'F9F3E1','ground':'EDC795','body':'FB6711','shade':'C24C10','cream':'F7E0AD','groove':'E6B17E','maroon':'732C30','white':'FFFFFF','blush':'F98A55'}
names = list(PAL); cols = np.array([[int(PAL[n][i:i+2],16) for i in (0,2,4)] for n in names],float)
d = ((a[:,:,None,:]-cols[None,None])**2).sum(-1)
lab = d.argmin(-1)
np.save('lab.npy', lab)
fig = ~np.isin(lab, [names.index('bg'), names.index('ground')])
fig = ndi.binary_fill_holes(ndi.binary_opening(fig, iterations=2))
# components: find the one containing the front figure (around x=460,y=480 in full image)
cc, n = ndi.label(fig)
k = cc[480, 460]; m = cc == k
ys, xs = np.where(m); print('front bbox', xs.min(), xs.max(), ys.min(), ys.max())
np.save('front_mask.npy', m)
