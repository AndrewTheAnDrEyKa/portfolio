from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageChops
import numpy as np
# Non-generative extraction: hand-traced alpha masks, retaining original pixels.
# Coordinates refer to the reviewed source previews, not newly drawn artwork.
shapes={
'apollo':[(272,103),(294,100),(334,102),(371,99),(398,102),(412,108),(424,119),(444,124),(465,137),(481,151),(495,169),(506,182),(519,194),(526,214),(539,231),(544,251),(548,277),(553,296),(555,322),(555,345),(555,368),(552,387),(544,393),(529,396),(526,409),(504,416),(491,437),(487,457),(475,470),(466,470),(470,506),(469,546),(470,575),(478,594),(475,615),(459,630),(459,647),(434,656),(399,661),(350,663),(305,661),(257,657),(217,651),(200,643),(199,624),(195,614),(202,593),(217,575),(219,548),(214,509),(207,478),(199,454),(190,425),(175,420),(164,409),(158,383),(148,392),(135,393),(127,384),(128,358),(128,327),(132,298),(138,273),(142,248),(147,228),(158,205),(167,188),(180,166),(196,150),(218,135),(239,126),(258,119)],
'goddess':[(227,146),(242,125),(261,109),(283,97),(304,89),(330,84),(355,85),(375,91),(397,103),(414,115),(429,132),(440,150),(448,170),(454,191),(457,215),(457,237),(455,263),(450,282),(453,300),(445,320),(433,334),(432,351),(417,367),(408,389),(407,412),(421,436),(433,454),(448,466),(446,487),(439,507),(438,535),(435,557),(433,578),(415,578),(399,569),(384,570),(366,561),(348,554),(333,546),(316,544),(297,541),(279,536),(258,530),(243,523),(234,515),(233,508),(242,498),(255,495),(255,473),(253,452),(249,433),(246,413),(242,392),(241,365),(237,345),(223,337),(216,324),(213,309),(206,291),(203,273),(204,251),(209,228),(213,210),(214,187),(219,166)]
}
for name,points in shapes.items():
 im=Image.open(f'assets/{name}-original.jpg').convert('RGBA')
 preview=ImageOps.contain(im,(700,800));sx=im.width/preview.width;sy=im.height/preview.height
 mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(round(x*sx),round(y*sy)) for x,y in points],fill=255)
 if name=='apollo':
  pixels=np.array(im)[:,:,:3].astype('int16');chroma=pixels.max(axis=2)-pixels.min(axis=2)
  small_mask=mask.resize(preview.size,Image.Resampling.NEAREST)
  small_edge=ImageChops.subtract(small_mask,small_mask.filter(ImageFilter.MinFilter(21)))
  edge=np.array(small_edge.resize(im.size,Image.Resampling.NEAREST))>0
  alpha=np.array(mask);upper=np.indices(mask.size[::-1])[0] < 300*sy
  alpha[edge & (chroma<14) & upper]=0;mask=Image.fromarray(alpha)
 mask=mask.filter(ImageFilter.GaussianBlur(.65*sx));im.putalpha(mask)
 im=im.crop(mask.getbbox());im.thumbnail((900,1100),Image.Resampling.LANCZOS);im.save(f'assets/{name}-cutout.webp',quality=94)
im=Image.open('assets/athens-original.jpg').crop((1720,1260,2020,1800)).convert('RGBA')
points=[(146,119),(153,113),(158,123),(160,144),(170,152),(179,166),(179,185),(169,201),(164,220),(168,248),(175,269),(192,254),(213,233),(235,220),(252,210),(260,180),(266,153),(270,124),(284,98),(309,83),(341,79),(367,84),(374,100),(378,125),(384,139),(382,160),(387,178),(383,201),(400,207),(424,217),(446,234),(469,250),(495,263),(479,279),(475,315),(472,345),(478,377),(492,402),(504,430),(512,452),(507,477),(492,501),(488,525),(478,545),(464,563),(473,586),(468,612),(462,642),(456,680),(450,719),(443,765),(437,807),(424,847),(410,887),(394,918),(380,932),(381,951),(398,963),(409,980),(396,985),(373,981),(357,972),(346,965),(344,982),(344,1001),(338,1020),(324,1028),(306,1028),(290,1022),(280,1014),(265,1006),(235,1006),(205,1006),(193,1000),(203,993),(231,982),(234,968),(229,937),(216,904),(209,868),(200,828),(194,786),(209,742),(202,693),(194,647),(189,602),(169,560),(176,526),(183,488),(185,457),(176,427),(163,423),(151,417),(147,401),(139,383),(133,358),(127,338),(120,311),(119,284),(117,255),(119,233),(125,214),(129,194),(137,175),(138,149)]
mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(x/2,y/2) for x,y in points],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(.4));im.putalpha(mask);im=im.crop(mask.getbbox());im.save('assets/plato-cutout.webp',quality=96)
# Preview the extracted original photographs against the site's background.
sheet=Image.new('RGB',(1100,620),'#101010')
for i,name in enumerate(['apollo','goddess','plato']):
 im=Image.open(f'assets/{name}-cutout.webp');im=ImageOps.contain(im,(340,570));sheet.paste(im,(i*365+(340-im.width)//2,25),im)
sheet.save('.qa/antique-cutouts.jpg')



